-- =====================================================================
-- Central de Agentes — Etapa 2
-- 3/6 — Fila persistente do worker (tarefas, heartbeat) e funções de
--       reserva/lease/conclusão com recuperação de falhas.
-- Migração ADITIVA. Nada é executado: apenas a estrutura e as funções.
-- =====================================================================

-- --------------------------------------------------------- agente_tarefas
CREATE TABLE public.agente_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id uuid NOT NULL REFERENCES public.agentes(id) ON DELETE CASCADE,
  execucao_id uuid REFERENCES public.agente_execucoes(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'execucao',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  prioridade integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aguardando'
    CHECK (status IN ('aguardando','em_execucao','concluida','falha','cancelada','aguardando_reconciliacao')),
  tentativas integer NOT NULL DEFAULT 0 CHECK (tentativas >= 0),
  max_tentativas integer NOT NULL DEFAULT 3 CHECK (max_tentativas > 0),
  agendado_para timestamptz NOT NULL DEFAULT now(),
  lease_ate timestamptz,
  reservado_por text,
  idempotency_key text,
  ultimo_erro text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agente_tarefas_idempotency_unica UNIQUE (idempotency_key)
);
CREATE INDEX agente_tarefas_fila_idx ON public.agente_tarefas (prioridade DESC, agendado_para)
  WHERE status = 'aguardando';
CREATE INDEX agente_tarefas_agente_idx ON public.agente_tarefas (agente_id, criado_em DESC);
CREATE INDEX agente_tarefas_lease_idx ON public.agente_tarefas (status, lease_ate);
CREATE TRIGGER agente_tarefas_atualizado_em BEFORE UPDATE ON public.agente_tarefas
  FOR EACH ROW EXECUTE FUNCTION public.agente_set_atualizado_em();
COMMENT ON TABLE public.agente_tarefas IS
  'Fila persistente do worker. Acesso apenas por service_role/funções.';
GRANT ALL ON public.agente_tarefas TO service_role;
ALTER TABLE public.agente_tarefas ENABLE ROW LEVEL SECURITY;
-- Sem políticas para authenticated: acesso negado por padrão.

-- ------------------------------------------------ agente_worker_heartbeats
CREATE TABLE public.agente_worker_heartbeats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id text NOT NULL,
  status text NOT NULL DEFAULT 'online' CHECK (status IN ('online','ocupado','parado')),
  versao text,
  hostname text,
  processos integer NOT NULL DEFAULT 0 CHECK (processos >= 0),
  ultimo_ping timestamptz NOT NULL DEFAULT now(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agente_worker_heartbeats_worker_unico UNIQUE (worker_id)
);
CREATE INDEX agente_worker_heartbeats_ping_idx ON public.agente_worker_heartbeats (ultimo_ping DESC);
GRANT ALL ON public.agente_worker_heartbeats TO service_role;
ALTER TABLE public.agente_worker_heartbeats ENABLE ROW LEVEL SECURITY;
-- Sem políticas para authenticated: acesso negado por padrão.

-- -------------------------------------------------- reforço de privilégios
-- Fila e heartbeat são internos: nem anon nem authenticated acessam.
REVOKE ALL ON public.agente_tarefas FROM anon;
REVOKE ALL ON public.agente_tarefas FROM authenticated;
REVOKE ALL ON public.agente_worker_heartbeats FROM anon;
REVOKE ALL ON public.agente_worker_heartbeats FROM authenticated;

-- =====================================================================
-- Funções de fila (SECURITY DEFINER; EXECUTE restrito a service_role).
-- =====================================================================

-- Reserva atômica de tarefas com lock, SKIP LOCKED e lease.
CREATE OR REPLACE FUNCTION public.agente_reservar_tarefas(
  _worker_id text,
  _limite integer DEFAULT 1,
  _lease_segundos integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _resultado jsonb;
BEGIN
  IF coalesce(trim(_worker_id), '') = '' THEN
    RAISE EXCEPTION 'worker_id obrigatório';
  END IF;

  WITH selecionadas AS (
    SELECT id
      FROM public.agente_tarefas
     WHERE status = 'aguardando'
       AND agendado_para <= now()
     ORDER BY prioridade DESC, agendado_para ASC, criado_em ASC
     LIMIT GREATEST(coalesce(_limite, 1), 0)
     FOR UPDATE SKIP LOCKED
  ), atualizadas AS (
    UPDATE public.agente_tarefas t
       SET status = 'em_execucao',
           reservado_por = _worker_id,
           lease_ate = now() + make_interval(secs => GREATEST(coalesce(_lease_segundos, 60), 5)),
           tentativas = t.tentativas + 1,
           atualizado_em = now()
      FROM selecionadas s
     WHERE t.id = s.id
     RETURNING t.*
  )
  SELECT coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) INTO _resultado FROM atualizadas a;

  RETURN _resultado;
END;
$$;
REVOKE ALL ON FUNCTION public.agente_reservar_tarefas(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agente_reservar_tarefas(text, integer, integer) TO service_role;

-- Devolve à fila as tarefas cujo lease venceu (worker caiu).
CREATE OR REPLACE FUNCTION public.agente_expirar_leases()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _total integer;
BEGIN
  UPDATE public.agente_tarefas
     SET status = 'aguardando',
         reservado_por = NULL,
         lease_ate = NULL,
         atualizado_em = now()
   WHERE status = 'em_execucao'
     AND lease_ate IS NOT NULL
     AND lease_ate < now();
  GET DIAGNOSTICS _total = ROW_COUNT;
  RETURN _total;
END;
$$;
REVOKE ALL ON FUNCTION public.agente_expirar_leases() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agente_expirar_leases() TO service_role;

-- Conclui uma tarefa. Em 'falha' com tentativas restantes, devolve à fila
-- com atraso (backoff) em vez de repetir imediatamente.
CREATE OR REPLACE FUNCTION public.agente_concluir_tarefa(
  _tarefa_id uuid,
  _status text,
  _erro text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _t public.agente_tarefas;
BEGIN
  IF _status NOT IN ('concluida','falha','cancelada','aguardando_reconciliacao') THEN
    RAISE EXCEPTION 'Status inválido: %', _status;
  END IF;

  SELECT * INTO _t FROM public.agente_tarefas WHERE id = _tarefa_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF _status = 'falha' AND _t.tentativas < _t.max_tentativas THEN
    UPDATE public.agente_tarefas
       SET status = 'aguardando',
           reservado_por = NULL,
           lease_ate = NULL,
           ultimo_erro = _erro,
           agendado_para = now() + make_interval(secs => 30 * GREATEST(_t.tentativas, 1)),
           atualizado_em = now()
     WHERE id = _tarefa_id;
  ELSE
    UPDATE public.agente_tarefas
       SET status = _status,
           reservado_por = NULL,
           lease_ate = NULL,
           ultimo_erro = _erro,
           atualizado_em = now()
     WHERE id = _tarefa_id;
  END IF;

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.agente_concluir_tarefa(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agente_concluir_tarefa(uuid, text, text) TO service_role;

-- Heartbeat do worker (upsert).
CREATE OR REPLACE FUNCTION public.agente_registrar_heartbeat(
  _worker_id text,
  _status text DEFAULT 'online',
  _versao text DEFAULT NULL,
  _hostname text DEFAULT NULL,
  _processos integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.agente_worker_heartbeats (worker_id, status, versao, hostname, processos, ultimo_ping)
  VALUES (_worker_id, coalesce(_status,'online'), _versao, _hostname, GREATEST(coalesce(_processos,0),0), now())
  ON CONFLICT (worker_id) DO UPDATE
    SET status = EXCLUDED.status,
        versao = EXCLUDED.versao,
        hostname = EXCLUDED.hostname,
        processos = EXCLUDED.processos,
        ultimo_ping = now();
END;
$$;
REVOKE ALL ON FUNCTION public.agente_registrar_heartbeat(text, text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agente_registrar_heartbeat(text, text, text, text, integer) TO service_role;

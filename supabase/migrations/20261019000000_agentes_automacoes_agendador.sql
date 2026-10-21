-- =====================================================================
-- Central de Agentes — Etapa 7
-- Automações, agendador, alertas e monitoramento.
--
-- Migração ADITIVA: novas colunas em agente_automacoes, nova tabela
-- agente_alertas e novas funções. Única substituição: os dois CHECKs de
-- tipo/gatilho de agente_automacoes (tabela sem dados) são recriados para
-- aceitar manual/agendado/recorrente/evento.
-- =====================================================================

-- ------------------------------------------------ agente_automacoes (colunas)
ALTER TABLE public.agente_automacoes
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS frequencia text,
  ADD COLUMN IF NOT EXISTS intervalo_minutos integer,
  ADD COLUMN IF NOT EXISTS hora_local time,
  ADD COLUMN IF NOT EXISTS dias_semana integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS executar_em timestamptz,
  ADD COLUMN IF NOT EXISTS fuso text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS ferramentas_permitidas text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS proxima_execucao_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultimo_status text,
  ADD COLUMN IF NOT EXISTS ultimo_erro text,
  ADD COLUMN IF NOT EXISTS falhas_consecutivas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_tentativas integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS desativar_apos_falhas integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS tolerancia_minutos integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS criado_por uuid;

ALTER TABLE public.agente_automacoes DROP CONSTRAINT IF EXISTS agente_automacoes_gatilho_check;
ALTER TABLE public.agente_automacoes DROP CONSTRAINT IF EXISTS agente_automacoes_tipo_gatilho_check;

ALTER TABLE public.agente_automacoes
  ADD CONSTRAINT agente_automacoes_tipo_gatilho_check
    CHECK (tipo_gatilho IN ('manual','agendado','recorrente','evento')),
  ADD CONSTRAINT agente_automacoes_frequencia_check
    CHECK (frequencia IS NULL OR frequencia IN ('intervalo','diaria','semanal')),
  ADD CONSTRAINT agente_automacoes_intervalo_check
    CHECK (intervalo_minutos IS NULL OR intervalo_minutos BETWEEN 5 AND 10080),
  ADD CONSTRAINT agente_automacoes_dias_check
    CHECK (dias_semana <@ ARRAY[0,1,2,3,4,5,6]),
  ADD CONSTRAINT agente_automacoes_max_tentativas_check
    CHECK (max_tentativas BETWEEN 1 AND 10),
  ADD CONSTRAINT agente_automacoes_desativar_check
    CHECK (desativar_apos_falhas BETWEEN 1 AND 50),
  ADD CONSTRAINT agente_automacoes_tolerancia_check
    CHECK (tolerancia_minutos BETWEEN 1 AND 1440),
  ADD CONSTRAINT agente_automacoes_ultimo_status_check
    CHECK (ultimo_status IS NULL OR ultimo_status IN
      ('enfileirada','concluida','falha','cancelada','perdida','ignorada','desativada_por_erro'));

CREATE INDEX IF NOT EXISTS agente_automacoes_proxima_idx
  ON public.agente_automacoes (proxima_execucao_em)
  WHERE ativo AND proxima_execucao_em IS NOT NULL;

-- ------------------------------------------------------- eventos permitidos
-- Lista fechada de eventos internos. Nenhum listener genérico.
CREATE OR REPLACE FUNCTION public.agente_eventos_permitidos()
RETURNS text[]
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$ SELECT ARRAY['agente.alerta_criado']::text[] $$;

-- ---------------------------------------------------- próxima execução (pura)
-- Calcula a próxima ocorrência ESTRITAMENTE posterior a _apos.
-- Fonte única da regra de agendamento (UI, trigger e agendador usam esta função).
CREATE OR REPLACE FUNCTION public.agente_proxima_execucao(
  _tipo text, _frequencia text, _intervalo integer, _hora time,
  _dias integer[], _fuso text, _executar_em timestamptz, _apos timestamptz
) RETURNS timestamptz
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  _dia date;
  _cand timestamptz;
  _i integer;
BEGIN
  IF _tipo = 'agendado' THEN
    IF _executar_em IS NOT NULL AND _executar_em > _apos THEN
      RETURN _executar_em;
    END IF;
    RETURN NULL;
  END IF;

  IF _tipo <> 'recorrente' THEN
    RETURN NULL;
  END IF;

  IF _frequencia = 'intervalo' THEN
    RETURN _apos + make_interval(mins => _intervalo);
  END IF;

  _dia := (_apos AT TIME ZONE _fuso)::date;

  IF _frequencia = 'diaria' THEN
    FOR _i IN 0..1 LOOP
      _cand := ((_dia + _i) + _hora) AT TIME ZONE _fuso;
      IF _cand > _apos THEN RETURN _cand; END IF;
    END LOOP;
  ELSIF _frequencia = 'semanal' THEN
    FOR _i IN 0..8 LOOP
      _cand := ((_dia + _i) + _hora) AT TIME ZONE _fuso;
      IF _cand > _apos AND extract(dow FROM (_dia + _i))::int = ANY(_dias) THEN
        RETURN _cand;
      END IF;
    END LOOP;
  END IF;

  RETURN NULL;
END;
$$;

-- ------------------------------------- validação + próxima execução (trigger)
CREATE OR REPLACE FUNCTION public.agente_automacoes_preparar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo_gatilho IN ('agendado','recorrente')
     AND NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.fuso) THEN
    RAISE EXCEPTION 'Fuso horário inválido: %', NEW.fuso;
  END IF;

  IF NEW.tipo_gatilho = 'agendado' THEN
    IF NEW.executar_em IS NULL THEN
      RAISE EXCEPTION 'Informe a data e hora da execução agendada.';
    END IF;
  ELSIF NEW.tipo_gatilho = 'recorrente' THEN
    IF NEW.frequencia IS NULL THEN
      RAISE EXCEPTION 'Informe a frequência da recorrência.';
    END IF;
    IF NEW.frequencia = 'intervalo' AND NEW.intervalo_minutos IS NULL THEN
      RAISE EXCEPTION 'Informe o intervalo em minutos.';
    END IF;
    IF NEW.frequencia IN ('diaria','semanal') AND NEW.hora_local IS NULL THEN
      RAISE EXCEPTION 'Informe o horário da recorrência.';
    END IF;
    IF NEW.frequencia = 'semanal' AND coalesce(array_length(NEW.dias_semana, 1), 0) = 0 THEN
      RAISE EXCEPTION 'Informe ao menos um dia da semana.';
    END IF;
  ELSIF NEW.tipo_gatilho = 'evento' THEN
    IF NEW.evento IS NULL OR NOT (NEW.evento = ANY (public.agente_eventos_permitidos())) THEN
      RAISE EXCEPTION 'Evento não autorizado: %', coalesce(NEW.evento, '(vazio)');
    END IF;
  END IF;

  -- Recalcula o agendamento só quando algo do agendamento/estado mudou, para
  -- não interferir nas atualizações do próprio agendador.
  IF TG_OP = 'INSERT'
     OR OLD.ativo IS DISTINCT FROM NEW.ativo
     OR OLD.tipo_gatilho IS DISTINCT FROM NEW.tipo_gatilho
     OR OLD.frequencia IS DISTINCT FROM NEW.frequencia
     OR OLD.intervalo_minutos IS DISTINCT FROM NEW.intervalo_minutos
     OR OLD.hora_local IS DISTINCT FROM NEW.hora_local
     OR OLD.dias_semana IS DISTINCT FROM NEW.dias_semana
     OR OLD.fuso IS DISTINCT FROM NEW.fuso
     OR OLD.executar_em IS DISTINCT FROM NEW.executar_em THEN

    IF NEW.ativo AND NEW.tipo_gatilho IN ('agendado','recorrente') THEN
      NEW.proxima_execucao_em := public.agente_proxima_execucao(
        NEW.tipo_gatilho, NEW.frequencia, NEW.intervalo_minutos, NEW.hora_local,
        NEW.dias_semana, NEW.fuso, NEW.executar_em, now());
      IF NEW.tipo_gatilho = 'agendado' AND NEW.proxima_execucao_em IS NULL THEN
        RAISE EXCEPTION 'A data da execução agendada deve ser futura.';
      END IF;
    ELSE
      NEW.proxima_execucao_em := NULL;
    END IF;

    IF TG_OP = 'UPDATE' AND NOT OLD.ativo AND NEW.ativo THEN
      NEW.falhas_consecutivas := 0;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agente_automacoes_preparar ON public.agente_automacoes;
CREATE TRIGGER agente_automacoes_preparar
  BEFORE INSERT OR UPDATE ON public.agente_automacoes
  FOR EACH ROW EXECUTE FUNCTION public.agente_automacoes_preparar();

-- ------------------------------------------------------------ agente_alertas
CREATE TABLE public.agente_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  severidade text NOT NULL CHECK (severidade IN ('info','aviso','critico')),
  titulo text NOT NULL,
  descricao text,
  origem text NOT NULL CHECK (origem IN ('worker','tarefa','fila','automacao','agente','aprovacao')),
  referencia_tipo text,
  referencia_id text,
  chave_dedup text NOT NULL,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','reconhecido','resolvido')),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  reconhecido_por uuid,
  reconhecido_em timestamptz,
  resolvido_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
-- Um único alerta "em aberto" por chave: evita duplicatas.
CREATE UNIQUE INDEX agente_alertas_dedup_aberto
  ON public.agente_alertas (chave_dedup) WHERE status IN ('aberto','reconhecido');
CREATE INDEX agente_alertas_status_idx ON public.agente_alertas (status, criado_em DESC);

GRANT SELECT ON public.agente_alertas TO authenticated;
GRANT ALL ON public.agente_alertas TO service_role;
ALTER TABLE public.agente_alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY agente_alertas_leitura ON public.agente_alertas FOR SELECT TO authenticated
  USING (public.pode_agentes('agentes.visualizar'));
REVOKE ALL ON public.agente_alertas FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.agente_alertas FROM authenticated;

-- ---------------------------------------------------------- disparar evento
CREATE OR REPLACE FUNCTION public.agente_disparar_evento(
  _evento text, _payload jsonb DEFAULT '{}'::jsonb, _chave text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.agente_automacoes;
  _criadas integer := 0;
  _id uuid;
BEGIN
  IF NOT (_evento = ANY (public.agente_eventos_permitidos())) THEN
    RAISE EXCEPTION 'Evento não autorizado: %', _evento;
  END IF;
  IF coalesce(trim(_chave), '') = '' THEN
    RAISE EXCEPTION 'Chave de ocorrência obrigatória.';
  END IF;

  FOR r IN
    SELECT au.* FROM public.agente_automacoes au
      JOIN public.agentes ag ON ag.id = au.agente_id
     WHERE au.ativo AND ag.ativo
       AND au.tipo_gatilho = 'evento' AND au.evento = _evento
  LOOP
    -- Limite de taxa: no máximo 1 disparo por minuto por automação (evita tempestade).
    IF EXISTS (
      SELECT 1 FROM public.agente_tarefas t
       WHERE t.tipo = 'automacao'
         AND t.payload->>'automacao_id' = r.id::text
         AND t.payload->>'origem' = 'evento'
         AND t.criado_em > now() - interval '1 minute'
    ) THEN
      CONTINUE;
    END IF;

    _id := NULL;
    INSERT INTO public.agente_tarefas
      (agente_id, tipo, payload, max_tentativas, idempotency_key)
    VALUES
      (r.agente_id, 'automacao',
       jsonb_build_object('automacao_id', r.id, 'origem', 'evento', 'evento', _evento,
                          'evento_payload', coalesce(_payload, '{}'::jsonb)),
       r.max_tentativas, 'automacao:' || r.id || ':evento:' || _chave)
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO _id;

    IF _id IS NOT NULL THEN
      _criadas := _criadas + 1;
      UPDATE public.agente_automacoes SET ultimo_status = 'enfileirada' WHERE id = r.id;
      PERFORM public.agente_registrar_auditoria(
        'automacao.disparada_evento', r.agente_id, NULL, 'agente_automacoes', r.id::text,
        jsonb_build_object('evento', _evento, 'tarefa_id', _id));
    END IF;
  END LOOP;

  RETURN _criadas;
END;
$$;

-- ------------------------------------------------------------- abrir alerta
CREATE OR REPLACE FUNCTION public.agente_alerta_abrir(
  _tipo text, _severidade text, _titulo text, _descricao text, _origem text,
  _referencia_tipo text, _referencia_id text, _chave text, _dados jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _novo boolean;
BEGIN
  INSERT INTO public.agente_alertas
    (tipo, severidade, titulo, descricao, origem, referencia_tipo, referencia_id, chave_dedup, dados)
  VALUES
    (_tipo, _severidade, _titulo, _descricao, _origem, _referencia_tipo, _referencia_id, _chave,
     coalesce(_dados, '{}'::jsonb))
  ON CONFLICT (chave_dedup) WHERE status IN ('aberto','reconhecido')
  DO UPDATE SET descricao = EXCLUDED.descricao, dados = EXCLUDED.dados, atualizado_em = now()
  RETURNING id, (xmax = 0) INTO _id, _novo;

  IF _novo THEN
    PERFORM public.agente_disparar_evento(
      'agente.alerta_criado',
      jsonb_build_object('alerta_id', _id, 'tipo', _tipo, 'severidade', _severidade),
      'alerta:' || _id);
  END IF;

  RETURN _id;
END;
$$;

-- --------------------------------------------- resultado da tarefa -> automação
CREATE OR REPLACE FUNCTION public.agente_tarefa_resultado_automacao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _manual boolean;
  _a public.agente_automacoes;
BEGIN
  IF NEW.tipo <> 'automacao'
     OR NEW.status NOT IN ('concluida','falha','cancelada')
     OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  BEGIN
    _id := NULLIF(NEW.payload->>'automacao_id', '')::uuid;
  EXCEPTION WHEN others THEN
    RETURN NEW;
  END;
  IF _id IS NULL THEN RETURN NEW; END IF;

  _manual := coalesce(NEW.payload->>'origem', '') = 'manual';

  IF NEW.status = 'concluida' THEN
    UPDATE public.agente_automacoes
       SET ultima_execucao_em = now(), ultimo_status = 'concluida', ultimo_erro = NULL,
           falhas_consecutivas = CASE WHEN _manual THEN falhas_consecutivas ELSE 0 END
     WHERE id = _id;

  ELSIF NEW.status = 'falha' THEN
    UPDATE public.agente_automacoes
       SET ultima_execucao_em = now(), ultimo_status = 'falha', ultimo_erro = NEW.ultimo_erro,
           falhas_consecutivas = CASE WHEN _manual THEN falhas_consecutivas ELSE falhas_consecutivas + 1 END
     WHERE id = _id
     RETURNING * INTO _a;

    IF FOUND AND NOT _manual AND _a.ativo AND _a.falhas_consecutivas >= _a.desativar_apos_falhas THEN
      UPDATE public.agente_automacoes
         SET ativo = false, ultimo_status = 'desativada_por_erro'
       WHERE id = _id;
      PERFORM public.agente_alerta_abrir(
        'automacao_desativada', 'critico',
        'Automação desativada por falhas: ' || _a.nome,
        'Atingiu ' || _a.falhas_consecutivas || ' falhas consecutivas. Último erro: ' || coalesce(NEW.ultimo_erro, '-'),
        'automacao', 'agente_automacoes', _id::text, 'automacao_desativada:' || _id,
        jsonb_build_object('automacao_id', _id));
      PERFORM public.agente_registrar_auditoria(
        'automacao.desativada_por_erro', _a.agente_id, NULL, 'agente_automacoes', _id::text,
        jsonb_build_object('falhas_consecutivas', _a.falhas_consecutivas));
    END IF;

  ELSE
    UPDATE public.agente_automacoes
       SET ultimo_status = 'cancelada', ultimo_erro = NEW.ultimo_erro
     WHERE id = _id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agente_tarefa_resultado_automacao ON public.agente_tarefas;
CREATE TRIGGER agente_tarefa_resultado_automacao
  AFTER UPDATE OF status ON public.agente_tarefas
  FOR EACH ROW EXECUTE FUNCTION public.agente_tarefa_resultado_automacao();

-- ------------------------------------------------------------------ agendador
-- Reserva atômica (FOR UPDATE SKIP LOCKED) das automações vencidas e
-- enfileira UMA tarefa por ocorrência (idempotency_key única).
--
-- Política de execuções perdidas: se o agendador ficou parado, só a ocorrência
-- MAIS RECENTE é considerada, e apenas se estiver dentro da tolerância da
-- automação (padrão 15 min). As anteriores são descartadas; se nem a mais
-- recente está na tolerância, nada executa, abre-se alerta e a próxima
-- ocorrência futura é agendada.
CREATE OR REPLACE FUNCTION public.agente_agendar_automacoes(_limite integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.agente_automacoes;
  _ocorr timestamptz;
  _recente timestamptz;
  _t timestamptz;
  _prox timestamptz;
  _n integer;
  _agente_ativo boolean;
  _tarefa uuid;
  _criadas integer := 0;
  _perdidas integer := 0;
  _ignoradas integer := 0;
  _chave text;
BEGIN
  FOR r IN
    SELECT * FROM public.agente_automacoes
     WHERE ativo
       AND tipo_gatilho IN ('agendado','recorrente')
       AND proxima_execucao_em IS NOT NULL
       AND proxima_execucao_em <= now()
     ORDER BY proxima_execucao_em
     LIMIT GREATEST(coalesce(_limite, 50), 1)
     FOR UPDATE SKIP LOCKED
  LOOP
    _ocorr := r.proxima_execucao_em;
    _recente := _ocorr;

    IF r.tipo_gatilho = 'recorrente' THEN
      IF r.frequencia = 'intervalo' THEN
        _recente := _ocorr + make_interval(mins => r.intervalo_minutos)
                    * floor(extract(epoch FROM (now() - _ocorr)) / (r.intervalo_minutos * 60))::int;
      ELSE
        _n := 0;
        LOOP
          _t := public.agente_proxima_execucao(r.tipo_gatilho, r.frequencia, r.intervalo_minutos,
                  r.hora_local, r.dias_semana, r.fuso, r.executar_em, _recente);
          EXIT WHEN _t IS NULL OR _t > now() OR _n > 1000;
          _recente := _t;
          _n := _n + 1;
        END LOOP;
      END IF;
    END IF;

    _prox := public.agente_proxima_execucao(r.tipo_gatilho, r.frequencia, r.intervalo_minutos,
               r.hora_local, r.dias_semana, r.fuso, r.executar_em, _recente);

    -- Execução perdida (fora da tolerância)
    IF now() - _recente > make_interval(mins => r.tolerancia_minutos) THEN
      UPDATE public.agente_automacoes
         SET proxima_execucao_em = _prox,
             ativo = CASE WHEN r.tipo_gatilho = 'agendado' THEN false ELSE ativo END,
             ultimo_status = 'perdida',
             ultimo_erro = 'Ocorrência de ' || to_char(_recente AT TIME ZONE r.fuso, 'DD/MM/YYYY HH24:MI')
                           || ' não executada (fora da tolerância de ' || r.tolerancia_minutos || ' min).'
       WHERE id = r.id;
      PERFORM public.agente_alerta_abrir(
        'agendamento_perdido', 'aviso', 'Execução perdida: ' || r.nome,
        'A ocorrência de ' || to_char(_recente AT TIME ZONE r.fuso, 'DD/MM/YYYY HH24:MI')
          || ' passou da tolerância e foi descartada.',
        'automacao', 'agente_automacoes', r.id::text,
        'agendamento_perdido:' || r.id || ':' || extract(epoch FROM _recente)::bigint,
        jsonb_build_object('automacao_id', r.id));
      PERFORM public.agente_registrar_auditoria(
        'automacao.execucao_perdida', r.agente_id, NULL, 'agente_automacoes', r.id::text,
        jsonb_build_object('ocorrencia', _recente));
      _perdidas := _perdidas + 1;
      CONTINUE;
    END IF;

    SELECT ativo INTO _agente_ativo FROM public.agentes WHERE id = r.agente_id;
    IF NOT coalesce(_agente_ativo, false) THEN
      UPDATE public.agente_automacoes
         SET proxima_execucao_em = _prox,
             ativo = CASE WHEN r.tipo_gatilho = 'agendado' THEN false ELSE ativo END,
             ultimo_status = 'ignorada', ultimo_erro = 'Agente inativo na hora da execução.'
       WHERE id = r.id;
      PERFORM public.agente_registrar_auditoria(
        'automacao.ignorada_agente_inativo', r.agente_id, NULL, 'agente_automacoes', r.id::text,
        jsonb_build_object('ocorrencia', _recente));
      _ignoradas := _ignoradas + 1;
      CONTINUE;
    END IF;

    _chave := 'automacao:' || r.id || ':' || extract(epoch FROM _recente)::bigint;
    _tarefa := NULL;
    INSERT INTO public.agente_tarefas
      (agente_id, tipo, payload, max_tentativas, idempotency_key)
    VALUES
      (r.agente_id, 'automacao',
       jsonb_build_object('automacao_id', r.id, 'origem', r.tipo_gatilho, 'ocorrencia', _recente),
       r.max_tentativas, _chave)
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO _tarefa;

    UPDATE public.agente_automacoes
       SET proxima_execucao_em = _prox,
           ativo = CASE WHEN r.tipo_gatilho = 'agendado' THEN false ELSE ativo END,
           ultimo_status = CASE WHEN _tarefa IS NOT NULL THEN 'enfileirada' ELSE ultimo_status END
     WHERE id = r.id;

    IF _tarefa IS NOT NULL THEN
      _criadas := _criadas + 1;
      PERFORM public.agente_registrar_auditoria(
        'automacao.agendada', r.agente_id, NULL, 'agente_automacoes', r.id::text,
        jsonb_build_object('tarefa_id', _tarefa, 'ocorrencia', _recente));
    END IF;
  END LOOP;

  RETURN jsonb_build_object('criadas', _criadas, 'perdidas', _perdidas, 'ignoradas', _ignoradas);
END;
$$;

-- ----------------------------------------------------------- manutenção beats
-- Política de retenção: worker sem ping há 30 min vira 'parado'; registros
-- 'parado' com mais de 14 dias são removidos (são só presença, não histórico).
CREATE OR REPLACE FUNCTION public.agente_heartbeats_manter(
  _inativo_minutos integer DEFAULT 30, _retencao_dias integer DEFAULT 14
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _parados integer;
  _removidos integer;
BEGIN
  UPDATE public.agente_worker_heartbeats
     SET status = 'parado'
   WHERE status <> 'parado'
     AND ultimo_ping < now() - make_interval(mins => GREATEST(_inativo_minutos, 1));
  GET DIAGNOSTICS _parados = ROW_COUNT;

  DELETE FROM public.agente_worker_heartbeats
   WHERE status = 'parado'
     AND ultimo_ping < now() - make_interval(days => GREATEST(_retencao_dias, 1));
  GET DIAGNOSTICS _removidos = ROW_COUNT;

  RETURN jsonb_build_object('marcados_parados', _parados, 'removidos', _removidos);
END;
$$;

-- --------------------------------------------------------------------- alertas
CREATE OR REPLACE FUNCTION public.agente_gerar_alertas()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  _chaves text[] := '{}';
  _k text;
  _abertos integer := 0;
  _resolvidos integer;
  _vivos integer;
  _aguardando_atrasadas integer;
BEGIN
  -- 1. Worker sem heartbeat recente (2–30 min; depois vira 'parado' na manutenção)
  FOR r IN
    SELECT worker_id, ultimo_ping FROM public.agente_worker_heartbeats
     WHERE status IN ('online','ocupado')
       AND ultimo_ping < now() - interval '2 minutes'
       AND ultimo_ping > now() - interval '30 minutes'
  LOOP
    _k := 'worker_sem_heartbeat:' || r.worker_id;
    _chaves := _chaves || _k;
    PERFORM public.agente_alerta_abrir('worker_sem_heartbeat', 'aviso',
      'Worker sem heartbeat recente', 'Último sinal em ' || to_char(r.ultimo_ping, 'DD/MM HH24:MI:SS') || '.',
      'worker', 'agente_worker_heartbeats', r.worker_id, _k, '{}'::jsonb);
    _abertos := _abertos + 1;
  END LOOP;

  -- 2. Nenhum worker vivo (só se já existiu algum)
  SELECT count(*) INTO _vivos FROM public.agente_worker_heartbeats
   WHERE status IN ('online','ocupado') AND ultimo_ping >= now() - interval '2 minutes';
  IF _vivos = 0 AND EXISTS (SELECT 1 FROM public.agente_worker_heartbeats) THEN
    _k := 'sem_worker_ativo';
    _chaves := _chaves || _k;
    PERFORM public.agente_alerta_abrir('sem_worker_ativo', 'critico',
      'Nenhum worker ativo', 'Nenhum worker enviou heartbeat nos últimos 2 minutos; tarefas e automações não serão processadas.',
      'worker', NULL, NULL, _k, '{}'::jsonb);
    _abertos := _abertos + 1;
  END IF;

  -- 3. Tarefa parada (lease vencido há mais de 5 min e não recuperado)
  FOR r IN
    SELECT id, agente_id FROM public.agente_tarefas
     WHERE status = 'em_execucao' AND lease_ate IS NOT NULL AND lease_ate < now() - interval '5 minutes'
  LOOP
    _k := 'tarefa_parada:' || r.id;
    _chaves := _chaves || _k;
    PERFORM public.agente_alerta_abrir('tarefa_parada', 'aviso',
      'Tarefa parada em execução', 'O lease da tarefa venceu há mais de 5 minutos.',
      'tarefa', 'agente_tarefas', r.id::text, _k, jsonb_build_object('agente_id', r.agente_id));
    _abertos := _abertos + 1;
  END LOOP;

  -- 4. Fila acumulando
  SELECT count(*) INTO _aguardando_atrasadas FROM public.agente_tarefas
   WHERE status = 'aguardando' AND agendado_para < now() - interval '5 minutes';
  IF _aguardando_atrasadas >= 10 THEN
    _k := 'fila_acumulando';
    _chaves := _chaves || _k;
    PERFORM public.agente_alerta_abrir('fila_acumulando', 'aviso',
      'Fila acumulando tarefas', _aguardando_atrasadas || ' tarefas aguardam há mais de 5 minutos.',
      'fila', NULL, NULL, _k, jsonb_build_object('quantidade', _aguardando_atrasadas));
    _abertos := _abertos + 1;
  END IF;

  -- 5. Falhas repetidas (por agente, na última hora)
  FOR r IN
    SELECT agente_id, count(*) AS total FROM public.agente_tarefas
     WHERE status = 'falha' AND atualizado_em > now() - interval '1 hour'
     GROUP BY agente_id HAVING count(*) >= 5
  LOOP
    _k := 'falhas_repetidas:' || r.agente_id;
    _chaves := _chaves || _k;
    PERFORM public.agente_alerta_abrir('falhas_repetidas', 'critico',
      'Falhas repetidas em tarefas', r.total || ' tarefas falharam na última hora.',
      'agente', 'agentes', r.agente_id::text, _k, jsonb_build_object('quantidade', r.total));
    _abertos := _abertos + 1;
  END LOOP;

  -- 6. Agente indisponível com trabalho pendente
  FOR r IN
    SELECT a.id, a.nome FROM public.agentes a
     WHERE NOT a.ativo
       AND (EXISTS (SELECT 1 FROM public.agente_tarefas t WHERE t.agente_id = a.id AND t.status = 'aguardando')
            OR EXISTS (SELECT 1 FROM public.agente_automacoes au WHERE au.agente_id = a.id AND au.ativo))
  LOOP
    _k := 'agente_indisponivel:' || r.id;
    _chaves := _chaves || _k;
    PERFORM public.agente_alerta_abrir('agente_indisponivel', 'aviso',
      'Agente indisponível: ' || r.nome, 'O agente está desativado, mas há tarefas ou automações ativas associadas.',
      'agente', 'agentes', r.id::text, _k, '{}'::jsonb);
    _abertos := _abertos + 1;
  END LOOP;

  -- 7. Aprovação pendente há muito tempo (> 1 h)
  FOR r IN
    SELECT id, execucao_id FROM public.agente_aprovacoes
     WHERE status = 'pendente' AND criado_em < now() - interval '1 hour'
  LOOP
    _k := 'aprovacao_atrasada:' || r.id;
    _chaves := _chaves || _k;
    PERFORM public.agente_alerta_abrir('aprovacao_atrasada', 'aviso',
      'Aprovação aguardando há mais de 1 hora', 'Há uma operação sensível aguardando decisão.',
      'aprovacao', 'agente_aprovacoes', r.id::text, _k, jsonb_build_object('execucao_id', r.execucao_id));
    _abertos := _abertos + 1;
  END LOOP;

  -- Resolve automaticamente alertas de condição que deixou de existir.
  -- (automacao_desativada / agendamento_perdido são eventos e ficam até
  -- serem reconhecidos/resolvidos por uma pessoa.)
  UPDATE public.agente_alertas
     SET status = 'resolvido', resolvido_em = now(), atualizado_em = now()
   WHERE status IN ('aberto','reconhecido')
     AND tipo IN ('worker_sem_heartbeat','sem_worker_ativo','tarefa_parada','fila_acumulando',
                  'falhas_repetidas','agente_indisponivel','aprovacao_atrasada')
     AND NOT (chave_dedup = ANY (_chaves));
  GET DIAGNOSTICS _resolvidos = ROW_COUNT;

  RETURN jsonb_build_object('ativos', _abertos, 'resolvidos', _resolvidos);
END;
$$;

-- ---------------------------------------------- reconhecer/resolver (usuário)
CREATE OR REPLACE FUNCTION public.agente_alerta_atualizar_status(_id uuid, _status text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _a public.agente_alertas;
BEGIN
  IF NOT public.pode_agentes('agentes.gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar alertas.';
  END IF;
  IF _status NOT IN ('reconhecido','resolvido') THEN
    RAISE EXCEPTION 'Status inválido: %', _status;
  END IF;

  UPDATE public.agente_alertas
     SET status = _status,
         reconhecido_por = CASE WHEN _status = 'reconhecido' THEN auth.uid() ELSE reconhecido_por END,
         reconhecido_em = CASE WHEN _status = 'reconhecido' THEN now() ELSE reconhecido_em END,
         resolvido_em = CASE WHEN _status = 'resolvido' THEN now() ELSE resolvido_em END,
         atualizado_em = now()
   WHERE id = _id AND status <> 'resolvido'
   RETURNING * INTO _a;
  IF NOT FOUND THEN RETURN false; END IF;

  PERFORM public.agente_registrar_auditoria(
    'alerta.' || _status, NULL, NULL, 'agente_alertas', _id::text,
    jsonb_build_object('tipo', _a.tipo));
  RETURN true;
END;
$$;

-- ------------------------------------------------- histórico de uma automação
CREATE OR REPLACE FUNCTION public.agente_automacao_historico(_automacao_id uuid, _limite integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.pode_agentes('agentes.visualizar') THEN
    RAISE EXCEPTION 'Sem permissão para visualizar automações.';
  END IF;

  RETURN (
    SELECT coalesce(jsonb_agg(x ORDER BY x.criado_em DESC), '[]'::jsonb)
      FROM (
        SELECT t.id, t.status, t.tentativas, t.max_tentativas, t.ultimo_erro,
               t.agendado_para, t.criado_em, t.atualizado_em, t.execucao_id,
               t.payload->>'origem' AS origem,
               e.status AS execucao_status
          FROM public.agente_tarefas t
          LEFT JOIN public.agente_execucoes e ON e.id = t.execucao_id
         WHERE t.tipo = 'automacao' AND t.payload->>'automacao_id' = _automacao_id::text
         ORDER BY t.criado_em DESC
         LIMIT LEAST(GREATEST(coalesce(_limite, 30), 1), 200)
      ) x
  );
END;
$$;

-- ------------------------------------------------------ resumo do monitoramento
CREATE OR REPLACE FUNCTION public.agente_monitoramento_resumo()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _desde timestamptz := now() - interval '24 hours';
  _limite_ping timestamptz := now() - interval '90 seconds';
BEGIN
  IF NOT public.pode_agentes('agentes.visualizar') THEN
    RAISE EXCEPTION 'Sem permissão para visualizar o monitoramento.';
  END IF;

  RETURN jsonb_build_object(
    'agentes_total', (SELECT count(*) FROM public.agentes),
    'agentes_ativos', (SELECT count(*) FROM public.agentes WHERE ativo),
    'agentes', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'nome', a.nome, 'tipo', a.tipo, 'ativo', a.ativo,
        'tarefas_aguardando', (SELECT count(*) FROM public.agente_tarefas t WHERE t.agente_id = a.id AND t.status = 'aguardando'),
        'tarefas_em_execucao', (SELECT count(*) FROM public.agente_tarefas t WHERE t.agente_id = a.id AND t.status = 'em_execucao'),
        'ultima_atividade', (SELECT max(e.criado_em) FROM public.agente_execucoes e WHERE e.agente_id = a.id)
      ) ORDER BY a.ordem), '[]'::jsonb)
      FROM public.agentes a),
    'workers', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'worker_id', w.worker_id, 'status', w.status, 'versao', w.versao, 'hostname', w.hostname,
        'processos', w.processos, 'ultimo_ping', w.ultimo_ping,
        'estado', CASE
          WHEN w.status = 'parado' THEN 'parado'
          WHEN w.ultimo_ping < _limite_ping THEN 'inativo'
          ELSE w.status END
      ) ORDER BY w.ultimo_ping DESC), '[]'::jsonb)
      FROM (SELECT * FROM public.agente_worker_heartbeats
             WHERE ultimo_ping > now() - interval '24 hours'
             ORDER BY ultimo_ping DESC LIMIT 30) w),
    'workers_online', (SELECT count(*) FROM public.agente_worker_heartbeats WHERE status = 'online' AND ultimo_ping >= _limite_ping),
    'workers_ocupados', (SELECT count(*) FROM public.agente_worker_heartbeats WHERE status = 'ocupado' AND ultimo_ping >= _limite_ping),
    'workers_inativos', (SELECT count(*) FROM public.agente_worker_heartbeats
                          WHERE status IN ('online','ocupado') AND ultimo_ping < _limite_ping AND ultimo_ping > now() - interval '24 hours'),
    'tarefas', jsonb_build_object(
      'aguardando', (SELECT count(*) FROM public.agente_tarefas WHERE status = 'aguardando'),
      'em_execucao', (SELECT count(*) FROM public.agente_tarefas WHERE status = 'em_execucao'),
      'concluidas_24h', (SELECT count(*) FROM public.agente_tarefas WHERE status = 'concluida' AND atualizado_em >= _desde),
      'falhas_24h', (SELECT count(*) FROM public.agente_tarefas WHERE status = 'falha' AND atualizado_em >= _desde),
      'mais_antiga_aguardando', (SELECT min(agendado_para) FROM public.agente_tarefas WHERE status = 'aguardando' AND agendado_para <= now())
    ),
    'aprovacoes_pendentes', (SELECT count(*) FROM public.agente_aprovacoes WHERE status = 'pendente'),
    'ultima_atividade', (SELECT greatest(
        (SELECT max(criado_em) FROM public.agente_execucoes),
        (SELECT max(atualizado_em) FROM public.agente_tarefas))),
    'tempo_medio_execucao_ms', (
      SELECT round(avg(extract(epoch FROM (concluido_em - iniciado_em)) * 1000))
        FROM public.agente_execucoes
       WHERE status = 'concluida' AND iniciado_em IS NOT NULL AND concluido_em IS NOT NULL AND concluido_em >= _desde),
    'execucoes_24h', jsonb_build_object(
      'concluidas', (SELECT count(*) FROM public.agente_execucoes WHERE status = 'concluida' AND criado_em >= _desde),
      'falhas', (SELECT count(*) FROM public.agente_execucoes WHERE status = 'falha' AND criado_em >= _desde)),
    'tarefas_recentes', (
      SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.criado_em DESC), '[]'::jsonb)
        FROM (SELECT t.id, t.tipo, t.status, t.tentativas, t.max_tentativas, t.agendado_para,
                     t.ultimo_erro, t.criado_em, t.atualizado_em, a.nome AS agente_nome,
                     t.payload->>'automacao_id' AS automacao_id
                FROM public.agente_tarefas t JOIN public.agentes a ON a.id = t.agente_id
               ORDER BY t.criado_em DESC LIMIT 20) x),
    'alertas', (
      SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.ordem, x.criado_em DESC), '[]'::jsonb)
        FROM (SELECT id, tipo, severidade, titulo, descricao, origem, referencia_tipo, referencia_id,
                     status, criado_em, atualizado_em,
                     CASE severidade WHEN 'critico' THEN 0 WHEN 'aviso' THEN 1 ELSE 2 END AS ordem
                FROM public.agente_alertas WHERE status <> 'resolvido'
               ORDER BY 12, criado_em DESC LIMIT 50) x),
    'atualizado_em', now()
  );
END;
$$;

-- -------------------------------------------------------------- privilégios
REVOKE ALL ON FUNCTION public.agente_agendar_automacoes(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agente_agendar_automacoes(integer) TO service_role;

REVOKE ALL ON FUNCTION public.agente_disparar_evento(text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agente_disparar_evento(text, jsonb, text) TO service_role;

REVOKE ALL ON FUNCTION public.agente_alerta_abrir(text, text, text, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agente_alerta_abrir(text, text, text, text, text, text, text, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.agente_gerar_alertas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agente_gerar_alertas() TO service_role;

REVOKE ALL ON FUNCTION public.agente_heartbeats_manter(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agente_heartbeats_manter(integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.agente_tarefa_resultado_automacao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agente_automacoes_preparar() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.agente_proxima_execucao(text, text, integer, time, integer[], text, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agente_proxima_execucao(text, text, integer, time, integer[], text, timestamptz, timestamptz) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.agente_eventos_permitidos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agente_eventos_permitidos() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.agente_alerta_atualizar_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agente_alerta_atualizar_status(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.agente_automacao_historico(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agente_automacao_historico(uuid, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.agente_monitoramento_resumo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agente_monitoramento_resumo() TO authenticated, service_role;

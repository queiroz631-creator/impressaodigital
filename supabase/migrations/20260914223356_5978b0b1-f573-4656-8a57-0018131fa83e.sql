-- lovable-cron-fallback-reviewed: 96 runs/day; reconciliation backstop only — normal path is event-driven (batch confirmation triggers validation); guards against lost events, stuck queue items and an offline local API. Down from 1440/day.
CREATE TABLE IF NOT EXISTS public.sorteio_sincronizacao_fila (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sequencia bigserial NOT NULL,
  tipo text NOT NULL,
  entidade text NOT NULL,
  entidade_id text NOT NULL,
  sorteio_id uuid NULL REFERENCES public.sorteios(id) ON DELETE CASCADE,
  origem text NOT NULL,
  destino text NOT NULL,
  operacao text NOT NULL,
  operacao_id text NULL,
  status text NOT NULL DEFAULT 'PENDENTE',
  tentativas integer NOT NULL DEFAULT 0,
  ultima_tentativa_em timestamptz NULL,
  processado_em timestamptz NULL,
  erro text NULL,
  metadados jsonb NULL,
  alterado_em timestamptz NOT NULL DEFAULT now(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.sorteio_sincronizacao_fila TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.sorteio_sincronizacao_fila_sequencia_seq TO service_role;
ALTER TABLE public.sorteio_sincronizacao_fila ENABLE ROW LEVEL SECURITY;
-- Sem política: acesso somente pelo servidor (service role).

CREATE UNIQUE INDEX IF NOT EXISTS sorteio_sinc_fila_operacao_unica
  ON public.sorteio_sincronizacao_fila (origem, entidade, operacao_id)
  WHERE operacao_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sorteio_sinc_fila_status_seq
  ON public.sorteio_sincronizacao_fila (status, sequencia);
CREATE INDEX IF NOT EXISTS sorteio_sinc_fila_tipo_status
  ON public.sorteio_sincronizacao_fila (tipo, status);
CREATE INDEX IF NOT EXISTS sorteio_sinc_fila_seq
  ON public.sorteio_sincronizacao_fila (sequencia);

DROP TRIGGER IF EXISTS sorteio_sinc_fila_atualizado_em ON public.sorteio_sincronizacao_fila;
CREATE TRIGGER sorteio_sinc_fila_atualizado_em
  BEFORE UPDATE ON public.sorteio_sincronizacao_fila
  FOR EACH ROW EXECUTE FUNCTION public.sorteio_set_atualizado_em();

CREATE TABLE IF NOT EXISTS public.sorteio_sincronizacao_cursores (
  consumidor text NOT NULL PRIMARY KEY,
  sequencia bigint NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sorteio_sincronizacao_cursores TO service_role;
ALTER TABLE public.sorteio_sincronizacao_cursores ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS sorteio_sinc_cursores_atualizado_em ON public.sorteio_sincronizacao_cursores;
CREATE TRIGGER sorteio_sinc_cursores_atualizado_em
  BEFORE UPDATE ON public.sorteio_sincronizacao_cursores
  FOR EACH ROW EXECUTE FUNCTION public.sorteio_set_atualizado_em();

ALTER TABLE public.sorteio_sincronizacoes
  ADD COLUMN IF NOT EXISTS lote_id text NULL,
  ADD COLUMN IF NOT EXISTS operacao_id text NULL,
  ADD COLUMN IF NOT EXISTS sorteio_id uuid NULL REFERENCES public.sorteios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origem text NULL,
  ADD COLUMN IF NOT EXISTS destino text NULL,
  ADD COLUMN IF NOT EXISTS duracao_ms integer NULL,
  ADD COLUMN IF NOT EXISTS atualizado_em timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS sorteio_sincronizacoes_diag
  ON public.sorteio_sincronizacoes (tipo, status, iniciado_em DESC);
CREATE UNIQUE INDEX IF NOT EXISTS sorteio_sincronizacoes_lote_unico
  ON public.sorteio_sincronizacoes (lote_id)
  WHERE lote_id IS NOT NULL;

DROP TRIGGER IF EXISTS sorteio_sincronizacoes_atualizado_em ON public.sorteio_sincronizacoes;
CREATE TRIGGER sorteio_sincronizacoes_atualizado_em
  BEFORE UPDATE ON public.sorteio_sincronizacoes
  FOR EACH ROW EXECUTE FUNCTION public.sorteio_set_atualizado_em();

DROP POLICY IF EXISTS sorteio_sincronizacoes_leitura ON public.sorteio_sincronizacoes;
DROP POLICY IF EXISTS sorteio_sincronizacoes_insercao ON public.sorteio_sincronizacoes;
DROP POLICY IF EXISTS sorteio_sincronizacoes_atualizacao ON public.sorteio_sincronizacoes;
REVOKE ALL ON public.sorteio_sincronizacoes FROM authenticated, anon;
GRANT ALL ON public.sorteio_sincronizacoes TO service_role;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS origem_id text NULL,
  ADD COLUMN IF NOT EXISTS origem_alteracao text NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clientes_origem_id_unico
  ON public.clientes (origem_id)
  WHERE origem_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.clientes_origem_id_permanente()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.origem_id IS NOT NULL AND NEW.origem_id IS DISTINCT FROM OLD.origem_id THEN
    NEW.origem_id := OLD.origem_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clientes_origem_id_permanente ON public.clientes;
CREATE TRIGGER clientes_origem_id_permanente
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.clientes_origem_id_permanente();

CREATE OR REPLACE FUNCTION public.clientes_enfileirar_para_loja()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _op text;
  _op_id text;
BEGIN
  IF coalesce(NEW.origem_alteracao, 'SUPABASE') = 'LOJA' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    _op := 'CRIACAO';
  ELSE
    IF NEW.nome IS NOT DISTINCT FROM OLD.nome
       AND NEW.cpf IS NOT DISTINCT FROM OLD.cpf
       AND NEW.telefone IS NOT DISTINCT FROM OLD.telefone
       AND NEW.telefone_normalizado IS NOT DISTINCT FROM OLD.telefone_normalizado
       AND NEW.email IS NOT DISTINCT FROM OLD.email
       AND NEW.data_nascimento IS NOT DISTINCT FROM OLD.data_nascimento THEN
      RETURN NEW;
    END IF;
    _op := 'ATUALIZACAO';
  END IF;

  _op_id := 'cliente:' || NEW.id::text;

  INSERT INTO public.sorteio_sincronizacao_fila
    (tipo, entidade, entidade_id, origem, destino, operacao, operacao_id, status, alterado_em, metadados)
  VALUES
    ('CLIENTES_SUPABASE_LOJA', 'CLIENTE', NEW.id::text, 'SUPABASE', 'LOJA', _op, _op_id,
     'PENDENTE', now(), jsonb_build_object('operacao', _op))
  ON CONFLICT (origem, entidade, operacao_id)
  DO UPDATE SET
    status = 'PENDENTE',
    operacao = EXCLUDED.operacao,
    alterado_em = now(),
    erro = NULL,
    processado_em = NULL,
    sequencia = nextval('public.sorteio_sincronizacao_fila_sequencia_seq'),
    atualizado_em = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clientes_enfileirar_para_loja ON public.clientes;
CREATE TRIGGER clientes_enfileirar_para_loja
  AFTER INSERT OR UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.clientes_enfileirar_para_loja();

REVOKE ALL ON FUNCTION public.clientes_enfileirar_para_loja() FROM anon, authenticated;

SELECT cron.unschedule('validar-notas-sorteio')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'validar-notas-sorteio');

SELECT cron.schedule(
  'reconciliar-sincronizacao-sorteios',
  '*/15 * * * *',
  $$select public.disparar_rotina_sorteios('reconciliar');$$
);
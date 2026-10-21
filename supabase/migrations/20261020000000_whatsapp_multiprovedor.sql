-- =====================================================================
-- WhatsApp multiprovedor — Etapa 2 (GERADA, AINDA NÃO APLICADA)
--
-- Migração ADITIVA. Nada é excluído, recriado ou convertido:
--  * as conexões Z-API existentes continuam intactas (credenciais,
--    webhook_token, relacionamentos e identificadores preservados);
--  * toda conexão existente passa a valer provedor = 'zapi' (padrão);
--  * NENHUM segredo é guardado no banco: servidores apontam para o NOME de
--    uma variável de ambiente do backend (segredo_ref), nunca para o valor.
--
-- Rollback (manual, se necessário — só remove o que esta migração criou):
--   DROP FUNCTION IF EXISTS public.whatsapp_eventos_limpar(integer);
--   DROP FUNCTION IF EXISTS public.whatsapp_evento_concluir(uuid, text, text);
--   DROP FUNCTION IF EXISTS public.whatsapp_evento_registrar(uuid, text, text, text, jsonb);
--   DROP FUNCTION IF EXISTS public.whatsapp_conexao_registrar_status(uuid, text, text);
--   DROP TABLE IF EXISTS public.whatsapp_eventos;
--   ALTER TABLE public.whatsapp_conexoes
--     DROP COLUMN IF EXISTS provedor, DROP COLUMN IF EXISTS servidor_id,
--     DROP COLUMN IF EXISTS id_externo, DROP COLUMN IF EXISTS status,
--     DROP COLUMN IF EXISTS status_atualizado_em, DROP COLUMN IF EXISTS ultimo_erro,
--     DROP COLUMN IF EXISTS ultimo_erro_em, DROP COLUMN IF EXISTS config_provedor;
--   DROP TABLE IF EXISTS public.whatsapp_servidores;
-- =====================================================================

-- ------------------------------------------------- servidores por provedor
-- Vários servidores por provedor (ex.: dois servidores Evolution).
CREATE TABLE public.whatsapp_servidores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provedor text NOT NULL CHECK (provedor IN ('zapi', 'evolution')),
  nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 2 AND 80),
  base_url text NOT NULL CHECK (base_url ~* '^https?://[^\s/?#]+'),
  -- NOME da variável de ambiente que guarda a chave do servidor (nunca o valor).
  -- Formato restrito para que ninguém aponte para variáveis alheias
  -- (ex.: SUPABASE_SERVICE_ROLE_KEY).
  segredo_ref text CHECK (segredo_ref IS NULL OR segredo_ref ~ '^EVOLUTION_API_KEY[A-Z0-9_]{0,40}$'),
  ativo boolean NOT NULL DEFAULT true,
  ultimo_teste_em timestamptz,
  ultimo_teste_ok boolean,
  ultimo_erro text,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Servidor Evolution precisa apontar para a chave; a Z-API legada não usa servidor.
  CONSTRAINT whatsapp_servidores_evolution_segredo_check
    CHECK (provedor <> 'evolution' OR segredo_ref IS NOT NULL)
);
CREATE UNIQUE INDEX whatsapp_servidores_url_unica
  ON public.whatsapp_servidores (provedor, lower(rtrim(base_url, '/')));
CREATE TRIGGER whatsapp_servidores_updated_at BEFORE UPDATE ON public.whatsapp_servidores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.whatsapp_servidores ENABLE ROW LEVEL SECURITY;
-- Leitura só para administradores (para a tela de gestão). Escrita: somente
-- backend (service_role), que valida URL/SSRF antes de gravar.
CREATE POLICY whatsapp_servidores_leitura ON public.whatsapp_servidores
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.whatsapp_servidores FROM anon, authenticated;
GRANT SELECT ON public.whatsapp_servidores TO authenticated;
GRANT ALL ON public.whatsapp_servidores TO service_role;

-- ------------------------------------------- whatsapp_conexoes (colunas novas)
ALTER TABLE public.whatsapp_conexoes
  ADD COLUMN IF NOT EXISTS provedor text NOT NULL DEFAULT 'zapi',
  ADD COLUMN IF NOT EXISTS servidor_id uuid REFERENCES public.whatsapp_servidores(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS id_externo text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'desconhecido',
  ADD COLUMN IF NOT EXISTS status_atualizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultimo_erro text,
  ADD COLUMN IF NOT EXISTS ultimo_erro_em timestamptz,
  ADD COLUMN IF NOT EXISTS config_provedor jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.whatsapp_conexoes
  ADD CONSTRAINT whatsapp_conexoes_provedor_check
    CHECK (provedor IN ('zapi', 'evolution')),
  ADD CONSTRAINT whatsapp_conexoes_status_check
    CHECK (status IN ('desconhecido', 'conectado', 'conectando', 'desconectado', 'erro')),
  -- Conexão Evolution precisa de servidor e do nome da instância; as Z-API
  -- existentes (provedor padrão) não são afetadas.
  ADD CONSTRAINT whatsapp_conexoes_evolution_check
    CHECK (provedor <> 'evolution' OR (servidor_id IS NOT NULL AND id_externo IS NOT NULL AND length(trim(id_externo)) > 0));

-- Uma instância externa só pode ser usada por uma conexão (isolamento entre conexões).
CREATE UNIQUE INDEX whatsapp_conexoes_instancia_unica
  ON public.whatsapp_conexoes (servidor_id, id_externo)
  WHERE servidor_id IS NOT NULL AND id_externo IS NOT NULL;
CREATE INDEX whatsapp_conexoes_provedor_idx ON public.whatsapp_conexoes (provedor);

-- ---------------------------------------------------------- whatsapp_eventos
-- Registro de eventos recebidos dos provedores: idempotência (dedup), retentativa
-- e log de erros por conexão. O payload é guardado já SANITIZADO pelo backend.
CREATE TABLE public.whatsapp_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conexao_id uuid NOT NULL REFERENCES public.whatsapp_conexoes(id) ON DELETE CASCADE,
  provedor text NOT NULL CHECK (provedor IN ('zapi', 'evolution')),
  tipo text NOT NULL CHECK (tipo IN (
    'mensagem_recebida', 'mensagem_enviada_fora', 'mensagem_status', 'mensagem_editada',
    'mensagem_revogada', 'conexao_status', 'qr_atualizado', 'desconhecido')),
  -- Chave de idempotência do evento dentro da conexão (ex.: id externo da mensagem + tipo).
  dedup_key text NOT NULL CHECK (length(dedup_key) BETWEEN 1 AND 300),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'recebido'
    CHECK (status IN ('recebido', 'processado', 'ignorado', 'erro')),
  tentativas integer NOT NULL DEFAULT 0 CHECK (tentativas >= 0),
  erro text,
  recebido_em timestamptz NOT NULL DEFAULT now(),
  processado_em timestamptz,
  CONSTRAINT whatsapp_eventos_dedup_unico UNIQUE (conexao_id, dedup_key)
);
CREATE INDEX whatsapp_eventos_conexao_idx ON public.whatsapp_eventos (conexao_id, recebido_em DESC);
CREATE INDEX whatsapp_eventos_pendentes_idx ON public.whatsapp_eventos (status, recebido_em)
  WHERE status IN ('recebido', 'erro');

ALTER TABLE public.whatsapp_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_eventos_leitura ON public.whatsapp_eventos
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.whatsapp_eventos FROM anon, authenticated;
GRANT SELECT ON public.whatsapp_eventos TO authenticated;
GRANT ALL ON public.whatsapp_eventos TO service_role;

-- Registra o evento de forma ATÔMICA e idempotente: o primeiro vence; repetições
-- (webhook duplicado/concorrente) devolvem novo = false, o mesmo id e o status
-- atual — assim o chamador só descarta o que já foi PROCESSADO e reprocessa o
-- que ficou em 'recebido'/'erro' (retentativa quando o provedor reenvia).
CREATE OR REPLACE FUNCTION public.whatsapp_evento_registrar(
  _conexao_id uuid, _provedor text, _tipo text, _dedup_key text, _payload jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE (id uuid, novo boolean, status text, tentativas integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.whatsapp_eventos (conexao_id, provedor, tipo, dedup_key, payload)
  VALUES (_conexao_id, _provedor, _tipo, _dedup_key, coalesce(_payload, '{}'::jsonb))
  ON CONFLICT (conexao_id, dedup_key) DO NOTHING
  RETURNING whatsapp_eventos.id INTO _id;

  IF _id IS NOT NULL THEN
    RETURN QUERY SELECT _id, true, 'recebido'::text, 0;
  ELSE
    RETURN QUERY
      SELECT e.id, false, e.status, e.tentativas FROM public.whatsapp_eventos e
       WHERE e.conexao_id = _conexao_id AND e.dedup_key = _dedup_key;
  END IF;
END;
$$;

-- Conclui o processamento (ou registra erro e conta a tentativa).
CREATE OR REPLACE FUNCTION public.whatsapp_evento_concluir(_id uuid, _status text, _erro text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _status NOT IN ('processado', 'ignorado', 'erro') THEN
    RAISE EXCEPTION 'Status inválido: %', _status;
  END IF;
  UPDATE public.whatsapp_eventos
     SET status = _status,
         erro = CASE WHEN _status = 'erro' THEN left(_erro, 500) ELSE NULL END,
         tentativas = tentativas + CASE WHEN _status = 'erro' THEN 1 ELSE 0 END,
         processado_em = CASE WHEN _status = 'erro' THEN NULL ELSE now() END
   WHERE id = _id;
  RETURN FOUND;
END;
$$;

-- Atualiza status/erro da conexão (usado por testes de conexão e eventos de status).
CREATE OR REPLACE FUNCTION public.whatsapp_conexao_registrar_status(
  _conexao_id uuid, _status text, _erro text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _status NOT IN ('desconhecido', 'conectado', 'conectando', 'desconectado', 'erro') THEN
    RAISE EXCEPTION 'Status inválido: %', _status;
  END IF;
  UPDATE public.whatsapp_conexoes
     SET status = _status,
         status_atualizado_em = now(),
         ultimo_erro = CASE WHEN _status = 'erro' THEN left(_erro, 500) ELSE ultimo_erro END,
         ultimo_erro_em = CASE WHEN _status = 'erro' THEN now() ELSE ultimo_erro_em END
   WHERE id = _conexao_id;
  RETURN FOUND;
END;
$$;

-- Retenção: eventos tratados são apagados após `_dias` (padrão 30); eventos com
-- erro são mantidos por 90 dias para auditoria.
CREATE OR REPLACE FUNCTION public.whatsapp_eventos_limpar(_dias integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _total integer;
BEGIN
  DELETE FROM public.whatsapp_eventos
   WHERE (status IN ('processado', 'ignorado') AND recebido_em < now() - make_interval(days => GREATEST(_dias, 1)))
      OR (status = 'erro' AND recebido_em < now() - interval '90 days');
  GET DIAGNOSTICS _total = ROW_COUNT;
  RETURN _total;
END;
$$;

-- Funções internas: somente o backend (service_role).
REVOKE ALL ON FUNCTION public.whatsapp_evento_registrar(uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_evento_registrar(uuid, text, text, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.whatsapp_evento_concluir(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_evento_concluir(uuid, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.whatsapp_conexao_registrar_status(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_conexao_registrar_status(uuid, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.whatsapp_eventos_limpar(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_eventos_limpar(integer) TO service_role;

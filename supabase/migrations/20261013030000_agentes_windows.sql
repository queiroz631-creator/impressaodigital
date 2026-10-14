-- =====================================================================
-- Central de Agentes — Etapa 2
-- 4/6 — Canal Windows: dispositivos autorizados e comandos locais.
-- Comunicação é iniciada pelo Windows (outbound). Nenhum comando é
-- executado nesta etapa: apenas a estrutura e as políticas.
-- Migração ADITIVA. Não altera a api-local.
-- =====================================================================

-- ---------------------------------------------------- agente_dispositivos
CREATE TABLE public.agente_dispositivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id uuid REFERENCES public.agentes(id) ON DELETE SET NULL,
  nome text NOT NULL,
  token_hash text NOT NULL,
  versao text,
  ultimo_ping timestamptz,
  ativo boolean NOT NULL DEFAULT false,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agente_dispositivos_agente_idx ON public.agente_dispositivos (agente_id);
CREATE INDEX agente_dispositivos_ping_idx ON public.agente_dispositivos (ultimo_ping DESC);
CREATE TRIGGER agente_dispositivos_atualizado_em BEFORE UPDATE ON public.agente_dispositivos
  FOR EACH ROW EXECUTE FUNCTION public.agente_set_atualizado_em();
COMMENT ON COLUMN public.agente_dispositivos.token_hash IS
  'Somente o hash do token do dispositivo é guardado. O valor em claro nunca é persistido nem devolvido.';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agente_dispositivos TO authenticated;
GRANT ALL ON public.agente_dispositivos TO service_role;
ALTER TABLE public.agente_dispositivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY agente_dispositivos_leitura ON public.agente_dispositivos FOR SELECT TO authenticated
  USING (public.pode_agentes('agentes.visualizar'));
-- Gerenciar dispositivos é ação sensível: exige a chave explícita no perfil.
CREATE POLICY agente_dispositivos_insercao ON public.agente_dispositivos FOR INSERT TO authenticated
  WITH CHECK (public.agente_pode_acao('agentes.dispositivos.gerenciar'));
CREATE POLICY agente_dispositivos_atualizacao ON public.agente_dispositivos FOR UPDATE TO authenticated
  USING (public.agente_pode_acao('agentes.dispositivos.gerenciar'))
  WITH CHECK (public.agente_pode_acao('agentes.dispositivos.gerenciar'));
CREATE POLICY agente_dispositivos_exclusao ON public.agente_dispositivos FOR DELETE TO authenticated
  USING (public.agente_pode_acao('agentes.dispositivos.gerenciar'));

-- ------------------------------------------------ agente_comandos_locais
CREATE TABLE public.agente_comandos_locais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispositivo_id uuid NOT NULL REFERENCES public.agente_dispositivos(id) ON DELETE CASCADE,
  execucao_id uuid REFERENCES public.agente_execucoes(id) ON DELETE SET NULL,
  passo_id uuid REFERENCES public.agente_execucao_passos(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sensivel boolean NOT NULL DEFAULT false,
  requer_confirmacao boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','entregue','executando','concluida','falha','indeterminado','expirada')),
  expira_em timestamptz,
  resultado jsonb,
  erro text,
  entregue_em timestamptz,
  concluido_em timestamptz,
  idempotency_key text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agente_comandos_locais_idempotency_unica UNIQUE (idempotency_key)
);
CREATE INDEX agente_comandos_locais_fila_idx ON public.agente_comandos_locais (dispositivo_id, status, criado_em);
CREATE INDEX agente_comandos_locais_execucao_idx ON public.agente_comandos_locais (execucao_id);
CREATE TRIGGER agente_comandos_locais_atualizado_em BEFORE UPDATE ON public.agente_comandos_locais
  FOR EACH ROW EXECUTE FUNCTION public.agente_set_atualizado_em();
COMMENT ON TABLE public.agente_comandos_locais IS
  'Tabela interna. Sem acesso direto do navegador; entregue ao Windows por long-poll.';
GRANT ALL ON public.agente_comandos_locais TO service_role;
ALTER TABLE public.agente_comandos_locais ENABLE ROW LEVEL SECURITY;
-- Sem políticas para authenticated: acesso negado por padrão.

-- -------------------------------------------------- reforço de privilégios
REVOKE ALL ON public.agente_dispositivos FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.agente_dispositivos FROM authenticated;
-- Fila de comandos locais é interna: nem anon nem authenticated acessam.
REVOKE ALL ON public.agente_comandos_locais FROM anon;
REVOKE ALL ON public.agente_comandos_locais FROM authenticated;

-- =====================================================================
-- Central de Agentes — Etapa 2
-- 5/6 — Automações e auditoria.
-- Migração ADITIVA.
-- =====================================================================

-- ------------------------------------------------------ agente_automacoes
CREATE TABLE public.agente_automacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id uuid NOT NULL REFERENCES public.agentes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo_gatilho text NOT NULL CHECK (tipo_gatilho IN ('agendado','evento')),
  cron text,
  evento text,
  condicoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  acao jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT false,
  ultima_execucao_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agente_automacoes_gatilho_check CHECK (
    (tipo_gatilho = 'agendado' AND cron IS NOT NULL AND length(trim(cron)) > 0)
    OR (tipo_gatilho = 'evento' AND evento IS NOT NULL AND length(trim(evento)) > 0)
  )
);
CREATE INDEX agente_automacoes_agente_idx ON public.agente_automacoes (agente_id);
CREATE INDEX agente_automacoes_ativas_idx ON public.agente_automacoes (ativo, tipo_gatilho);
CREATE TRIGGER agente_automacoes_atualizado_em BEFORE UPDATE ON public.agente_automacoes
  FOR EACH ROW EXECUTE FUNCTION public.agente_set_atualizado_em();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agente_automacoes TO authenticated;
GRANT ALL ON public.agente_automacoes TO service_role;
ALTER TABLE public.agente_automacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY agente_automacoes_leitura ON public.agente_automacoes FOR SELECT TO authenticated
  USING (public.pode_agentes('agentes.visualizar'));
CREATE POLICY agente_automacoes_gestao ON public.agente_automacoes FOR ALL TO authenticated
  USING (public.pode_agentes('agentes.gerenciar'))
  WITH CHECK (public.pode_agentes('agentes.gerenciar'));

-- ------------------------------------------------------- agente_auditoria
-- Registro append-only de operações sensíveis. O authenticated recebe
-- apenas SELECT e nenhuma política de escrita; a gravação ocorre por
-- funções SECURITY DEFINER ou service_role.
CREATE TABLE public.agente_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id uuid REFERENCES public.agentes(id) ON DELETE SET NULL,
  execucao_id uuid REFERENCES public.agente_execucoes(id) ON DELETE SET NULL,
  usuario_id uuid,
  acao text NOT NULL,
  entidade text,
  entidade_id text,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agente_auditoria_criado_idx ON public.agente_auditoria (criado_em DESC);
CREATE INDEX agente_auditoria_acao_idx ON public.agente_auditoria (acao, criado_em DESC);
CREATE INDEX agente_auditoria_execucao_idx ON public.agente_auditoria (execucao_id);
CREATE INDEX agente_auditoria_agente_idx ON public.agente_auditoria (agente_id, criado_em DESC);
COMMENT ON TABLE public.agente_auditoria IS
  'Somente inclusão. Sem políticas/grants de UPDATE ou DELETE.';
GRANT SELECT ON public.agente_auditoria TO authenticated;
GRANT ALL ON public.agente_auditoria TO service_role;
ALTER TABLE public.agente_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY agente_auditoria_leitura ON public.agente_auditoria FOR SELECT TO authenticated
  USING (public.pode_agentes('agentes.visualizar'));

-- -------------------------------------------------- reforço de privilégios
REVOKE ALL ON public.agente_automacoes FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.agente_automacoes FROM authenticated;
-- Auditoria é somente inclusão: authenticated lê, mas não escreve.
REVOKE ALL ON public.agente_auditoria FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.agente_auditoria FROM authenticated;

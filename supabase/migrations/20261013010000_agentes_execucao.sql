-- =====================================================================
-- Central de Agentes — Etapa 2
-- 2/6 — Execuções, passos, aprovações, mensagens entre agentes e
--       controle de idempotência por execução de ferramenta.
-- Migração ADITIVA.
-- =====================================================================

-- ------------------------------------------------------ agente_execucoes
CREATE TABLE public.agente_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id uuid NOT NULL REFERENCES public.agentes(id) ON DELETE RESTRICT,
  origem text NOT NULL DEFAULT 'usuario'
    CHECK (origem IN ('usuario','whatsapp','automacao','agente','api','manual')),
  parent_execucao_id uuid REFERENCES public.agente_execucoes(id) ON DELETE SET NULL,
  profundidade integer NOT NULL DEFAULT 0 CHECK (profundidade >= 0),
  usuario_id uuid,
  conversa_id uuid REFERENCES public.whatsapp_conversas(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','executando','aguardando_aprovacao','aguardando_reconciliacao',
                      'concluida','falha','cancelada','indeterminado')),
  entrada jsonb NOT NULL DEFAULT '{}'::jsonb,
  saida jsonb,
  erro text,
  idempotency_key text,
  modelo_usado text,
  tokens_entrada integer NOT NULL DEFAULT 0 CHECK (tokens_entrada >= 0),
  tokens_saida integer NOT NULL DEFAULT 0 CHECK (tokens_saida >= 0),
  custo_estimado numeric(14,6) CHECK (custo_estimado IS NULL OR custo_estimado >= 0),
  iniciado_em timestamptz,
  concluido_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agente_execucoes_idempotency_unica UNIQUE (idempotency_key)
);
CREATE INDEX agente_execucoes_agente_idx ON public.agente_execucoes (agente_id, criado_em DESC);
CREATE INDEX agente_execucoes_status_idx ON public.agente_execucoes (status, criado_em DESC);
CREATE INDEX agente_execucoes_usuario_idx ON public.agente_execucoes (usuario_id, criado_em DESC);
CREATE TRIGGER agente_execucoes_atualizado_em BEFORE UPDATE ON public.agente_execucoes
  FOR EACH ROW EXECUTE FUNCTION public.agente_set_atualizado_em();
GRANT SELECT ON public.agente_execucoes TO authenticated;
GRANT ALL ON public.agente_execucoes TO service_role;
ALTER TABLE public.agente_execucoes ENABLE ROW LEVEL SECURITY;
-- Escrita somente por service_role / funções SECURITY DEFINER.
CREATE POLICY agente_execucoes_leitura ON public.agente_execucoes FOR SELECT TO authenticated
  USING (public.pode_agentes('agentes.visualizar') OR usuario_id = auth.uid());

-- ------------------------------------------------- agente_execucao_passos
CREATE TABLE public.agente_execucao_passos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id uuid NOT NULL REFERENCES public.agente_execucoes(id) ON DELETE CASCADE,
  ordem integer NOT NULL CHECK (ordem >= 0),
  tipo text NOT NULL CHECK (tipo IN ('ia','ferramenta')),
  ferramenta_id uuid REFERENCES public.agente_ferramentas(id) ON DELETE SET NULL,
  descricao text NOT NULL DEFAULT '',
  parametros jsonb NOT NULL DEFAULT '{}'::jsonb,
  parametros_hash text,
  resultado jsonb,
  erro text,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','executando','aguardando_aprovacao','aguardando_reconciliacao',
                      'concluido','falha','cancelado')),
  tentativas integer NOT NULL DEFAULT 0 CHECK (tentativas >= 0),
  iniciado_em timestamptz,
  concluido_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agente_execucao_passos_unico UNIQUE (execucao_id, ordem)
);
CREATE INDEX agente_execucao_passos_execucao_idx ON public.agente_execucao_passos (execucao_id, ordem);
CREATE INDEX agente_execucao_passos_status_idx ON public.agente_execucao_passos (status);
CREATE INDEX agente_execucao_passos_ferramenta_idx ON public.agente_execucao_passos (ferramenta_id);
CREATE TRIGGER agente_execucao_passos_atualizado_em BEFORE UPDATE ON public.agente_execucao_passos
  FOR EACH ROW EXECUTE FUNCTION public.agente_set_atualizado_em();
GRANT SELECT ON public.agente_execucao_passos TO authenticated;
GRANT ALL ON public.agente_execucao_passos TO service_role;
ALTER TABLE public.agente_execucao_passos ENABLE ROW LEVEL SECURITY;
CREATE POLICY agente_execucao_passos_leitura ON public.agente_execucao_passos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.agente_execucoes e
     WHERE e.id = execucao_id
       AND (public.pode_agentes('agentes.visualizar') OR e.usuario_id = auth.uid())
  ));

-- ----------------------------------------------------- agente_aprovacoes
CREATE TABLE public.agente_aprovacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id uuid NOT NULL REFERENCES public.agente_execucoes(id) ON DELETE CASCADE,
  passo_id uuid REFERENCES public.agente_execucao_passos(id) ON DELETE CASCADE,
  parametros jsonb NOT NULL DEFAULT '{}'::jsonb,
  parametros_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','aprovada','recusada','expirada')),
  solicitado_por uuid,
  solicitado_em timestamptz NOT NULL DEFAULT now(),
  decidido_por uuid,
  decidido_em timestamptz,
  motivo text,
  expira_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agente_aprovacoes_status_idx ON public.agente_aprovacoes (status, solicitado_em DESC);
CREATE INDEX agente_aprovacoes_execucao_idx ON public.agente_aprovacoes (execucao_id);
-- Impede duas aprovações pendentes para o mesmo passo.
CREATE UNIQUE INDEX agente_aprovacoes_pendente_unica ON public.agente_aprovacoes (passo_id)
  WHERE status = 'pendente' AND passo_id IS NOT NULL;
CREATE TRIGGER agente_aprovacoes_atualizado_em BEFORE UPDATE ON public.agente_aprovacoes
  FOR EACH ROW EXECUTE FUNCTION public.agente_set_atualizado_em();
COMMENT ON COLUMN public.agente_aprovacoes.parametros_hash IS
  'md5 (agente_hash_parametros) dos parâmetros exatos. A decisão é recusada se os parâmetros mudarem.';
GRANT SELECT ON public.agente_aprovacoes TO authenticated;
GRANT ALL ON public.agente_aprovacoes TO service_role;
ALTER TABLE public.agente_aprovacoes ENABLE ROW LEVEL SECURITY;
-- Decisões somente via public.agente_decidir_aprovacao (SECURITY DEFINER).
CREATE POLICY agente_aprovacoes_leitura ON public.agente_aprovacoes FOR SELECT TO authenticated
  USING (public.pode_agentes('agentes.visualizar'));

-- ------------------------------------------------------- agente_mensagens
CREATE TABLE public.agente_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id uuid REFERENCES public.agente_execucoes(id) ON DELETE CASCADE,
  de_agente_id uuid NOT NULL REFERENCES public.agentes(id) ON DELETE CASCADE,
  para_agente_id uuid NOT NULL REFERENCES public.agentes(id) ON DELETE CASCADE,
  conteudo jsonb NOT NULL DEFAULT '{}'::jsonb,
  profundidade integer NOT NULL DEFAULT 0 CHECK (profundidade >= 0),
  lida_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agente_mensagens_nao_autochamada CHECK (de_agente_id <> para_agente_id)
);
CREATE INDEX agente_mensagens_execucao_idx ON public.agente_mensagens (execucao_id, criado_em);
CREATE INDEX agente_mensagens_para_idx ON public.agente_mensagens (para_agente_id, lida_em);
GRANT SELECT ON public.agente_mensagens TO authenticated;
GRANT ALL ON public.agente_mensagens TO service_role;
ALTER TABLE public.agente_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY agente_mensagens_leitura ON public.agente_mensagens FOR SELECT TO authenticated
  USING (
    public.pode_agentes('agentes.visualizar')
    OR EXISTS (
      SELECT 1 FROM public.agente_execucoes e
       WHERE e.id = execucao_id AND e.usuario_id = auth.uid()
    )
  );

-- --------------------------------------------------- agente_idempotencia
-- Controle de idempotência por execução de ferramenta. Efeitos externos
-- (impressão, WhatsApp, alterações de dados) usam uma chave única. Quando o
-- resultado externo é indeterminado, o status fica 'indeterminado' e a
-- operação aguarda reconciliação — nunca é repetida automaticamente.
CREATE TABLE public.agente_idempotencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL,
  escopo text NOT NULL DEFAULT 'geral',
  agente_id uuid REFERENCES public.agentes(id) ON DELETE SET NULL,
  execucao_id uuid REFERENCES public.agente_execucoes(id) ON DELETE SET NULL,
  passo_id uuid REFERENCES public.agente_execucao_passos(id) ON DELETE SET NULL,
  ferramenta_id uuid REFERENCES public.agente_ferramentas(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'iniciado'
    CHECK (status IN ('iniciado','concluido','indeterminado','reconciliado','falha')),
  resultado jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz,
  CONSTRAINT agente_idempotencia_chave_unica UNIQUE (chave)
);
CREATE INDEX agente_idempotencia_status_idx ON public.agente_idempotencia (status, atualizado_em DESC);
CREATE INDEX agente_idempotencia_escopo_idx ON public.agente_idempotencia (escopo, criado_em DESC);
CREATE TRIGGER agente_idempotencia_atualizado_em BEFORE UPDATE ON public.agente_idempotencia
  FOR EACH ROW EXECUTE FUNCTION public.agente_set_atualizado_em();
COMMENT ON TABLE public.agente_idempotencia IS
  'Tabela interna. Sem acesso direto do navegador; uso exclusivo do worker/funções.';
GRANT ALL ON public.agente_idempotencia TO service_role;
ALTER TABLE public.agente_idempotencia ENABLE ROW LEVEL SECURITY;
-- Sem políticas para authenticated: acesso negado por padrão.

-- -------------------------------------------------- reforço de privilégios
-- Removemos os privilégios padrão concedidos a anon/authenticated.
-- Execuções/passos/aprovações/mensagens: somente leitura para authenticated.
REVOKE ALL ON public.agente_execucoes FROM anon;
REVOKE ALL ON public.agente_execucao_passos FROM anon;
REVOKE ALL ON public.agente_aprovacoes FROM anon;
REVOKE ALL ON public.agente_mensagens FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.agente_execucoes FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.agente_execucao_passos FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.agente_aprovacoes FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.agente_mensagens FROM authenticated;
-- Idempotência: sem acesso algum por authenticated/anon.
REVOKE ALL ON public.agente_idempotencia FROM anon;
REVOKE ALL ON public.agente_idempotencia FROM authenticated;

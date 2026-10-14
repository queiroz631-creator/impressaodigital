-- =====================================================================
-- Central de Agentes — Etapa 2 (infraestrutura e banco de dados)
-- 1/6 — Núcleo: permissões auxiliares, agentes, versões e ferramentas.
-- Migração ADITIVA: não altera nenhuma tabela existente.
-- =====================================================================

-- ---------------------------------------------------------- permissões
-- Leitura/gestão de configuração: administrador OU permissão no perfil.
-- A autorização administrativa NÃO concede, por si só, execução de
-- ferramentas (ver public.agente_pode_acao).
CREATE OR REPLACE FUNCTION public.pode_agentes(_chave text DEFAULT 'agentes.visualizar')
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR public.tem_permissao(auth.uid(), _chave)
$$;
REVOKE ALL ON FUNCTION public.pode_agentes(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_agentes(text) TO authenticated, service_role;
COMMENT ON FUNCTION public.pode_agentes(text) IS
  'Leitura/gestão da Central de Agentes. Não concede execução de ferramentas.';

-- Ações sensíveis (executar / aprovar / gerenciar dispositivos) exigem a
-- chave explícita no perfil: administrador não recebe isso automaticamente.
CREATE OR REPLACE FUNCTION public.agente_pode_acao(_chave text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles p
      JOIN public.perfis_acesso a ON a.id = p.perfil_id
     WHERE p.id = auth.uid()
       AND p.ativo
       AND a.ativo
       AND a.permissoes ? _chave
  )
$$;
REVOKE ALL ON FUNCTION public.agente_pode_acao(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agente_pode_acao(text) TO authenticated, service_role;
COMMENT ON FUNCTION public.agente_pode_acao(text) IS
  'Verificação de ação sensível sem atalho de administrador.';

-- Hash canônico dos parâmetros de uma ação (detecção de alteração).
CREATE OR REPLACE FUNCTION public.agente_hash_parametros(_parametros jsonb)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT md5(coalesce(_parametros, '{}'::jsonb)::text) $$;
REVOKE ALL ON FUNCTION public.agente_hash_parametros(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agente_hash_parametros(jsonb) TO authenticated, service_role;

-- --------------------------------------------------- atualizado_em
CREATE OR REPLACE FUNCTION public.agente_set_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.atualizado_em = now(); RETURN NEW; END; $$;

-- ------------------------------------------------------------- agentes
CREATE TABLE public.agentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'personalizado'
    CHECK (tipo IN ('atendimento','operacional','operador_computador','personalizado')),
  descricao text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT false,
  icone text NOT NULL DEFAULT 'Bot',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  modelo text,
  temperatura numeric(3,2) CHECK (temperatura IS NULL OR (temperatura >= 0 AND temperatura <= 2)),
  system_prompt_atual_id uuid,
  rota_painel text,
  ordem integer NOT NULL DEFAULT 0,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agentes_chave_unica UNIQUE (chave)
);
COMMENT ON COLUMN public.agentes.config IS
  'Configuração não sensível. NUNCA guardar credenciais: use ia_credenciais.';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agentes TO authenticated;
GRANT ALL ON public.agentes TO service_role;
ALTER TABLE public.agentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY agentes_leitura ON public.agentes FOR SELECT TO authenticated
  USING (public.pode_agentes('agentes.visualizar'));
CREATE POLICY agentes_gestao ON public.agentes FOR ALL TO authenticated
  USING (public.pode_agentes('agentes.gerenciar'))
  WITH CHECK (public.pode_agentes('agentes.gerenciar'));
CREATE TRIGGER agentes_atualizado_em BEFORE UPDATE ON public.agentes
  FOR EACH ROW EXECUTE FUNCTION public.agente_set_atualizado_em();

-- ------------------------------------------------------ agente_versoes
CREATE TABLE public.agente_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id uuid NOT NULL REFERENCES public.agentes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('prompt','config')),
  versao integer NOT NULL CHECK (versao > 0),
  conteudo jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT false,
  observacao text NOT NULL DEFAULT '',
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agente_versoes_unica UNIQUE (agente_id, tipo, versao)
);
CREATE UNIQUE INDEX agente_versoes_ativa_unica ON public.agente_versoes (agente_id, tipo) WHERE ativo;
CREATE INDEX agente_versoes_agente_idx ON public.agente_versoes (agente_id, tipo, versao DESC);
COMMENT ON COLUMN public.agente_versoes.conteudo IS
  'Prompt/config versionado. Nunca guardar credenciais aqui.';
ALTER TABLE public.agentes
  ADD CONSTRAINT agentes_prompt_atual_fk
  FOREIGN KEY (system_prompt_atual_id) REFERENCES public.agente_versoes(id) ON DELETE SET NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agente_versoes TO authenticated;
GRANT ALL ON public.agente_versoes TO service_role;
ALTER TABLE public.agente_versoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY agente_versoes_leitura ON public.agente_versoes FOR SELECT TO authenticated
  USING (public.pode_agentes('agentes.visualizar'));
CREATE POLICY agente_versoes_gestao ON public.agente_versoes FOR ALL TO authenticated
  USING (public.pode_agentes('agentes.gerenciar'))
  WITH CHECK (public.pode_agentes('agentes.gerenciar'));

-- -------------------------------------------------- agente_ferramentas
CREATE TABLE public.agente_ferramentas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL,
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT 'geral',
  tipo text NOT NULL DEFAULT 'consulta' CHECK (tipo IN ('consulta','acao')),
  risco text NOT NULL DEFAULT 'baixo' CHECK (risco IN ('baixo','medio','alto')),
  sensivel boolean NOT NULL DEFAULT false,
  efeito_externo boolean NOT NULL DEFAULT false,
  idempotente boolean NOT NULL DEFAULT true,
  parametros_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  resultado_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agente_ferramentas_chave_unica UNIQUE (chave)
);
COMMENT ON COLUMN public.agente_ferramentas.efeito_externo IS
  'true = efeito fora do banco (impressão/WhatsApp/arquivos). Exige chave de idempotência.';
CREATE TRIGGER agente_ferramentas_atualizado_em BEFORE UPDATE ON public.agente_ferramentas
  FOR EACH ROW EXECUTE FUNCTION public.agente_set_atualizado_em();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agente_ferramentas TO authenticated;
GRANT ALL ON public.agente_ferramentas TO service_role;
ALTER TABLE public.agente_ferramentas ENABLE ROW LEVEL SECURITY;
CREATE POLICY agente_ferramentas_leitura ON public.agente_ferramentas FOR SELECT TO authenticated
  USING (public.pode_agentes('agentes.visualizar'));
CREATE POLICY agente_ferramentas_gestao ON public.agente_ferramentas FOR ALL TO authenticated
  USING (public.pode_agentes('agentes.gerenciar'))
  WITH CHECK (public.pode_agentes('agentes.gerenciar'));

-- ----------------------------------------- agente_ferramenta_vinculos
CREATE TABLE public.agente_ferramenta_vinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id uuid NOT NULL REFERENCES public.agentes(id) ON DELETE CASCADE,
  ferramenta_id uuid NOT NULL REFERENCES public.agente_ferramentas(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agente_ferramenta_vinculos_unico UNIQUE (agente_id, ferramenta_id)
);
CREATE INDEX agente_ferramenta_vinculos_ferramenta_idx ON public.agente_ferramenta_vinculos (ferramenta_id);
CREATE TRIGGER agente_ferramenta_vinculos_atualizado_em BEFORE UPDATE ON public.agente_ferramenta_vinculos
  FOR EACH ROW EXECUTE FUNCTION public.agente_set_atualizado_em();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agente_ferramenta_vinculos TO authenticated;
GRANT ALL ON public.agente_ferramenta_vinculos TO service_role;
ALTER TABLE public.agente_ferramenta_vinculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY agente_ferramenta_vinculos_leitura ON public.agente_ferramenta_vinculos FOR SELECT TO authenticated
  USING (public.pode_agentes('agentes.visualizar'));
CREATE POLICY agente_ferramenta_vinculos_gestao ON public.agente_ferramenta_vinculos FOR ALL TO authenticated
  USING (public.pode_agentes('agentes.gerenciar'))
  WITH CHECK (public.pode_agentes('agentes.gerenciar'));

-- -------------------------------------------------- reforço de privilégios
-- O Supabase concede ALL em novas tabelas a anon/authenticated por padrão
-- (privilégios padrão do papel postgres). O RLS já bloqueia linhas, mas
-- removemos o excesso: `anon` nunca acessa a Central diretamente e
-- `authenticated` não recebe TRUNCATE/REFERENCES/TRIGGER.
-- TRUNCATE não é protegido por RLS; por isso a revogação é obrigatória.
REVOKE ALL ON public.agentes FROM anon;
REVOKE ALL ON public.agente_versoes FROM anon;
REVOKE ALL ON public.agente_ferramentas FROM anon;
REVOKE ALL ON public.agente_ferramenta_vinculos FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.agentes FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.agente_versoes FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.agente_ferramentas FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.agente_ferramenta_vinculos FROM authenticated;

-- -------------------------------------------------------------- seed
-- Agentes previstos na arquitetura. Inativos por padrão: nada é executado
-- enquanto um administrador não ativar. Sem prompts/credenciais fabricados.
INSERT INTO public.agentes (chave, nome, tipo, descricao, ativo, icone, rota_painel, ordem)
VALUES
  ('atendimento', 'Agente de Atendimento', 'atendimento',
   'Atende conversas do WhatsApp com contexto do cliente e do catálogo (somente leitura via Lojamix).',
   false, 'MessageCircle', '/agentes', 1),
  ('operacional', 'Agente Operacional', 'operacional',
   'Acompanha rotinas internas, orçamentos e avisos operacionais do dia a dia.',
   false, 'Activity', '/agentes', 2),
  ('operador_computador', 'Operador de Computador', 'operador_computador',
   'Executa comandos locais no Windows (impressão, arquivos) via dispositivo autorizado.',
   false, 'MonitorCog', '/agentes', 3)
ON CONFLICT (chave) DO NOTHING;

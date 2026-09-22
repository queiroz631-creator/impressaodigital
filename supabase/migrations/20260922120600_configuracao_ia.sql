-- Configuração do provedor de IA usado pelo sistema (currículos, bot, transcrição).
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS ia_provedor text NOT NULL DEFAULT 'lovable_openai',
  ADD COLUMN IF NOT EXISTS ia_modelo text,
  ADD COLUMN IF NOT EXISTS ia_modelo_audio text;

ALTER TABLE public.configuracoes
  DROP CONSTRAINT IF EXISTS configuracoes_ia_provedor_check;

ALTER TABLE public.configuracoes
  ADD CONSTRAINT configuracoes_ia_provedor_check
  CHECK (ia_provedor IN ('lovable_openai', 'lovable_gemini', 'openai_proprio', 'gemini_proprio'));

-- Cofre das chaves próprias: acessível somente pelo servidor (service_role).
CREATE TABLE IF NOT EXISTS public.ia_credenciais (
  provedor text PRIMARY KEY,
  chave text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);

GRANT ALL ON public.ia_credenciais TO service_role;

ALTER TABLE public.ia_credenciais ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.ia_credenciais IS
  'Chaves de API de IA informadas pelo administrador. Sem políticas RLS: leitura/gravação apenas por service_role no servidor.';

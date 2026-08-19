ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS impressora_padrao_nome text,
  ADD COLUMN IF NOT EXISTS impressora_padrao_tipo text NOT NULL DEFAULT 'navegador',
  ADD COLUMN IF NOT EXISTS impressora_padrao_largura integer NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS impressoras_padrao jsonb NOT NULL DEFAULT '[]'::jsonb;
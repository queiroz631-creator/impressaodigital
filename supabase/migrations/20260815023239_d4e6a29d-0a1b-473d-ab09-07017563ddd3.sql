ALTER TABLE public.materiais
  ADD COLUMN IF NOT EXISTS preco_por_arquivo numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS faixas jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.materiais
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'impressao';

ALTER TABLE public.materiais
  DROP CONSTRAINT IF EXISTS materiais_categoria_check;

ALTER TABLE public.materiais
  ADD CONSTRAINT materiais_categoria_check CHECK (categoria IN ('impressao','copia'));

UPDATE public.materiais SET categoria = 'impressao' WHERE categoria IS NULL OR categoria NOT IN ('impressao','copia');
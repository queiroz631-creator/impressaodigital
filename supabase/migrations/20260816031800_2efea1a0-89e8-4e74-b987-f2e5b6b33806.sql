ALTER TABLE public.materiais ADD COLUMN IF NOT EXISTS formato text NOT NULL DEFAULT 'A4';
ALTER TABLE public.acabamentos ADD COLUMN IF NOT EXISTS mostrar_no_orcamento boolean NOT NULL DEFAULT true;
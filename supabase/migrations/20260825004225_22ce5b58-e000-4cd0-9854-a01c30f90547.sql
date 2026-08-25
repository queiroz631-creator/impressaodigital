ALTER TABLE public.curriculos
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS experiencia_possui boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS experiencia_frase text,
  ADD COLUMN IF NOT EXISTS habilidades_observacao text;
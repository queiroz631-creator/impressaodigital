ALTER TABLE public.curriculos
  ADD COLUMN IF NOT EXISTS foto_url text,
  ADD COLUMN IF NOT EXISTS foto_exibir boolean NOT NULL DEFAULT false;
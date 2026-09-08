ALTER TABLE public.whatsapp_mensagens
  ADD COLUMN IF NOT EXISTS editada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS editada_em timestamptz,
  ADD COLUMN IF NOT EXISTS texto_original text,
  ADD COLUMN IF NOT EXISTS apagada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS apagada_em timestamptz;
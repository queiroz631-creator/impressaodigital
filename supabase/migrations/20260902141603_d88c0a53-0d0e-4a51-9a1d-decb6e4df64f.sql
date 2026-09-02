ALTER TABLE public.whatsapp_conversas ADD COLUMN IF NOT EXISTS chat_lid text;
CREATE INDEX IF NOT EXISTS whatsapp_conversas_chat_lid_idx ON public.whatsapp_conversas (chat_lid);
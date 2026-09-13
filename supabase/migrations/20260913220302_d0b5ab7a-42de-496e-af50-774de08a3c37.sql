ALTER TABLE public.whatsapp_conversas DROP CONSTRAINT IF EXISTS whatsapp_conversas_telefone_key;
DROP INDEX IF EXISTS public.whatsapp_conversas_telefone_key;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversas_telefone_conexao_key
  ON public.whatsapp_conversas (telefone, conexao_id);
CREATE INDEX IF NOT EXISTS whatsapp_conversas_conexao_idx
  ON public.whatsapp_conversas (conexao_id);
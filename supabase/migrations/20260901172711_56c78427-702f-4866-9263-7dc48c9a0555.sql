ALTER TABLE public.whatsapp_conversas
  ADD COLUMN IF NOT EXISTS bot_pendente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bot_pendente_em timestamptz;

CREATE INDEX IF NOT EXISTS whatsapp_conversas_bot_pendente_idx
  ON public.whatsapp_conversas (bot_pendente_em)
  WHERE bot_pendente;

CREATE OR REPLACE FUNCTION public.disparar_fila_bot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t text;
BEGIN
  IF NEW.bot_pendente IS NOT TRUE THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.bot_pendente IS TRUE THEN RETURN NEW; END IF;

  SELECT webhook_token INTO t FROM public.whatsapp_config LIMIT 1;
  IF t IS NULL OR t = '' THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url := 'https://project--794a07c8-8935-4198-8eda-84887ff3d9f1.lovable.app/api/public/whatsapp/fila?token=' || t,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS whatsapp_conversas_fila_bot ON public.whatsapp_conversas;
CREATE TRIGGER whatsapp_conversas_fila_bot
AFTER INSERT OR UPDATE OF bot_pendente ON public.whatsapp_conversas
FOR EACH ROW EXECUTE FUNCTION public.disparar_fila_bot();
-- Executar no banco da VPS (self-hosted) para habilitar o campo
-- "Endereço do sistema" em Configurações → WhatsApp e as rotinas do bot.
--
--   docker exec -i supabase-db psql -U postgres -d postgres < vps-bot-endereco.sql
--
-- Seguro para rodar mais de uma vez.

ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS app_url text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.disparar_rotina_bot(rota text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t text;
  base text;
BEGIN
  SELECT webhook_token, coalesce(nullif(btrim(app_url), ''), 'https://impressaodigital.lovable.app')
    INTO t, base
  FROM public.whatsapp_config
  LIMIT 1;

  IF t IS NULL OR t = '' THEN RETURN; END IF;

  base := regexp_replace(base, '/+$', '');

  PERFORM net.http_post(
    url := base || '/api/public/whatsapp/' || rota || '?token=' || t,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.disparar_rotina_bot(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.disparar_fila_bot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.bot_pendente IS NOT TRUE THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.bot_pendente IS TRUE THEN RETURN NEW; END IF;

  PERFORM public.disparar_rotina_bot('fila');
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS whatsapp_conversas_fila_bot ON public.whatsapp_conversas;
CREATE TRIGGER whatsapp_conversas_fila_bot
  AFTER INSERT OR UPDATE ON public.whatsapp_conversas
  FOR EACH ROW EXECUTE FUNCTION public.disparar_fila_bot();

-- Rotinas periódicas (inatividade e status do WhatsApp).
SELECT cron.unschedule(jobname) FROM cron.job
 WHERE jobname IN ('whatsapp-inatividade', 'publicar-status-whatsapp');

SELECT cron.schedule('whatsapp-inatividade', '* * * * *',
  $$SELECT public.disparar_rotina_bot('inatividade')$$);

SELECT cron.schedule('publicar-status-whatsapp', '*/5 * * * *',
  $$SELECT public.disparar_rotina_bot('status')$$);

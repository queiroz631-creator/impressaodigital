ALTER TABLE public.whatsapp_config ADD COLUMN IF NOT EXISTS app_url text NOT NULL DEFAULT '';

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
  SELECT webhook_token, coalesce(nullif(btrim(app_url), ''), 'https://project--794a07c8-8935-4198-8eda-84887ff3d9f1.lovable.app')
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
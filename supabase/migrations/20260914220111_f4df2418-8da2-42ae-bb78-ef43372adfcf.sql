ALTER TABLE public.sorteio_notas_base
  ADD COLUMN IF NOT EXISTS sorteio_id uuid NOT NULL REFERENCES public.sorteios(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.sorteio_notas_base.sorteio_id IS 'Sorteio a que a nota da base pertence. A validação só compara notas do mesmo sorteio.';

CREATE UNIQUE INDEX IF NOT EXISTS sorteio_notas_base_numero_unico
  ON public.sorteio_notas_base (sorteio_id, numero);

CREATE INDEX IF NOT EXISTS sorteio_notas_base_validacao_idx
  ON public.sorteio_notas_base (sorteio_id, numero, valor_centavos);

ALTER TABLE public.sorteios
  ADD COLUMN IF NOT EXISTS base_sincronizada_em timestamptz;

COMMENT ON COLUMN public.sorteios.base_sincronizada_em IS 'Última sincronização da base de notas deste sorteio. Nota ausente na base só vira INVALIDA se esta data for posterior ao cadastro da nota.';

CREATE OR REPLACE FUNCTION public.disparar_rotina_sorteios(rota text)
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
    url := base || '/api/public/sorteios/' || rota || '?token=' || t,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.disparar_rotina_sorteios(text) FROM anon, authenticated;
ALTER TABLE public.sorteio_termos
  ADD COLUMN IF NOT EXISTS titulo text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS atual boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sorteio_termos.titulo IS 'Título da versão dos termos (opcional).';
COMMENT ON COLUMN public.sorteio_termos.atual IS 'Versão vigente do sorteio. No máximo uma por sorteio (índice único parcial).';

CREATE UNIQUE INDEX IF NOT EXISTS sorteio_termos_atual_unico
  ON public.sorteio_termos (sorteio_id)
  WHERE atual;

CREATE OR REPLACE FUNCTION public.sorteio_definir_termos_atual(_termos_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sorteio_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin')
          OR public.tem_permissao(auth.uid(), 'sorteios.gerenciar')) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar sorteios';
  END IF;

  SELECT sorteio_id INTO _sorteio_id
  FROM public.sorteio_termos
  WHERE id = _termos_id;

  IF _sorteio_id IS NULL THEN
    RAISE EXCEPTION 'Versão de termos não encontrada';
  END IF;

  -- Atômico: desmarca a versão anterior e marca a nova na mesma transação.
  UPDATE public.sorteio_termos
     SET atual = false
   WHERE sorteio_id = _sorteio_id AND atual AND id <> _termos_id;

  UPDATE public.sorteio_termos
     SET atual = true, publicado_em = COALESCE(publicado_em, now())
   WHERE id = _termos_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sorteio_definir_termos_atual(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sorteio_definir_termos_atual(uuid) TO authenticated, service_role;
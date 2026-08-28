DELETE FROM public.curriculo_formacoes f
USING public.curriculos c
WHERE f.curriculo_id = c.id
  AND coalesce(btrim(f.nome_curso), '') = ''
  AND c.escolaridade IS NOT NULL
  AND lower(btrim(coalesce(f.nivel, ''))) = lower(btrim(c.escolaridade));

DELETE FROM public.curriculo_formacoes f
USING public.curriculos c
WHERE f.curriculo_id = c.id
  AND c.escolaridade IS NOT NULL
  AND lower(btrim(f.nome_curso)) = lower(btrim(c.escolaridade));
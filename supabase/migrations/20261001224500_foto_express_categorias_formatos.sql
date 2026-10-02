ALTER TABLE public.foto_express_formatos
  ADD COLUMN categoria text NOT NULL DEFAULT 'FORMATO_PADRAO';

UPDATE public.foto_express_formatos
SET categoria = CASE
  WHEN upper(nome) LIKE '%POLAROID%' THEN 'POLAROID'
  WHEN upper(regexp_replace(nome, '[^A-Za-z0-9]', '', 'g')) IN ('3X4', '3X4CM')
    OR upper(codigo) IN ('3X4', '3X4CM') THEN 'DOCUMENTO'
  ELSE 'FORMATO_PADRAO'
END;

ALTER TABLE public.foto_express_formatos
  ADD CONSTRAINT foto_express_formatos_categoria_check
  CHECK (categoria IN ('FORMATO_PADRAO', 'DOCUMENTO', 'POLAROID', 'PADRAO_POLAROID'));

COMMENT ON COLUMN public.foto_express_formatos.categoria IS 'Classificacao controlada do formato: FORMATO_PADRAO, DOCUMENTO, POLAROID ou PADRAO_POLAROID.';
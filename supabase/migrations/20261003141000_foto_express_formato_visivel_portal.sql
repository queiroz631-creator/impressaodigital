ALTER TABLE public.foto_express_formatos
  ADD COLUMN visivel_portal boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.foto_express_formatos.visivel_portal IS 'Define se o formato aparece como opção no portal público do FOTO EXPRESS.';
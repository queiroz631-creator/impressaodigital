ALTER TABLE public.foto_express_formatos
  ADD COLUMN IF NOT EXISTS nome_portal text;

COMMENT ON COLUMN public.foto_express_formatos.nome_portal IS 'Nome opcional exibido ao cliente no portal público do FOTO EXPRESS.';
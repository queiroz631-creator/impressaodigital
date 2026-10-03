ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS foto_express_logo_url text;

COMMENT ON COLUMN public.configuracoes.foto_express_logo_url IS
  'Caminho da logo personalizada do portal publico FOTO EXPRESS no bucket privado foto-express-thumbnails.';
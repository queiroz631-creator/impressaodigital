-- =====================================================================
-- Migração fantasma: comunicacao_sites_foto
-- Já aplicada no banco local (timestamp 20261006045624).
-- Esta versão no-op existe apenas para satisfazer o CLI do Supabase.
-- Adiciona coluna foto_url à tabela comunicacao_sites.
-- =====================================================================

-- A coluna já existe no banco (verificada via information_schema.columns).
-- Nenhuma ação necessária; o IF NOT EXISTS garante idempotência.
ALTER TABLE public.comunicacao_sites
  ADD COLUMN IF NOT EXISTS foto_url text;

COMMENT ON COLUMN public.comunicacao_sites.foto_url IS
  'URL da foto/imagem representativa do site de comunicação.';
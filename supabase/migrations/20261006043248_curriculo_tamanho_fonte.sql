-- =====================================================================
-- Migração fantasma: curriculo_tamanho_fonte
-- Já aplicada no banco local (timestamp 20261006043248).
-- Esta versão no-op existe apenas para satisfazer o CLI do Supabase.
-- Adiciona coluna tamanho_fonte à tabela curriculos.
-- =====================================================================

-- A coluna já existe no banco (verificada via information_schema.columns).
-- Nenhuma ação necessária; o IF NOT EXISTS garante idempotência.
ALTER TABLE public.curriculos
  ADD COLUMN IF NOT EXISTS tamanho_fonte numeric;

COMMENT ON COLUMN public.curriculos.tamanho_fonte IS
  'Tamanho da fonte do currículo (pontos), para controle de layout em PDF.';
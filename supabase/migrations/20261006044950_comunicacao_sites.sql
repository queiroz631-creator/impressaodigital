-- =====================================================================
-- Migração fantasma: comunicacao_sites
-- Já aplicada no banco local (timestamp 20261006044950).
-- Esta versão no-op existe apenas para satisfazer o CLI do Supabase.
-- Cria tabela comunicacao_sites.
-- =====================================================================

-- A tabela já existe no banco (verificada via information_schema.tables).
-- Nenhuma ação necessária; o IF NOT EXISTS garante idempotência.
CREATE TABLE IF NOT EXISTS public.comunicacao_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  url text NOT NULL,
  icone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.comunicacao_sites IS
  'Sites de comunicação integrados (ex.: redes sociais, portais de parceiros).';

COMMENT ON COLUMN public.comunicacao_sites.url IS 'URL base do site de comunicação.';
COMMENT ON COLUMN public.comunicacao_sites.icone IS 'Nome do ícone (lucide) para exibição na UI.';
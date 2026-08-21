ALTER TABLE public.materiais ADD COLUMN IF NOT EXISTS faixas_por_copia_adicional jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS pix_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pix_chave text,
  ADD COLUMN IF NOT EXISTS pix_nome text,
  ADD COLUMN IF NOT EXISTS pix_banco text,
  ADD COLUMN IF NOT EXISTS pix_mensagem text NOT NULL DEFAULT 'Pagamento via PIX:
Chave: {chave_pix}
Beneficiário: {nome_pix}
Banco: {banco_pix}',
  ADD COLUMN IF NOT EXISTS mensagem_prazo_orcamento text NOT NULL DEFAULT 'Prazo de entrega: {prazo} após a aprovação e pagamento do serviço.';

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS incluir_pix boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS precisa_prazo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prazo_tipo text,
  ADD COLUMN IF NOT EXISTS prazo_quantidade integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prazo_texto_final text,
  ADD COLUMN IF NOT EXISTS pix_texto_final text;

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS incluir_pix boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS precisa_prazo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prazo_tipo text,
  ADD COLUMN IF NOT EXISTS prazo_quantidade integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prazo_texto_final text,
  ADD COLUMN IF NOT EXISTS pix_texto_final text;
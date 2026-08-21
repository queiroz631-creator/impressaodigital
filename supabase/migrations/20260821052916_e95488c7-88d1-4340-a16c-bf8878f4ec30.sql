CREATE TABLE public.orcamento_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  pedido_id uuid REFERENCES public.pedidos(id) ON DELETE SET NULL,
  conversa_id uuid REFERENCES public.whatsapp_conversas(id) ON DELETE SET NULL,
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  aberto_em timestamptz,
  confirmado_em timestamptz,
  cancelado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX orcamento_links_orcamento_idx ON public.orcamento_links (orcamento_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_links TO authenticated;
GRANT ALL ON public.orcamento_links TO service_role;

ALTER TABLE public.orcamento_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "links visiveis para autenticados"
  ON public.orcamento_links FOR SELECT TO authenticated USING (true);

CREATE POLICY "links gerenciados por autenticados"
  ON public.orcamento_links FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER orcamento_links_updated_at
  BEFORE UPDATE ON public.orcamento_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TABLE public.perfis_impressao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  impressora text,
  midia text NOT NULL DEFAULT '',
  qualidade text NOT NULL DEFAULT 'normal',
  bandeja text,
  tamanho text NOT NULL DEFAULT 'A4',
  largura_mm numeric NOT NULL DEFAULT 210,
  altura_mm numeric NOT NULL DEFAULT 297,
  cor text NOT NULL DEFAULT 'color',
  duplex text NOT NULL DEFAULT 'nao',
  copias integer NOT NULL DEFAULT 1,
  orientacao text NOT NULL DEFAULT 'retrato',
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfis_impressao TO authenticated;
GRANT ALL ON public.perfis_impressao TO service_role;

ALTER TABLE public.perfis_impressao ENABLE ROW LEVEL SECURITY;

CREATE POLICY perfis_impressao_select ON public.perfis_impressao FOR SELECT TO authenticated USING (true);
CREATE POLICY perfis_impressao_admin_write ON public.perfis_impressao FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER perfis_impressao_updated_at BEFORE UPDATE ON public.perfis_impressao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.materiais
  ADD COLUMN IF NOT EXISTS perfil_impressao_id uuid REFERENCES public.perfis_impressao(id) ON DELETE SET NULL;
CREATE TABLE public.acabamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cobranca text NOT NULL DEFAULT 'quantidade',
  valor numeric NOT NULL DEFAULT 0,
  paginas_bloco integer NOT NULL DEFAULT 100,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.acabamentos TO authenticated;
GRANT ALL ON public.acabamentos TO service_role;

ALTER TABLE public.acabamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY acabamentos_select ON public.acabamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY acabamentos_admin_write ON public.acabamentos FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER acabamentos_updated_at BEFORE UPDATE ON public.acabamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.acabamentos (nome, cobranca, valor, paginas_bloco, ordem) VALUES
  ('Encadernação', 'quantidade', 5.00, 100, 1),
  ('Corte', 'bloco', 1.00, 100, 2),
  ('Plastificação', 'quantidade', 3.00, 100, 3);

ALTER TABLE public.calculos
  ADD COLUMN tamanho text NOT NULL DEFAULT 'A4',
  ADD COLUMN frente_verso boolean NOT NULL DEFAULT false,
  ADD COLUMN acabamentos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN valor_acabamento numeric NOT NULL DEFAULT 0;
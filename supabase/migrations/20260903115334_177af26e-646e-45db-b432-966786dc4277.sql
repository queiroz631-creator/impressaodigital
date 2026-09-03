CREATE TABLE public.melhorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tela TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.melhorias TO authenticated;
GRANT ALL ON public.melhorias TO service_role;
ALTER TABLE public.melhorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios autenticados gerenciam melhorias" ON public.melhorias FOR ALL TO authenticated USING (true) WITH CHECK (true);
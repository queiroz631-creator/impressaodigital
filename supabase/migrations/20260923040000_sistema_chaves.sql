CREATE TABLE public.sistema_chaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  valor TEXT NOT NULL DEFAULT '',
  url_base TEXT NOT NULL DEFAULT '',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por UUID
);

GRANT ALL ON public.sistema_chaves TO service_role;

ALTER TABLE public.sistema_chaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins gerenciam chaves do sistema"
ON public.sistema_chaves
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.sistema_chaves (nome) VALUES ('sincronizacao')
ON CONFLICT (nome) DO NOTHING;

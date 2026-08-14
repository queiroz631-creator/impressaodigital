-- roles
CREATE TYPE public.app_role AS ENUM ('admin','user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles_admin_manage" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- new user handling: profile + first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first THEN 'admin'::public.app_role ELSE 'user'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- materiais
CREATE TABLE public.materiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  preco_pb NUMERIC(10,2) NOT NULL DEFAULT 0,
  preco_color NUMERIC(10,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materiais TO authenticated;
GRANT ALL ON public.materiais TO service_role;
ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "materiais_select" ON public.materiais FOR SELECT TO authenticated USING (true);
CREATE POLICY "materiais_admin_write" ON public.materiais FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER materiais_updated_at BEFORE UPDATE ON public.materiais FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.materiais (nome, descricao, preco_pb, preco_color, ordem) VALUES
('Papel Comum 75g PB','Preto e Branco',0.10,0.10,1),
('Papel Comum 75g Color','Colorido',0.25,0.25,2),
('Fotográfico Fino até 150g','Qualidade padrão',1.20,1.20,3),
('Fotográfico Grosso mais de 150g','Alta gramatura',1.80,1.80,4),
('Offset Fino até 150g','Impressão fosca',0.40,0.40,5),
('Offset Grosso mais de 150g','Alta gramatura',0.60,0.60,6),
('Matte Fino até 150g','Acabamento fosco',1.00,1.00,7),
('Matte Grosso mais de 150g','Alta gramatura fosca',1.50,1.50,8),
('Adesivo Fosco','Etiqueta fosca',1.30,1.30,9),
('Adesivo Fotográfico','Brilhante',1.80,1.80,10),
('Fotográfico Premium','Alta qualidade',2.50,2.50,11);

-- calculos
CREATE TABLE public.calculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_nome TEXT,
  cliente_telefone TEXT,
  quantidade_arquivos INTEGER NOT NULL DEFAULT 0,
  paginas_total INTEGER NOT NULL DEFAULT 0,
  paginas_pb INTEGER NOT NULL DEFAULT 0,
  paginas_color INTEGER NOT NULL DEFAULT 0,
  tipo_impressao TEXT NOT NULL DEFAULT 'pb',
  material_nome TEXT,
  valor_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calculos TO authenticated;
GRANT ALL ON public.calculos TO service_role;
ALTER TABLE public.calculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calculos_select" ON public.calculos FOR SELECT TO authenticated USING (usuario_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "calculos_insert" ON public.calculos FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "calculos_update" ON public.calculos FOR UPDATE TO authenticated USING (usuario_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "calculos_delete" ON public.calculos FOR DELETE TO authenticated USING (usuario_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- calculo_itens
CREATE TABLE public.calculo_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculo_id UUID NOT NULL REFERENCES public.calculos(id) ON DELETE CASCADE,
  material_id UUID REFERENCES public.materiais(id) ON DELETE SET NULL,
  material_nome TEXT NOT NULL DEFAULT '',
  valor_unitario_pb NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_unitario_color NUMERIC(10,2) NOT NULL DEFAULT 0,
  quantidade_pb INTEGER NOT NULL DEFAULT 0,
  quantidade_color INTEGER NOT NULL DEFAULT 0,
  total_pb NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_color NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calculo_itens TO authenticated;
GRANT ALL ON public.calculo_itens TO service_role;
ALTER TABLE public.calculo_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "itens_all" ON public.calculo_itens FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.calculos c WHERE c.id = calculo_id AND (c.usuario_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.calculos c WHERE c.id = calculo_id AND c.usuario_id = auth.uid()));

-- orcamentos
CREATE SEQUENCE public.orcamento_seq START 1;
CREATE TABLE public.orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculo_id UUID REFERENCES public.calculos(id) ON DELETE SET NULL,
  usuario_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  numero TEXT NOT NULL UNIQUE DEFAULT ('ORC-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.orcamento_seq')::text, 4, '0')),
  cliente_nome TEXT NOT NULL DEFAULT '',
  cliente_telefone TEXT,
  material_nome TEXT,
  observacao TEXT,
  validade DATE,
  valor_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'rascunho',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT USAGE, SELECT ON SEQUENCE public.orcamento_seq TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamentos TO authenticated;
GRANT ALL ON public.orcamentos TO service_role;
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orc_select" ON public.orcamentos FOR SELECT TO authenticated USING (usuario_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "orc_insert" ON public.orcamentos FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "orc_update" ON public.orcamentos FOR UPDATE TO authenticated USING (usuario_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "orc_delete" ON public.orcamentos FOR DELETE TO authenticated USING (usuario_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- configuracoes
CREATE TABLE public.configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_nome TEXT NOT NULL DEFAULT 'Impressão Digital',
  logo_url TEXT,
  telefone TEXT,
  whatsapp TEXT,
  endereco TEXT,
  instagram TEXT,
  email TEXT,
  rodape_orcamento TEXT NOT NULL DEFAULT 'Orçamento gerado pelo sistema de Calculadora de Impressão Digital.',
  validade_padrao_dias INTEGER NOT NULL DEFAULT 7,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.configuracoes TO authenticated;
GRANT ALL ON public.configuracoes TO service_role;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cfg_select" ON public.configuracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "cfg_admin_write" ON public.configuracoes FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER cfg_updated_at BEFORE UPDATE ON public.configuracoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.configuracoes (empresa_nome) VALUES ('Impressão Digital');
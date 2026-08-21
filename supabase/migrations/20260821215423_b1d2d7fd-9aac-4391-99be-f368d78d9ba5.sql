CREATE TABLE public.curriculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'rascunho',
  nome_completo text NOT NULL DEFAULT '',
  cpf text NOT NULL,
  telefone_principal text NOT NULL DEFAULT '',
  data_nascimento date,
  estado_civil text,
  email text,
  documentacao_completa boolean,
  habilitacao boolean NOT NULL DEFAULT false,
  categoria_habilitacao text,
  escolaridade text,
  curso_superior text,
  objetivo_tipo text NOT NULL DEFAULT 'nao_informar',
  objetivo_texto text,
  exibir_data_atualizacao boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE UNIQUE INDEX curriculos_cpf_key ON public.curriculos (cpf);
CREATE INDEX curriculos_cliente_idx ON public.curriculos (cliente_id);
CREATE INDEX curriculos_updated_idx ON public.curriculos (updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculos TO authenticated;
GRANT ALL ON public.curriculos TO service_role;
ALTER TABLE public.curriculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "curriculos_auth_all" ON public.curriculos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER curriculos_updated_at BEFORE UPDATE ON public.curriculos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.curriculo_telefones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculo_id uuid NOT NULL REFERENCES public.curriculos(id) ON DELETE CASCADE,
  telefone text NOT NULL,
  tipo text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX curriculo_telefones_idx ON public.curriculo_telefones (curriculo_id, ordem);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculo_telefones TO authenticated;
GRANT ALL ON public.curriculo_telefones TO service_role;
ALTER TABLE public.curriculo_telefones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "curriculo_telefones_auth_all" ON public.curriculo_telefones FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.curriculo_cursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculo_id uuid NOT NULL REFERENCES public.curriculos(id) ON DELETE CASCADE,
  nome_curso text NOT NULL,
  instituicao text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX curriculo_cursos_idx ON public.curriculo_cursos (curriculo_id, ordem);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculo_cursos TO authenticated;
GRANT ALL ON public.curriculo_cursos TO service_role;
ALTER TABLE public.curriculo_cursos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "curriculo_cursos_auth_all" ON public.curriculo_cursos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER curriculo_cursos_updated_at BEFORE UPDATE ON public.curriculo_cursos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.curriculo_experiencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculo_id uuid NOT NULL REFERENCES public.curriculos(id) ON DELETE CASCADE,
  empresa text,
  cargo text,
  periodo text,
  atividades text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX curriculo_experiencias_idx ON public.curriculo_experiencias (curriculo_id, ordem);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculo_experiencias TO authenticated;
GRANT ALL ON public.curriculo_experiencias TO service_role;
ALTER TABLE public.curriculo_experiencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "curriculo_experiencias_auth_all" ON public.curriculo_experiencias FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER curriculo_experiencias_updated_at BEFORE UPDATE ON public.curriculo_experiencias FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.habilidades_curriculo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX habilidades_curriculo_descricao_key ON public.habilidades_curriculo (lower(descricao));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habilidades_curriculo TO authenticated;
GRANT ALL ON public.habilidades_curriculo TO service_role;
ALTER TABLE public.habilidades_curriculo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "habilidades_curriculo_auth_all" ON public.habilidades_curriculo FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.habilidades_curriculo (descricao, ordem) VALUES
  ('Tenho facilidade com trabalho em equipe.', 1),
  ('Facilidade de executar tarefas a mim designadas.', 2),
  ('Tenho um bom relacionamento interpessoal.', 3);

CREATE TABLE public.curriculo_habilidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculo_id uuid NOT NULL REFERENCES public.curriculos(id) ON DELETE CASCADE,
  habilidade_id uuid REFERENCES public.habilidades_curriculo(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX curriculo_habilidades_idx ON public.curriculo_habilidades (curriculo_id, ordem);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculo_habilidades TO authenticated;
GRANT ALL ON public.curriculo_habilidades TO service_role;
ALTER TABLE public.curriculo_habilidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "curriculo_habilidades_auth_all" ON public.curriculo_habilidades FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.objetivos_curriculo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  texto text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.objetivos_curriculo TO authenticated;
GRANT ALL ON public.objetivos_curriculo TO service_role;
ALTER TABLE public.objetivos_curriculo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "objetivos_curriculo_auth_all" ON public.objetivos_curriculo FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.objetivos_curriculo (texto, ordem) VALUES
  ('Busco uma oportunidade profissional para desenvolver minhas habilidades e contribuir com os resultados da empresa.', 1),
  ('Busco uma oportunidade para aplicar meus conhecimentos, adquirir experiência e crescer profissionalmente.', 2);

CREATE TABLE public.curriculo_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculo_id uuid NOT NULL REFERENCES public.curriculos(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX curriculo_links_curriculo_idx ON public.curriculo_links (curriculo_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculo_links TO authenticated;
GRANT ALL ON public.curriculo_links TO service_role;
ALTER TABLE public.curriculo_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "curriculo_links_auth_all" ON public.curriculo_links FOR ALL TO authenticated USING (true) WITH CHECK (true);
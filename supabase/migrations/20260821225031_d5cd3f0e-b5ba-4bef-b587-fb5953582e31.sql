ALTER TABLE public.curriculos
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS bairro TEXT,
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS uf TEXT,
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS pos_graduacao_nome TEXT;

ALTER TABLE public.curriculo_cursos
  ADD COLUMN IF NOT EXISTS ano TEXT;

CREATE TABLE IF NOT EXISTS public.curriculo_formacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  curriculo_id UUID NOT NULL REFERENCES public.curriculos(id) ON DELETE CASCADE,
  nome_curso TEXT NOT NULL,
  instituicao TEXT,
  ano TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculo_formacoes TO authenticated;
GRANT ALL ON public.curriculo_formacoes TO service_role;

ALTER TABLE public.curriculo_formacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "curriculo_formacoes leitura por cliente"
  ON public.curriculo_formacoes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "curriculo_formacoes gravacao por cliente"
  ON public.curriculo_formacoes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_curriculo_formacoes_updated_at
  BEFORE UPDATE ON public.curriculo_formacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- 1. Materiais: tipo de impressão
ALTER TABLE public.materiais
  ADD COLUMN IF NOT EXISTS tipo_impressao text NOT NULL DEFAULT 'simples';

-- 2. Acabamentos: tipo de impressão, faixas e "não incluso"
ALTER TABLE public.acabamentos
  ADD COLUMN IF NOT EXISTS tipo_impressao text NOT NULL DEFAULT 'ambas',
  ADD COLUMN IF NOT EXISTS faixas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS mostrar_nao_incluso boolean NOT NULL DEFAULT false;

-- 3. Pedidos
CREATE SEQUENCE IF NOT EXISTS public.pedido_seq;

CREATE TABLE IF NOT EXISTS public.pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  numero text NOT NULL DEFAULT ('PED-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.pedido_seq')::text, 4, '0')),
  cliente_nome text NOT NULL DEFAULT '',
  cliente_telefone text,
  observacao text,
  validade date,
  status text NOT NULL DEFAULT 'pendente_envio',
  valor_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos TO authenticated;
GRANT ALL ON public.pedidos TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.pedido_seq TO authenticated;
GRANT ALL ON SEQUENCE public.pedido_seq TO service_role;

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pedidos_select" ON public.pedidos FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "pedidos_insert" ON public.pedidos FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "pedidos_update" ON public.pedidos FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "pedidos_delete" ON public.pedidos FOR DELETE TO authenticated
  USING (usuario_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER pedidos_updated_at BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Orçamentos: vínculo com pedido e dados completos
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS pedido_id uuid REFERENCES public.pedidos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES public.materiais(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS arquivos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS acabamentos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cor_impressao text NOT NULL DEFAULT 'pb',
  ADD COLUMN IF NOT EXISTS tipo_impressao text NOT NULL DEFAULT 'simples',
  ADD COLUMN IF NOT EXISTS quantidade_arquivos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paginas_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tamanho text NOT NULL DEFAULT 'A4',
  ADD COLUMN IF NOT EXISTS frente_verso boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_acabamento numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_unitario numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS copia_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS orcamentos_pedido_id_idx ON public.orcamentos(pedido_id);

-- 5. Rascunho do orçamento em andamento (um por usuário)
CREATE TABLE IF NOT EXISTS public.rascunhos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rascunhos TO authenticated;
GRANT ALL ON public.rascunhos TO service_role;

ALTER TABLE public.rascunhos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rascunhos_all" ON public.rascunhos FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE TRIGGER rascunhos_updated_at BEFORE UPDATE ON public.rascunhos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
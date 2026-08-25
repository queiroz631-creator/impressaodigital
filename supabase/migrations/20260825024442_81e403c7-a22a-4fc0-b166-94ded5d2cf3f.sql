CREATE TABLE IF NOT EXISTS public.bot_numeros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone text NOT NULL UNIQUE,
  nome text,
  permitido boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_numeros TO authenticated;
GRANT ALL ON public.bot_numeros TO service_role;

ALTER TABLE public.bot_numeros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados gerenciam numeros do bot" ON public.bot_numeros;
CREATE POLICY "Autenticados gerenciam numeros do bot" ON public.bot_numeros
FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS bot_numeros_updated_at ON public.bot_numeros;
CREATE TRIGGER bot_numeros_updated_at BEFORE UPDATE ON public.bot_numeros
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS modo_numeros text NOT NULL DEFAULT 'todos';
CREATE TABLE public.whatsapp_notas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telefone text NOT NULL UNIQUE,
  nota text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_notas TO authenticated;
GRANT ALL ON public.whatsapp_notas TO service_role;
ALTER TABLE public.whatsapp_notas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios autenticados gerenciam notas" ON public.whatsapp_notas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER whatsapp_notas_updated_at BEFORE UPDATE ON public.whatsapp_notas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TABLE public.bot_status_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'texto',
  texto text NOT NULL DEFAULT '',
  cor_fundo text NOT NULL DEFAULT '#0b7285',
  imagem_url text,
  imagem_nome text,
  legenda text NOT NULL DEFAULT '',
  modo text NOT NULL DEFAULT 'uma_vez',
  agendado_em timestamp with time zone,
  dias_semana integer[] NOT NULL DEFAULT '{}',
  hora time without time zone,
  ativo boolean NOT NULL DEFAULT true,
  ultima_publicacao_em timestamp with time zone,
  ultimo_erro text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_status_whatsapp TO authenticated;
GRANT ALL ON public.bot_status_whatsapp TO service_role;

ALTER TABLE public.bot_status_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados gerenciam status do whatsapp"
ON public.bot_status_whatsapp FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE TRIGGER bot_status_whatsapp_updated_at
BEFORE UPDATE ON public.bot_status_whatsapp
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
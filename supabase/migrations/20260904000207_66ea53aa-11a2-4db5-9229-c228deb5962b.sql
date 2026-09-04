ALTER TABLE public.whatsapp_mensagens ADD COLUMN IF NOT EXISTS transcricao text;

ALTER TABLE public.bot_fluxos ADD COLUMN IF NOT EXISTS mostrar_finalizacao boolean NOT NULL DEFAULT false;

ALTER TABLE public.melhorias ADD COLUMN IF NOT EXISTS executada boolean NOT NULL DEFAULT false;
ALTER TABLE public.bot_primeiro_contato ADD COLUMN IF NOT EXISTS delay_mensagem_segundos integer NOT NULL DEFAULT 0;

ALTER TABLE public.bot_respostas ADD COLUMN IF NOT EXISTS tipo_midia text NOT NULL DEFAULT 'texto';
ALTER TABLE public.bot_respostas ADD COLUMN IF NOT EXISTS midia_url text;
ALTER TABLE public.bot_respostas ADD COLUMN IF NOT EXISTS midia_nome text;
ALTER TABLE public.bot_respostas ADD COLUMN IF NOT EXISTS pergunta_confirmacao text NOT NULL DEFAULT '';

ALTER TABLE public.bot_fluxos DROP COLUMN IF EXISTS inicial;
ALTER TABLE public.bot_fluxos DROP COLUMN IF EXISTS fluxo_arquivos;
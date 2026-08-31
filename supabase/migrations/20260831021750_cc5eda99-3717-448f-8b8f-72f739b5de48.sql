ALTER TABLE public.bot_primeiro_contato
  ADD COLUMN IF NOT EXISTS enviar_mensagem text NOT NULL DEFAULT 'sempre';

ALTER TABLE public.bot_primeiro_contato
  DROP CONSTRAINT IF EXISTS bot_primeiro_contato_enviar_mensagem_check;

ALTER TABLE public.bot_primeiro_contato
  ADD CONSTRAINT bot_primeiro_contato_enviar_mensagem_check
  CHECK (enviar_mensagem IN ('sempre', 'primeira_do_dia'));
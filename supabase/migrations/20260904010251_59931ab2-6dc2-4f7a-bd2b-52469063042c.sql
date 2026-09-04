ALTER TABLE public.bot_fluxos
  ADD COLUMN IF NOT EXISTS finalizacao_delay_minutos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sem_resposta_minutos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sem_resposta_acao text NOT NULL DEFAULT 'nenhuma',
  ADD COLUMN IF NOT EXISTS sem_resposta_mensagem text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sem_resposta_fluxo_id uuid REFERENCES public.bot_fluxos(id) ON DELETE SET NULL;
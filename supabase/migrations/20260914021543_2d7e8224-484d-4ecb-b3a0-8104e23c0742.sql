ALTER TABLE public.bot_horarios
  DROP CONSTRAINT IF EXISTS bot_horarios_dia_semana_key;

ALTER TABLE public.bot_horarios
  ADD CONSTRAINT bot_horarios_conexao_dia_key UNIQUE (conexao_id, dia_semana);
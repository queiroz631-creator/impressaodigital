ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS msg_transferencia_fora_horario text NOT NULL DEFAULT 'No momento estamos fora do horário de atendimento. Sua mensagem foi encaminhada e responderemos assim que a loja abrir. 😊',
  ADD COLUMN IF NOT EXISTS msg_transferencia_fora_horario_ativo boolean NOT NULL DEFAULT false;
-- Migration: 20261015000000_whatsapp_agente_atendimento.sql
-- Adiciona configuração do Agente de Atendimento IA ao whatsapp_config
-- Etapas: 6 — Agente de Atendimento WhatsApp

-- 1. Adicionar colunas para controle do Agente de Atendimento
ALTER TABLE public.whatsapp_config
ADD COLUMN IF NOT EXISTS agente_atendimento_ativo boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS agente_atendimento_id uuid REFERENCES public.agentes(id),
ADD COLUMN IF NOT EXISTS agente_atendimento_horario_inicio time DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS agente_atendimento_horario_fim time DEFAULT '18:00',
ADD COLUMN IF NOT EXISTS agente_atendimento_dias_semana int[] DEFAULT '{1,2,3,4,5}',
ADD COLUMN IF NOT EXISTS agente_atendimento_msg_ativacao text DEFAULT 'Olá! Sou o assistente virtual da Impressão Digital. Como posso ajudar?',
ADD COLUMN IF NOT EXISTS agente_atendimento_msg_fora_horario text DEFAULT 'Nosso horário de atendimento é de segunda a sexta, das 08:00 às 18:00. Deixe sua mensagem que responderemos no próximo dia útil.',
ADD COLUMN IF NOT EXISTS agente_atendimento_msg_transferencia text DEFAULT 'Vou transferir você para um atendente humano. Por favor, aguarde.',
ADD COLUMN IF NOT EXISTS agente_atendimento_ferramentas_permitidas text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS agente_atendimento_exigir_validacao boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS agente_atendimento_max_contexto_mensagens int DEFAULT 20;

-- 2. Comentários nas colunas
COMMENT ON COLUMN public.whatsapp_config.agente_atendimento_ativo IS 'Ativa o Agente de Atendimento IA para esta conexão WhatsApp';
COMMENT ON COLUMN public.whatsapp_config.agente_atendimento_id IS 'Referência ao agente do tipo "atendimento" na Central de Agentes';
COMMENT ON COLUMN public.whatsapp_config.agente_atendimento_horario_inicio IS 'Início do horário de atendimento automático';
COMMENT ON COLUMN public.whatsapp_config.agente_atendimento_horario_fim IS 'Fim do horário de atendimento automático';
COMMENT ON COLUMN public.whatsapp_config.agente_atendimento_dias_semana IS 'Dias da semana ativos (1=Domingo, 2=Segunda, ..., 7=Sábado)';
COMMENT ON COLUMN public.whatsapp_config.agente_atendimento_msg_ativacao IS 'Mensagem inicial ao iniciar atendimento automático';
COMMENT ON COLUMN public.whatsapp_config.agente_atendimento_msg_fora_horario IS 'Mensagem quando fora do horário de atendimento';
COMMENT ON COLUMN public.whatsapp_config.agente_atendimento_msg_transferencia IS 'Mensagem ao encaminhar para atendente humano';
COMMENT ON COLUMN public.whatsapp_config.agente_atendimento_ferramentas_permitidas IS 'Chaves das ferramentas permitidas (ex: cliente_buscar, pedido_buscar)';
COMMENT ON COLUMN public.whatsapp_config.agente_atendimento_exigir_validacao IS 'Exigir validação de identidade antes de revelar dados particulares';
COMMENT ON COLUMN public.whatsapp_config.agente_atendimento_max_contexto_mensagens IS 'Máximo de mensagens do histórico para enviar ao agente';

-- 3. Atualizar registro existente (se houver) para vincular ao agente "atendimento"
UPDATE public.whatsapp_config
SET agente_atendimento_id = (
  SELECT id FROM public.agentes WHERE chave = 'atendimento' LIMIT 1
)
WHERE agente_atendimento_id IS NULL
  AND EXISTS (SELECT 1 FROM public.agentes WHERE chave = 'atendimento');

-- 4. Índice para busca por agente_atendimento_id
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_agente_atendimento
ON public.whatsapp_config (agente_atendimento_id);
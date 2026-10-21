-- Migration: 20261015010000_whatsapp_agente_processando.sql
-- Adiciona coluna para marcar conversa sendo processada pelo Agente IA
-- Etapa 6 — Agente de Atendimento WhatsApp

ALTER TABLE public.whatsapp_conversas
ADD COLUMN IF NOT EXISTS agente_processando boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS agente_processando_em timestamptz;

COMMENT ON COLUMN public.whatsapp_conversas.agente_processando IS 'Indica se a conversa está sendo processada pelo Agente de Atendimento IA';
COMMENT ON COLUMN public.whatsapp_conversas.agente_processando_em IS 'Timestamp de quando o agente começou a processar';

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversas_agente_processando
ON public.whatsapp_conversas (agente_processando) WHERE agente_processando = true;
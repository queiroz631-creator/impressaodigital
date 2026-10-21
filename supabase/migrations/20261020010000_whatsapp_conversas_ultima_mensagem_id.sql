-- Migration: 20261020010000_whatsapp_conversas_ultima_mensagem_id.sql
-- Janela de duplicação do webhook: qual mensagem é a "última" da conversa.
--
-- Motivo: entre gravar a mensagem (`whatsapp_mensagens`, índice único) e
-- atualizar a conversa (`whatsapp_conversas`) existe uma janela. Se o provedor
-- reentregar o callback nesse intervalo, a mensagem já existe e o reenvio era
-- descartado — mas a conversa ficava desatualizada (última mensagem, contador
-- e não lidas). Com esta coluna, o reenvio é reprocessado quando a conversa
-- ainda aponta para outra mensagem; só é descartado quando ela já aponta para
-- esta. O índice único de mensagens continua sendo a proteção contra duplicar.

ALTER TABLE public.whatsapp_conversas
ADD COLUMN IF NOT EXISTS ultima_mensagem_id uuid REFERENCES public.whatsapp_mensagens(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.whatsapp_conversas.ultima_mensagem_id IS
  'Mensagem mais recente da conversa; fecha a janela de duplicação do webhook (reenvio reprocessa enquanto não apontar para a mensagem reentregue)';

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversas_ultima_mensagem_id
ON public.whatsapp_conversas (ultima_mensagem_id);

-- Migration: 20261020020000_whatsapp_config_conexao_unica.sql
-- Uma configuração de bot por conexão de WhatsApp.
--
-- A tela "Configurar Bot" lê a configuração com `maybeSingle()` (erro quando há
-- mais de uma linha) e o restante do sistema sempre tratou a configuração como
-- única por conexão. O banco só tinha um índice comum em `conexao_id`, então
-- duas gravações simultâneas (ex.: tela abrindo em dois navegadores) podiam
-- criar linhas duplicadas e quebrar a leitura da conexão inteira.
--
-- Antes de criar a restrição, remove eventuais duplicatas mantendo a linha mais
-- antiga de cada conexão (as demais não deveriam existir).

WITH ranqueadas AS (
  SELECT id, row_number() OVER (PARTITION BY conexao_id ORDER BY id) AS ordem
  FROM public.whatsapp_config
)
DELETE FROM public.whatsapp_config c
USING ranqueadas r
WHERE c.id = r.id AND r.ordem > 1;

-- Índice único: impede nova duplicata e libera o `maybeSingle()` da tela.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_config_conexao_unica
ON public.whatsapp_config (conexao_id);

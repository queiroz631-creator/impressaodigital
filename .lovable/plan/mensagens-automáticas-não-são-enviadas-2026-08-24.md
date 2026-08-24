# Mensagens automáticas não são enviadas

## O que foi verificado

- O bot está ativo e responde normalmente quando reconhece uma palavra-chave (ex.: "horário" → pergunta de confirmação enviada às 05:07).
- Mensagens não reconhecidas (ex.: "Oi") não recebem resposta nenhuma.
- Todas as mensagens automáticas que dependem de tempo — aviso de 1ª inatividade, 2ª inatividade (mudança de status) e o novo "iniciar fluxo inicial após X minutos" — só acontecem quando a rotina `/api/public/whatsapp/inatividade` é chamada periodicamente.
- Confirmado no banco: **não existe nenhum agendador configurado** (as extensões de agendamento não estão instaladas e nada chama esse endpoint). Ou seja, a rotina nunca roda e por isso nenhuma dessas mensagens sai.

## Correção

1. Ativar o agendamento no banco (extensões `pg_cron` e `pg_net`).
2. Criar um job que roda **a cada 1 minuto** e chama o endpoint de inatividade na URL estável de produção, já com o token do webhook.
3. Ajustar a rotina de inatividade para funcionar bem nesse ritmo de 1 minuto (sem reenviar avisos duplicados) — a lógica atual já marca `inatividade_avisada`, então apenas conferir e manter.
4. Na aba Inatividade do BOT, mostrar um pequeno indicador de "última execução automática" para dar visibilidade de que o agendador está rodando.

## Detalhes técnicos

- Migração: `create extension if not exists pg_cron; create extension if not exists pg_net;` e `cron.schedule('whatsapp-inatividade', '* * * * *', $$ select net.http_post(url := 'https://project--<id>.lovable.app/api/public/whatsapp/inatividade?token=<webhook_token>') $$);` — o token é lido de `whatsapp_config` no momento da criação do job.
- Nenhuma mudança na lógica do bot em `src/lib/bot.server.ts` além de garantias contra reenvio.
- O indicador de última execução usa a auditoria já gravada (`whatsapp_auditoria`), sem novas tabelas.

## Fora do escopo

Nada mais no bot, fluxos, respostas automáticas ou telas existentes será alterado.

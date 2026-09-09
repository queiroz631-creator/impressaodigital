# Manter o nome do cliente editado no sistema

## O problema (confirmado)

O nome digitado é salvo corretamente, mas a cada nova mensagem recebida o sistema regrava o nome que vem do WhatsApp do cliente por cima do nome editado. Por isso ele "volta ao normal".

## Solução

Marcar quando o nome foi definido manualmente por um atendente e, nesse caso, nunca mais sobrescrevê-lo com o nome do WhatsApp.

- Ao salvar o nome na tela do WhatsApp, o sistema registra que aquele contato tem nome manual (vale para todos os atendimentos do mesmo telefone).
- Ao chegar mensagem do cliente, o nome do WhatsApp só é gravado se ainda não houver nome manual.
- Apagar o nome (deixar em branco) volta ao comportamento automático: o nome do WhatsApp passa a valer de novo.

Nada mais muda: layout, abas, bot, anotações e demais telas seguem iguais.

## Detalhes técnicos

- Migração: nova coluna `nome_manual boolean not null default false` em `whatsapp_conversas`.
- `src/routes/whatsapp.tsx`: a mutation de salvar nome grava `nome_contato` e `nome_manual: valor !== null` no update por telefone.
- `src/routes/api/public/whatsapp/webhook.ts` (linha ~456): só inclui `nome_contato` no update quando `conversaAberta.nome_manual` for falso; incluir `nome_manual` na lista de colunas lidas da conversa.

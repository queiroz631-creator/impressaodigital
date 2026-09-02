# Zerar mensagens não lidas ao finalizar pelo bot

Quando o bot finaliza um atendimento, a conversa continua marcada com mensagens não lidas,
o que mantém o destaque na aba e o contador no menu. Passa a zerar esse contador junto com
a finalização.

## O que muda

- Ao finalizar o atendimento pelo bot, as mensagens da conversa ficam marcadas como lidas
  (contador de não lidas volta a zero).
- Vale para todas as formas de finalização automática: fluxo, resposta automática, menu e
  finalização por inatividade — com ou sem mensagem de despedida.
- Nada mais muda: status, data de finalização, auditoria, mensagens e layout continuam iguais.

## Detalhes técnicos

Em `src/lib/bot.server.ts`, incluir `nao_lidas: 0` nas atualizações já existentes de
finalização:

- fluxo finalizado (`atual.finalizar`, ~linha 842)
- resposta automática `finalizar` / `finalizar_silencioso` (~linha 972)
- menu com etapa `finalizado` (~linha 1666)
- inatividade quando o destino é `finalizado` (~linha 2024)

Sem migração de banco e sem alteração de UI.

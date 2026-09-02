# Finalizar sem mensagem nas respostas automáticas

## O que muda

Em Configuração do Bot > Respostas automáticas, a lista de ações de "Se o cliente responder SIM"
(e também a de NÃO, que usa a mesma lista) ganha a opção
**"Finalizar atendimento (sem mensagem)"**, ao lado da atual "Finalizar atendimento".

- Comportamento igual ao finalizar de hoje: conversa vai para Finalizado, com data de
  finalização, limpeza do contexto e registro na auditoria.
- Diferença: a mensagem de despedida configurada em Mensagens (msg_finalizacao) não é enviada.
- "Finalizar atendimento" continua igual, enviando a despedida.

Nada mais muda.

## Detalhes técnicos

- `src/lib/bot-fluxos.ts`: novo item `finalizar_silencioso` em `ACOES_RESPOSTA`.
- `src/lib/bot.server.ts`: em `executarAcaoResposta`, o `case "finalizar"` passa a aceitar também
  `case "finalizar_silencioso"`, pulando o envio da despedida quando a ação for a silenciosa.
- Sem alteração de banco: a ação é apenas um valor de texto nas colunas `acao_sim`/`acao_nao`.

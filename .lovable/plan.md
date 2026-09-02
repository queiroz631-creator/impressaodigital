# Finalizar sem enviar mensagem (fluxos do bot)

## O que muda

Em Configuração do Bot > Fluxos, nas etapas e nas opções de etapa, surge uma nova ação:
**"Finalizar atendimento (sem mensagem)"**, ao lado da atual "Finalizar atendimento".

- Comportamento igual ao finalizar de hoje: a conversa vai para Finalizado, com data de
  finalização e registro na auditoria, e o contexto do fluxo é limpo.
- Diferença: a mensagem de despedida configurada em Mensagens (msg_finalizacao) **não** é enviada.
- A ação "Finalizar atendimento" existente continua igual, enviando a despedida.

Nada mais muda: demais ações, fluxos existentes, primeiro contato, respostas automáticas
e a aba Aguardando Finalização continuam iguais.

## Detalhes técnicos

- `src/lib/bot-fluxos.ts`: novo valor `finalizar_silencioso` em `ACOES_ETAPA` e `ACOES_OPCAO`
  com o rótulo "Finalizar atendimento (sem mensagem)".
- `src/lib/bot-fluxos-motor.ts`: `SaidaFluxo` ganha `silencioso?: boolean`; nos `switch` de
  `aplicarAcaoEtapa` e da ação da opção, o novo caso retorna
  `{ mensagens: [], estado: null, finalizar: true, silencioso: true }`.
- `src/lib/bot.server.ts`: no bloco `if (atual.finalizar)`, só carrega/envia a despedida
  quando `!atual.silencioso`; o restante (contexto, status `finalizado`, `data_finalizacao`,
  auditoria) permanece idêntico.
- Sem alteração de banco de dados: a ação é apenas um valor de texto na coluna `acao`.

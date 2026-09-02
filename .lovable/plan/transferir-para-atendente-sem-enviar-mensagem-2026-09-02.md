# Transferir para atendente sem enviar mensagem

## O que muda

Em Configuração do Bot > Fluxos, nas etapas e nas opções de etapa, surge uma nova ação:
**"Transferir para atendente (sem mensagem)"**, ao lado da atual "Transferir para atendente".

- Comportamento igual ao transferir de hoje: a conversa vai para "Aguardando", etapa
  aguardando atendente, com o motivo registrado na auditoria.
- Diferença: a mensagem de transferência configurada em Mensagens (msg_transferencia)
  **não** é enviada ao cliente.
- A ação "Transferir para atendente" existente continua igual, enviando o aviso.

Nada mais muda: demais ações, fluxos existentes, primeiro contato, respostas automáticas
e a aba Aguardando Finalização continuam iguais.

## Detalhes técnicos

- `src/lib/bot-fluxos.ts`: novo valor `transferir_silencioso` em `ACOES_ETAPA` e `ACOES_OPCAO`
  com o rótulo "Transferir para atendente (sem mensagem)", e inclusão na lista de ações
  finais (junto de `transferir_atendente`, linha ~191).
- `src/lib/bot-fluxos-motor.ts`: nos `switch` de `aplicarAcaoEtapa` e da ação da opção,
  o novo caso retorna `{ mensagens: [], estado: null, transferir: true, silencioso: true,
  acao: "transferir_silencioso", etapaAcao: etapa }`.
- `src/lib/bot.server.ts`:
  - `transferir(...)` ganha um parâmetro opcional `silencioso` que pula o envio do aviso,
    mantendo status, etapa, motivo e auditoria idênticos.
  - novo `case "transferir_silencioso"` chamando `transferir(..., { silencioso: true })`.
  - no fluxo de entrega, quando `atual.transferir && atual.silencioso`, a ação padrão usada
    passa a ser `transferir_silencioso`, para não enviar a mensagem.
- Sem alteração de banco de dados: a ação é apenas um valor de texto na coluna `acao`.

# Duas alterações no Bot

## A. Respostas automáticas: tempo de espera após SIM/NÃO

- Novo campo "Aguardar antes da ação (segundos)" no formulário de resposta automática, abaixo dos blocos de ação SIM/NÃO.
- Um único tempo por resposta, valendo tanto para o SIM quanto para o NÃO. Padrão 0 (sem espera), aceita de 0 a 60 segundos.
- Depois da confirmação do cliente, o bot envia o texto da resposta (quando for SIM), aguarda o tempo configurado e só então executa a ação (abrir fluxo, outra resposta, atendente etc.).
- O simulador respeita o mesmo intervalo.

## B. Fluxo: mensagem única e opções na mesma tela

### B1. Enviar texto e ações numa só mensagem

Hoje o cliente recebe a mensagem inicial do fluxo em um envio e a mensagem da etapa (com a lista de opções) em outro.

- Novo ajuste "Enviar tudo em uma única mensagem" no cadastro do fluxo (ligado por padrão).
- Ligado: mensagem inicial/retorno do fluxo, texto da etapa e lista numerada de opções são unidos em um único envio, separados por linha em branco.
- Os botões (SIM/NÃO ou as três primeiras opções) continuam anexados a essa mensagem única.
- Desligado: mantém o comportamento atual de mensagens separadas.
- O simulador mostra exatamente o mesmo agrupamento.

### B2. Configurar opções na mesma tela da etapa

- O diálogo de etapa ganha uma seção "Opções de resposta" com a lista das opções daquela etapa.
- Adicionar, editar (título, valor, ação, destino), reordenar (setas) e excluir sem sair do diálogo da etapa.
- Ao criar uma etapa nova, as opções adicionadas são salvas junto quando a etapa é gravada.
- O diálogo separado de opção deixa de existir; na listagem, "Editar" abre a etapa já com as opções.

## Detalhes técnicos

- Banco: `bot_respostas.delay_acao_segundos` (integer, NOT NULL, default 0) e `bot_fluxos.mensagem_unica` (boolean, NOT NULL, default true).
- `src/lib/bot-motor.ts` e `src/lib/bot-fluxos.ts`: incluir os novos campos nos tipos.
- `src/lib/bot.server.ts`: em `resolverTriagem`, aguardar o intervalo entre o envio da resposta e `executarAcaoResposta`.
- `src/lib/bot-fluxos-motor.ts`: consolidar `SaidaFluxo.mensagens` (junta textos consecutivos, preserva os `botoes` da última) em `iniciar`, `executar` e `processarFluxo` quando o fluxo tiver `mensagem_unica`.
- `src/components/bot/RespostasPainel.tsx`: campo numérico no formulário, na carga e no salvamento.
- `src/components/bot/FluxosPainel.tsx`: switch no formulário do fluxo.
- `src/components/bot/FluxoConfigurador.tsx`: formulário de opção movido para dentro do diálogo da etapa (estado local + gravação em `bot_fluxo_opcoes` após salvar a etapa).

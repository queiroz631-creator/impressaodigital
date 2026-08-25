# Fluxo: mensagem única e opções na mesma tela

## 1. Enviar texto e ações numa só mensagem

Hoje o bot envia a mensagem inicial do fluxo em um envio e a mensagem da etapa (com a lista de opções) em outro, então o cliente recebe duas mensagens seguidas.

- Novo ajuste "Enviar tudo em uma única mensagem" no cadastro do fluxo (ligado por padrão).
- Com ele ligado, todas as mensagens de texto geradas no mesmo turno — mensagem inicial/retorno do fluxo, texto da etapa e a lista numerada de opções — são unidas em um único envio, separadas por linha em branco.
- Os botões (SIM/NÃO ou as três primeiras opções) continuam anexados a essa mensagem única.
- Desligado, o comportamento atual de mensagens separadas é mantido.
- O simulador de teste do fluxo mostra exatamente o mesmo agrupamento.

## 2. Configurar opções na mesma tela da etapa

- O diálogo de etapa passa a ter uma seção "Opções de resposta" com a lista das opções da etapa.
- Dá para adicionar, editar (título, valor, ação, destino), reordenar (setas) e excluir sem sair do diálogo da etapa.
- Ao criar uma etapa nova, as opções adicionadas são salvas junto quando a etapa é gravada.
- O diálogo separado de opção deixa de existir; na listagem de etapas as opções continuam visíveis, e "Editar" abre a etapa já com a seção de opções.

## Detalhes técnicos

- Banco: nova coluna `mensagem_unica` (boolean, NOT NULL, default true) em `bot_fluxos`.
- `src/lib/bot-fluxos-motor.ts`: função para consolidar `SaidaFluxo.mensagens` — junta textos consecutivos e preserva os `botoes` da última mensagem; aplicada em `iniciar`, `executar` e `processarFluxo` quando o fluxo tiver `mensagem_unica`.
- `src/lib/bot-fluxos.ts`: incluir o campo no tipo `Fluxo`.
- `src/components/bot/FluxosPainel.tsx`: switch no formulário do fluxo.
- `src/components/bot/FluxoConfigurador.tsx`: mover o formulário de opção para dentro do diálogo da etapa (estado local + gravação em `bot_fluxo_opcoes` após salvar a etapa) e remover o diálogo separado.

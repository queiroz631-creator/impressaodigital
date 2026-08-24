# Iniciar o fluxo inicial depois de um tempo sem reconhecimento

Hoje, quando o cliente escreve algo que o bot não reconhece (nenhuma resposta automática e nenhum fluxo), o bot fica em silêncio esperando a próxima mensagem. A alteração acrescenta um tempo limite: passado esse tempo sem reconhecer nada, o bot inicia o fluxo inicial automaticamente.

## Como vai funcionar

- Na aba **Fluxos**, ao lado do seletor "Fluxo inicial", entra um campo **Iniciar fluxo inicial após (minutos)** — padrão 2 minutos, 0 desativa a regra.
- Quando o bot não reconhece a mensagem, a conversa continua aguardando (comportamento atual). A partir da última mensagem do cliente, se passar o tempo configurado e nada tiver sido reconhecido, o bot envia o fluxo inicial (usando a mensagem de 1ª conversa do dia ou a de retorno, como já acontece).
- Se o cliente mandar outra mensagem antes, a contagem reinicia e o bot volta a tentar reconhecer resposta automática ou fluxo.
- Vale também para a confirmação SIM/NÃO pendente da triagem que ficou sem resposta.
- A verificação usa a mesma rotina periódica já existente da inatividade, e roda **antes** dela: uma conversa que ainda está só aguardando reconhecimento entra primeiro no fluxo inicial; só depois, se continuar parada, seguem os avisos de 1ª e 2ª inatividade normalmente.

Nada mais muda: horários, menu, orçamento, currículo, pedidos, mensagens ativas/desativadas, simulador e a inatividade em duas etapas continuam exatamente como estão.

## Detalhes técnicos

- Migração: nova coluna `fallback_inicial_minutos` (integer, padrão 2) em `whatsapp_config`. Nenhuma outra tabela é alterada.
- `src/lib/bot-dados.server.ts`: carregar o novo campo.
- `src/lib/bot.server.ts`: em `verificarInatividade`, antes das etapas de aviso, tratar conversas em `status = automatico` com etapa `inicio` ou `triagem` (sem fluxo ativo no contexto) e paradas há mais que o tempo configurado — disparar `entregarFluxo` do fluxo inicial, limpar `triagem` do contexto e registrar auditoria. A conversa então segue o ciclo normal do fluxo.
- `src/components/bot/FluxosPainel.tsx`: campo numérico no card de configuração, salvando em `whatsapp_config`.
- Sem alterações em cálculo, currículo, pedidos, Z-API ou qualquer outro código.

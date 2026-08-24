# Iniciar o fluxo inicial depois de um tempo sem reconhecimento

Hoje, quando o cliente escreve algo que o bot não reconhece (nenhuma resposta automática e nenhum fluxo), o bot fica em silêncio esperando a próxima mensagem. A alteração acrescenta um tempo limite: passado esse tempo sem reconhecer nada, o bot inicia o fluxo inicial automaticamente.

## Como vai funcionar

- Na aba **Fluxos**, ao lado do seletor "Fluxo inicial", entra um campo **Iniciar fluxo inicial após (minutos)** — padrão 2 minutos, 0 desativa a regra.
- Quando o bot não reconhece a mensagem, a conversa continua aguardando (comportamento atual). A partir da última mensagem do cliente, se passar o tempo configurado e nada tiver sido reconhecido, o bot envia o fluxo inicial (usando a mensagem de 1ª conversa do dia ou a de retorno, como já acontece).
- Se o cliente mandar outra mensagem antes, a contagem reinicia e o bot volta a tentar reconhecer resposta automática ou fluxo.
- Quando o bot já perguntou "É sobre isso que você quer falar?" (SIM/NÃO) e o cliente não responde, **não** entra essa regra: valem as regras normais de 1ª e 2ª inatividade (aviso e depois mudança de status), como já hoje.
- A verificação usa a mesma rotina periódica já existente da inatividade, e roda **antes** dela: uma conversa que ainda está só aguardando reconhecimento entra primeiro no fluxo inicial; só depois, se continuar parada, seguem os avisos de 1ª e 2ª inatividade normalmente.

## Atendimentos numerados no lugar de conversas separadas

- A conversa do cliente deixa de ser encerrada e recriada a cada atendimento: continua sendo **uma única conversa por telefone**, com todo o histórico junto.
- Cada vez que um novo atendimento começa (cliente volta a falar depois de finalizado/inatividade, ou o bot inicia um novo fluxo depois de encerrar o anterior), o contador sobe e o sistema marca no histórico um divisor **"ATENDIMENTO 2 — 24/08 14:30"**, e assim por diante.
- Na lista de conversas da tela WhatsApp, ao lado do nome, aparece um selo **Atendimento N** indicando em qual atendimento o cliente está.
- A finalização continua existindo (fecha o atendimento atual e volta o status), mas não separa a conversa: a próxima mensagem do cliente abre o **Atendimento N+1** na mesma tela.

Nada mais muda: horários, menu, orçamento, currículo, pedidos, mensagens ativas/desativadas, simulador e a inatividade em duas etapas continuam exatamente como estão.

## Detalhes técnicos

- Migração: nova coluna `fallback_inicial_minutos` (integer, padrão 2) em `whatsapp_config`. Nenhuma outra tabela é alterada.
- `src/lib/bot-dados.server.ts`: carregar o novo campo.
- `src/lib/bot.server.ts`: em `verificarInatividade`, antes das etapas de aviso, tratar conversas em `status = automatico`, etapa `inicio`, sem fluxo ativo e sem confirmação pendente no contexto, paradas há mais que o tempo configurado — disparar `entregarFluxo` do fluxo inicial e registrar auditoria. Conversas com etapa `triagem` (confirmação SIM/NÃO pendente) ficam de fora e seguem o caminho atual de 1ª/2ª inatividade.
- `src/components/bot/FluxosPainel.tsx`: campo numérico no card de configuração, salvando em `whatsapp_config`.
- Sem alterações em cálculo, currículo, pedidos, Z-API ou qualquer outro código.

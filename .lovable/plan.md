# Triagem do primeiro contato + mensagens de 1ª e 2ª conversa do dia

Antes de iniciar o fluxo inicial, o bot passa a analisar a primeira mensagem do cliente. Nada mais do bot muda: horários, menu, orçamento, currículo, pedidos, inatividade e simulador continuam iguais.

## Como o bot passa a decidir o primeiro contato

Ordem de análise da mensagem:

1. **Cliente enviou apenas arquivo(s)** (documento/imagem, sem texto reconhecível): o bot inicia direto o fluxo marcado como **Fluxo para arquivos** (por padrão, Fazer Orçamento).
2. **Cliente escreveu uma pergunta**: o bot procura uma **resposta automática** compatível (mesmo reconhecimento de palavras-chave já usado hoje).
   - Encontrou: pergunta "É sobre isso que você quer falar?" com SIM/NÃO.
   - **SIM** → envia o texto da resposta e executa a **ação vinculada ao SIM**.
   - **NÃO** → executa a **ação vinculada ao NÃO**.
   - Cada uma das duas ações pode ser: iniciar um fluxo, transferir para atendente, enviar outra resposta automática, ir para o fluxo inicial, finalizar o atendimento ou apenas aguardar a próxima mensagem.
3. **Nada reconhecido**: o bot **não inicia nada** — apenas aguarda a próxima mensagem e volta a procurar uma resposta automática ou fluxo compatível (até o tempo de inatividade já configurado).

## Duas mensagens por fluxo e por resposta automática

- Cada **fluxo** passa a ter duas mensagens iniciais: **1ª conversa do dia** e **demais conversas do mesmo dia**.
- Cada **resposta automática** passa a ter dois textos: **1ª conversa do dia** e **demais conversas do dia**.
- O dia vale até 23:59 (horário de São Paulo), usando a mesma verificação de "mesmo dia" já existente. Quando o segundo texto estiver vazio, o bot usa o primeiro.

## Aba Mensagens

- **Removidos** os campos: Boas-vindas, Retorno no mesmo dia, Texto antes do menu e Não entendi (essas mensagens passam a vir dos fluxos e das respostas automáticas).
- Permanecem: Fora do horário, Transferência para atendente, Finalização, Orçamento gerado, Em revisão, Orçamento confirmado.
- Cada mensagem restante ganha um botão **Ativo/Desativado**: quando desativada, o bot simplesmente não envia aquela mensagem.

## Banco de dados

- `bot_fluxos`: mensagem inicial para retorno no mesmo dia; marcação de "fluxo para arquivos" (apenas um por vez).
- `bot_respostas`: texto para retorno no mesmo dia, ação + destino para o SIM e ação + destino para o NÃO.
- `whatsapp_config`: um campo de ativo/desativado por mensagem restante; minutos da 1ª e da 2ª inatividade, mensagem da 1ª inatividade, status de destino da 2ª e mensagem por status de destino. Os campos removidos da tela continuam na tabela (não são apagados), apenas deixam de ser usados.
- `whatsapp_conversas`: marcação de qual aviso de inatividade já foi enviado (1º / 2º).

## Inatividade

- Dois tempos configuráveis: **1ª inatividade** (ex.: 5 min) e **2ª inatividade** (ex.: 10 min), contados desde a última mensagem.
- Na **1ª**, o bot envia a mensagem de aviso configurada. Na **2ª**, a conversa é movida para o **status escolhido** (Aguardando resposta / Pendente / Em atendimento / Finalizado), com a mensagem configurada **para aquele status** — cada status tem seu próprio texto, e o texto só é enviado se estiver preenchido.
- A contagem só acontece quando a conversa está na aba **Em atendimento** e o bot está **aguardando resposta do cliente**. Se quem deve responder é a loja (última mensagem foi do cliente), a conversa nunca entra em inatividade.
- Qualquer mensagem do cliente zera a contagem e os avisos.

## Tela do Bot

- Aba **Fluxos**: no formulário de novo/editar fluxo, dois campos de mensagem inicial (1ª conversa do dia / demais do dia). No cabeçalho, ao lado de "Fluxo inicial", um seletor **Fluxo para arquivos**.
- Aba **Respostas automáticas**: em cada resposta, os dois textos e dois blocos de destino — **Se SIM** e **Se NÃO** — com o tipo de ação e, quando aplicável, o fluxo ou a resposta de destino.
- Aba **Mensagens**: lista reduzida, cada card com switch Ativo/Desativado.
- Aba **Inatividade**: minutos da 1ª e da 2ª, mensagem da 1ª, seletor do status de destino e um campo de mensagem para cada status.


## Detalhes técnicos

- Migração com as colunas acima (RLS/GRANTs atuais mantidos).
- `src/lib/bot-fluxos.ts`: novos campos nos tipos `Fluxo`.
- `src/lib/bot-motor.ts`: tipo `BotResposta` com os textos e ações de SIM/NÃO; deixa de depender de boas-vindas/menu/não entendi.
- `src/lib/bot-fluxos-motor.ts`: `iniciar()` recebe se é a primeira conversa do dia e escolhe a mensagem inicial correspondente.
- `src/lib/bot.server.ts`: triagem na entrada (arquivo → fluxo de arquivos; texto → resposta automática com confirmação SIM/NÃO e execução da ação vinculada; nada reconhecido → aguarda). A confirmação pendente fica no contexto da conversa, junto do estado de fluxo já existente. Envio de cada mensagem passa a respeitar o respectivo ativo/desativado.
- `src/lib/bot-dados.server.ts`: carrega os novos campos.
- `src/components/ConfiguracaoBot.tsx` e `src/components/bot/FluxosPainel.tsx`: ajustes de interface.
- Sem alterações em cálculo de orçamento, currículo, pedidos, Z-API ou qualquer código sem ligação com essa triagem.

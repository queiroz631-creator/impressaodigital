# Triagem do primeiro contato + mensagens de 1ª e 2ª conversa do dia

Antes de iniciar o fluxo inicial, o bot passa a analisar a primeira mensagem do cliente. Nada mais do bot muda: horários, menu, palavras-chave, orçamento, currículo, pedidos, inatividade e simulador continuam iguais.

## Como o bot passa a decidir o primeiro contato

Ordem de análise da primeira mensagem de uma conversa:

1. **Cliente enviou apenas arquivo(s)** (documento/imagem, sem texto reconhecível): o bot inicia direto o fluxo marcado como **Fluxo para arquivos** (por padrão, Fazer Orçamento).
2. **Cliente escreveu uma pergunta**: o bot procura uma **resposta automática** compatível (mesmo reconhecimento de palavras-chave já usado hoje).
   - Encontrou: pergunta "É sobre isso que você quer falar?" com SIM/NÃO.
   - SIM → envia o texto da resposta automática; se essa resposta tiver um **fluxo vinculado**, o bot já começa a conversa por esse fluxo. Sem fluxo vinculado, segue para o fluxo inicial.
   - NÃO → segue para o fluxo inicial.
3. **Nada reconhecido**: fluxo inicial, como hoje.

## Duas mensagens por fluxo e por resposta automática

- Cada **fluxo** passa a ter duas mensagens iniciais: **1ª conversa do dia** (a atual) e **demais conversas do mesmo dia**.
- Cada **resposta automática** passa a ter dois textos: **1ª conversa do dia** e **demais conversas do dia**.
- O dia vale até 23:59 (horário de São Paulo), usando a mesma verificação de "mesmo dia" já existente na saudação. Quando o segundo texto estiver vazio, o bot usa o primeiro.

## Banco de dados

- `bot_fluxos`: novo campo de mensagem inicial para retorno no mesmo dia; nova marcação de "fluxo para arquivos" (apenas um fluxo marcado por vez).
- `bot_respostas`: novo campo de texto para retorno no mesmo dia e vínculo opcional com um fluxo.
- Nenhum campo existente é removido; os dados atuais continuam como a mensagem/resposta da 1ª conversa do dia.

## Tela do Bot

- Aba **Fluxos**: no formulário de novo/editar fluxo, dois campos de mensagem inicial (1ª conversa do dia / demais do dia). No cabeçalho, ao lado de "Fluxo inicial", um seletor **Fluxo para arquivos**.
- Aba **Respostas automáticas**: em cada resposta, os dois textos e um seletor **Iniciar fluxo após responder** (opcional).

## Detalhes técnicos

- Migração adicionando as colunas acima (com os GRANTs/RLS já existentes nessas tabelas mantidos).
- `src/lib/bot-fluxos.ts`: novos campos nos tipos `Fluxo`.
- `src/lib/bot-fluxos-motor.ts`: `iniciar()` recebe se é a primeira conversa do dia e escolhe a mensagem inicial correspondente.
- `src/lib/bot.server.ts`: em `rodarFluxo`, na abertura da conversa, aplica a triagem (arquivo → fluxo de arquivos; texto → resposta automática com confirmação SIM/NÃO; senão fluxo inicial). A confirmação pendente fica gravada no contexto da conversa, junto do estado de fluxo já existente.
- `src/lib/bot-dados.server.ts`: carrega os novos campos de respostas/fluxos.
- `src/components/ConfiguracaoBot.tsx` (respostas) e `src/components/bot/FluxosPainel.tsx` (fluxos): campos novos na interface.
- Sem alterações em cálculo de orçamento, currículo, pedidos, Z-API ou qualquer código sem ligação com essa triagem.

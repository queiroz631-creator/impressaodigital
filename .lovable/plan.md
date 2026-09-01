# Escolher o fluxo que inicia por inatividade

Hoje a aba **Inatividade** já tem o campo "Iniciar fluxo inicial após (minutos)", mas o bot sempre
dispara o **primeiro fluxo ativo na ordem de cadastro** — não dá para escolher qual.

## O que muda

- Na aba **Inatividade**, ao lado do campo de minutos, entra um seletor **"Fluxo a iniciar"** com a
  lista dos fluxos ativos.
- Opção padrão "Primeiro fluxo ativo" mantém o comportamento atual, para quem não escolher nada.
- Passado o tempo configurado sem o bot reconhecer nada, ele inicia exatamente o fluxo escolhido.
- Se o fluxo escolhido for apagado ou desativado, o bot volta a usar o primeiro fluxo ativo.

## Inatividade só conta quando o bot espera resposta

- A 1ª e a 2ª inatividade passam a ser contadas **apenas** quando o bot está de fato aguardando algo
  do cliente (etapa de fluxo que espera resposta, confirmação Sim/Não, aguardando arquivos). Conversa
  em que o bot não espera nada não recebe aviso nem muda de status por inatividade.
- O tempo é contado a partir da **última mensagem do cliente**, e não da última mensagem enviada
  pelo bot.
- **Arquivo recebido conta como resposta**: ao chegar um arquivo, a contagem reinicia (o aviso de
  inatividade é zerado) e quem responde é a regra de arquivo — a etapa do fluxo que recebe arquivos
  ou, no primeiro contato, a regra "só arquivos" / "arquivos + palavras-chave". O bot não trata o
  arquivo como mensagem não reconhecida.

Nada mais muda: mensagens de 1ª/2ª inatividade, status de destino, primeiro contato, respostas
automáticas, fluxos, calculadora, currículo e pedidos ficam iguais.

## Detalhes técnicos

- Migração: `whatsapp_config.fallback_fluxo_id` (uuid, nulo, `references bot_fluxos(id) on delete set null`).
- `src/lib/bot-motor.ts` e `src/lib/bot-dados.server.ts`: novo campo em `BotConfig`.
- `src/lib/bot.server.ts` (`verificarInatividade`): usar `fluxoPorId(fluxos, config.fallback_fluxo_id)`
  quando definido e ativo; senão `fluxoInicial(fluxos)`. Auditoria registra o nome do fluxo.
- Inatividade: parar de usar `ultima_mensagem_em` (que também é gravado nos envios do bot em
  `responder`) como base do tempo e passar a usar a última mensagem de entrada do cliente
  (`whatsapp_mensagens` com `direcao = 'entrada'`, guardada em coluna própria
  `ultima_entrada_em` para evitar consulta por conversa). Só entram na varredura conversas cujo
  estado indica espera: contexto com fluxo/etapa que aguarda resposta, `triagem` pendente ou etapa
  `aguardando_arquivos`.
- Recebimento de arquivo no webhook/`processarMensagem`: atualiza `ultima_entrada_em` e zera
  `inatividade_avisada`, mantendo o roteamento atual pelas regras de arquivo.
- `src/components/ConfiguracaoBot.tsx`: carregar/salvar o campo e renderizar o `Select` na aba
  Inatividade, ao lado do campo de minutos — sem mudança de layout.


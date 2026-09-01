# Escolher o fluxo que inicia por inatividade

Hoje a aba **Inatividade** já tem o campo "Iniciar fluxo inicial após (minutos)", mas o bot sempre
dispara o **primeiro fluxo ativo na ordem de cadastro** — não dá para escolher qual.

## O que muda

- Na aba **Inatividade**, ao lado do campo de minutos, entra um seletor **"Fluxo a iniciar"** com a
  lista dos fluxos ativos.
- Opção padrão "Primeiro fluxo ativo" mantém o comportamento atual, para quem não escolher nada.
- Passado o tempo configurado sem o bot reconhecer nada, ele inicia exatamente o fluxo escolhido.
- Se o fluxo escolhido for apagado ou desativado, o bot volta a usar o primeiro fluxo ativo.
- Continua valendo: 0 minutos desativa a regra, e conversas aguardando confirmação Sim/Não seguem a
  inatividade normal.

Nada mais muda: mensagens de 1ª/2ª inatividade, status de destino, primeiro contato, respostas
automáticas, fluxos, calculadora, currículo e pedidos ficam iguais.

## Detalhes técnicos

- Migração: `whatsapp_config.fallback_fluxo_id` (uuid, nulo, `references bot_fluxos(id) on delete set null`).
- `src/lib/bot-motor.ts` e `src/lib/bot-dados.server.ts`: novo campo em `BotConfig`.
- `src/lib/bot.server.ts` (`verificarInatividade`): usar `fluxoPorId(fluxos, config.fallback_fluxo_id)`
  quando definido e ativo; senão `fluxoInicial(fluxos)`. Auditoria registra o nome do fluxo.
- `src/components/ConfiguracaoBot.tsx`: carregar/salvar o campo e renderizar o `Select` na aba
  Inatividade, ao lado do campo de minutos — sem mudança de layout.

# Desativar a mensagem antiga "Fora do horário"

Hoje, ao receber o primeiro contato fora do horário, o bot dispara a mensagem global "Fora do horário" antes de aplicar a regra de primeiro contato. Essa mensagem está ativa na configuração e será desativada de vez.

## O que muda

- A mensagem "Fora do horário" deixa de ser enviada em qualquer ponto do atendimento (primeiro contato, menu e saudação).
- O primeiro contato passa a responder somente pela regra configurada.
- A mensagem de "Transferência fora do horário" continua funcionando normalmente.
- Nada mais no bot é alterado.

## Detalhes técnicos

1. Migração: `UPDATE whatsapp_config SET msg_fora_horario_ativo = false;` (o campo e o texto continuam salvos, apenas desligados).
2. `src/lib/bot.server.ts`: remover o envio de `msg_fora_horario` em `triagem()` (linha ~1075) e no bloco de menu/saudação (linha ~1644).
3. `src/lib/bot.functions.ts`: remover a mesma mensagem do simulador (linha ~30) para refletir o comportamento real.
4. `src/components/ConfiguracaoBot.tsx`: marcar o item "Fora do horário" como desativado/em desuso na lista de mensagens (ou remover o card), evitando reativação acidental.

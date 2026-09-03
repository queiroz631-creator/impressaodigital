# Fora do horário: só a mensagem especial na transferência

## O que foi verificado

- O fluxo iniciado pela inatividade é o "Falar com Atendente" (configurado como fluxo de fallback, 5 minutos).
- Esse fluxo tem uma única etapa, com o texto "Certo! Vou chamar um atendente para continuar com você. *Aguarde!*😊" e ação **Transferir para atendente (sem mensagem)**.
- Na conversa real de 02/09 às 20h38 (Brasília) o cliente recebeu as duas mensagens: primeiro o texto da etapa, logo depois a mensagem de fora do horário.

## O que muda

Fora do horário de funcionamento, quando a etapa/opção do fluxo termina em transferência para atendente (normal ou sem mensagem) e a mensagem própria de fora do horário está ligada e preenchida:

- O bot **não envia o texto da etapa** do fluxo.
- Envia **somente** a mensagem de fora do horário configurada na aba Horários.
- A transferência acontece igual: status Aguardando, etapa aguardando atendente, motivo e auditoria iguais.

Dentro do horário nada muda: o texto do fluxo é enviado normalmente e a transferência silenciosa continua sem aviso extra.

## Detalhes técnicos

- `src/lib/bot.server.ts`, em `entregarFluxo`: antes de enviar as mensagens de um passo, se `atual.transferir` (ou `atual.acao` for `transferir_atendente`/`transferir_silencioso`) e a regra de fora do horário estiver valendo no momento (`dentroDoHorario` falso + `msg_transferencia_fora_horario_ativo` + texto preenchido), pular o envio das mensagens desse passo e ir direto para a ação.
- Os dados do bot já são recarregados nesse caminho; reaproveitar a mesma verificação usada em `transferir()` para não duplicar consultas.
- Sem alteração de banco, de telas ou de qualquer outro comportamento (inatividade, finalização, respostas automáticas, primeiro contato continuam iguais).

# Mensagem de transferência fora do horário não chega ao cliente

## O que foi verificado

- A configuração está correta no banco: a regra está **ligada** e com o texto preenchido (com o horário da loja).
- Os horários estão certos: seg–sex 8h–18h, sábado 8h–13h, domingo fechado, modo 24 h desligado.
- O código do bot já contém a regra: no momento da transferência, fora do horário, a mensagem configurada substitui a mensagem normal de transferência (inclusive nas transferências silenciosas).
- Na última transferência real registrada (02/09 às 19h30 de Brasília, portanto fora do horário) o cliente recebeu apenas a mensagem do fluxo — a mensagem nova não foi enviada.

## Causa provável

O WhatsApp responde pelo site **publicado**, não pela pré-visualização. A regra foi implementada depois da última publicação, então o atendimento real ainda está rodando a versão antiga do bot.

## O que fazer

1. Publicar o aplicativo para que o atendimento passe a usar a versão com a nova regra.
2. Testar no simulador (Bot → Simulador) uma transferência fora do horário e confirmar que a mensagem aparece.
3. Fazer um teste real pelo WhatsApp fora do horário e conferir na conversa se a mensagem foi registrada.
4. Se, mesmo publicado, a mensagem não sair, investigar os registros do servidor no momento da transferência e ajustar o ponto exato que estiver falhando.

## Detalhes técnicos

- Sem alteração de banco: `whatsapp_config.msg_transferencia_fora_horario` e `..._ativo` já existem e estão preenchidos.
- `transferir()` em `src/lib/bot.server.ts` já recarrega os dados do bot, avalia `dentroDoHorario()` no instante da transferência e troca o aviso.
- Nenhuma mudança de código prevista nesta etapa; apenas publicação e verificação. Correções só entram se o teste pós-publicação continuar falhando.

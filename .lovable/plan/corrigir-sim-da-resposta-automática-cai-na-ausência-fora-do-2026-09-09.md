# Corrigir: "sim" da resposta automática cai na ausência fora do horário

## O que foi verificado

- Fora do horário, antes de qualquer outra coisa, o bot envia a mensagem de ausência e coloca a conversa em **Aguardando**, encerrando o processamento daquela mensagem.
- Essa regra só é pulada quando o texto do cliente combina com uma palavra-chave de resposta automática.
- Quando o bot pergunta "Você quer falar sobre *Currículo*?" e o cliente responde **sim**, o "sim" não é uma palavra-chave — então a ausência dispara, a conversa vai para Aguardando e a confirmação nunca é processada.

## O que muda

- A mensagem de ausência passa a **não interromper** uma conversa que está esperando a resposta de uma pergunta do bot (confirmação SIM/NÃO ou escolha de opção pendente).
- Nesse caso o bot processa normalmente a resposta do cliente (envia o conteúdo da resposta automática, executa a ação configurada etc.), como acontece dentro do horário.
- Nada mais muda: primeiro contato fora do horário continua recebendo a ausência uma vez por atendimento, respostas rápidas continuam com prioridade, e dentro do horário tudo segue igual.

## Detalhes técnicos

- `src/lib/bot.server.ts`, bloco de ausência em `processarBotInterno` (por volta da linha 1674): adicionar à condição de pular a ausência o caso de haver pergunta pendente no contexto (`ctx.pendenteTipo` preenchido), além do fluxo em andamento e da resposta rápida já existentes.
- Sem migração, sem mudança de telas, sem alteração em fluxos, inatividade ou finalização.

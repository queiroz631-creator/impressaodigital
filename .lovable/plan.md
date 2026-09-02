# Exibir "digitando..." para o cliente no WhatsApp

## Objetivo

Quando o bot estiver preparando uma resposta, o cliente vê o indicador **"digitando..."** no WhatsApp dele, como se fosse uma pessoa atendendo. Isso é feito pelo endpoint `send-presence` da Z-API (presença `composing`).

## O que será feito

### 1. Nova função no cliente Z-API — `src/lib/zapi.server.ts`
- Adicionar `enviarPresencaDigitando(telefone, duracaoMs)` que chama:
  - `POST /instances/{id}/token/{token}/send-presence`
  - corpo: `{ "phone": telefone, "presence": "composing", "delay": duracaoMs }`
- Falha silenciosa: se a presença falhar, o envio da mensagem continua normalmente.

### 2. Acionar "digitando..." antes de cada resposta do bot — `src/lib/bot.server.ts`
- No ponto central de envio (`enviarMensagens`, antes de chamar `send-text`/`send-image`/etc.), chamar `enviarPresencaDigitando` antes do envio.
- Duração do "digitando..." proporcional ao tamanho da mensagem:
  - mínimo ~1,5s, máximo ~4s (ex.: `min(4000, 1500 + texto.length * 20)` ms);
  - quando a regra/fluxo já tiver `delay_segundos` configurado, o "digitando..." aparece durante esse delay (presença enviada antes da espera).
- Aplicável a todas as respostas automáticas: primeiro contato, fluxos, respostas automáticas, inatividade e finalização — como tudo passa pelo mesmo ponto de envio, uma única alteração cobre todos.

### 3. Atendente humano (opcional, incluído se simples)
- Na tela de conversa (`/whatsapp`), quando o atendente estiver digitando na caixa de mensagem, enviar presença `composing` também — com debounce (a cada ~4s enquanto digita) e parando ao enviar.
- Se preferir, esta parte pode ficar de fora e fazemos só para o bot.

## Detalhes técnicos
- O indicador "digitando..." do WhatsApp dura no máximo ~10-15s por chamada; o `delay` da Z-API controla por quanto tempo a presença fica visível.
- Nenhuma alteração de banco de dados é necessária.
- Não há custo adicional por chamada de presença na Z-API além da requisição normal.

## Fora de escopo
- Indicador de "gravando áudio" (`recording`) — pode ser adicionado depois se desejar.

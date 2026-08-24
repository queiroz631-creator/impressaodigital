# Bot responde no sistema, mas o cliente não recebe

## O que foi verificado

- A conexão do WhatsApp está ativa (instância conectada, celular conectado).
- As mensagens manuais do atendente (texto simples) são enviadas normalmente.
- As respostas do bot que aparecem no sistema são gravadas como "enviada" — ou seja, a API respondeu OK, mas nada chegou ao cliente.
- Essas respostas do bot são enviadas primeiro como **lista de botões** (`send-button-list`). Quando a API aceita a chamada mas o número não entrega botões, a mensagem some silenciosamente: o sistema marca "enviada" e o cliente nunca recebe. Isso bate com o histórico — a cliente repetiu "horário" três vezes (04:39, 04:47, 05:07) sem nunca obter resposta.
- Observação secundária: existe uma conversa criada com o nome "Impressão Digital" e o número da própria loja, ou seja, mensagens do próprio número estão abrindo conversa e o bot tenta responder a si mesmo.

## Correção

1. **Enviar sempre texto simples.** O bot deixa de usar lista de botões e passa a mandar a pergunta com as opções escritas na própria mensagem (ex.: "Responda *SIM* ou *NÃO*", ou opções numeradas 1, 2, 3). O motor de fluxos já entende respostas por texto e por número.
2. **Confirmar a entrega de verdade.** Guardar o identificador que a API devolve em cada envio e só marcar "enviada" quando ele vier; sem identificador, marcar como erro com o detalhe retornado — assim o problema fica visível na conversa em vez de silencioso.
3. **Ignorar o próprio número.** O webhook passa a descartar mensagens cujo remetente é o número da própria loja, evitando conversas e respostas para si mesmo.
4. Testar enviando uma mensagem real e conferindo se a resposta do bot chega ao celular do cliente.

## Detalhes técnicos

- `src/lib/bot.server.ts` → função `responder`: remove a tentativa `send-button-list` e envia sempre `send-text` com as opções no texto; grava `whatsapp_message_id` a partir da resposta da Z-API e define `status`/`erro` conforme o retorno.
- `src/routes/api/public/whatsapp/webhook.ts`: descarta callbacks cujo telefone é o número conectado da própria instância.
- Nenhuma mudança nos fluxos, respostas automáticas, inatividade ou telas.

## Fora do escopo

Layout do atendimento, configurações do bot e o agendamento recém-criado permanecem como estão.

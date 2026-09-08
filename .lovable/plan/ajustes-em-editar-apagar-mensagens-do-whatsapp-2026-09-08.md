# Ajustes em editar/apagar mensagens do WhatsApp

Três correções pedidas: ver quando o cliente apaga, fazer a edição chegar de fato ao cliente e liberar os botões em mensagens com imagem/arquivo.

## 1. Cliente apagou a mensagem

Hoje o sistema só marca como apagada quando a exclusão parte da loja. Quando o cliente apaga, o WhatsApp avisa por um aviso de "mensagem revogada" que o sistema ignora.

- Passar a reconhecer esse aviso no recebimento de mensagens e marcar a mensagem correspondente como apagada.
- A bolha do cliente passa a aparecer igual à nossa: tom bem claro, texto riscado e o rótulo "mensagem apagada".
- Se a mensagem apagada era a última da conversa, o resumo na lista de contatos passa a mostrar "Mensagem apagada".
- O bot não é acionado por esse aviso.

## 2. A edição não aparece para o cliente

Verificado na documentação do provedor (Z-API): **não existe recurso de editar mensagem já enviada**. Por isso hoje a alteração só muda no nosso histórico.

Solução: ao salvar a edição, o sistema vai **apagar a mensagem original no WhatsApp do cliente e enviar o texto corrigido em seguida**. Para o cliente, a mensagem antiga some e chega a nova já corrigida.

- O aviso do diálogo de edição explica isso em uma linha ("a mensagem antiga será apagada e o texto corrigido será reenviado").
- No nosso histórico continua sendo a mesma mensagem, agora com o texto novo e a marca "editada" (guardando o texto original).
- Se o WhatsApp recusar apagar (prazo expirado), nada é alterado e aparece um aviso explicando.
- Edição continua valendo só para mensagens de texto enviadas pela loja.

## 3. Mensagens com imagem/arquivo sem opção de apagar

As opções não aparecem porque, ao enviar imagem, PDF ou mensagem rápida com imagem, o sistema não guardava o identificador da mensagem no WhatsApp.

- Passar a guardar esse identificador nesses envios (arquivo/imagem e mensagem rápida), como já acontece no texto.
- Com isso, a lixeira aparece nessas mensagens; o lápis (editar) segue apenas em mensagens de texto.
- Mensagens antigas, enviadas antes desta correção, continuam sem o botão porque não têm o identificador salvo.

## Detalhes técnicos

- `src/routes/api/public/whatsapp/webhook.ts`: tratar `notification === "REVOKE"` (e variações de revogação) antes do fluxo normal — localizar `whatsapp_mensagens` por `whatsapp_message_id` (usar também o id referenciado quando vier no payload), marcar `apagada`/`apagada_em`, ajustar `ultima_mensagem` da conversa e retornar sem acionar o bot. Também tratar `isEdit === true` em mensagens recebidas: atualizar `texto` e marcar `editada`.
- `src/lib/whatsapp.functions.ts`:
  - `editarMensagemWhatsapp`: substituir a chamada inexistente `edit-message` por `DELETE messages?messageId=...&phone=...&owner=true` seguido de `send-text`; em sucesso, atualizar `texto`, `texto_original`, `editada`, `editada_em` e o novo `whatsapp_message_id`; auditoria mantida.
  - `enviarArquivoWhatsapp` e `enviarMensagemRapidaWhatsapp`: extrair `messageId`/`zaapId` da resposta da Z-API e gravar em `whatsapp_message_id` (mesmo padrão de `enviarTextoWhatsapp`).
- `src/routes/whatsapp.tsx`: apenas o texto de aviso no diálogo de edição; a regra atual de exibição dos botões já cobre imagem/arquivo assim que o identificador existir.
- Sem migração de banco: as colunas `editada`, `apagada` etc. já existem.
- Validar com typecheck e build.

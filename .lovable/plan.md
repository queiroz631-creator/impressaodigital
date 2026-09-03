# Enviar mensagem do WhatsApp com Enter

## Objetivo
Permitir que o atendente envie a mensagem pressionando a tecla `Enter` no campo de texto da conversa, mantendo `Shift+Enter` para quebra de linha.

## Alteração
- No componente `Conversa` em `src/routes/whatsapp.tsx`, adicionar um handler `onKeyDown` no `<Textarea>` de mensagem.
- Se a tecla for `Enter` e `Shift` **não** estiver pressionado:
  - `event.preventDefault()`
  - Chamar o envio com o texto trimado, desde que não esteja vazio e não haja envio em andamento (`!envio.isPending`).
- `Shift+Enter` continua inserindo quebra de linha normalmente.

## Validação
- `tsgo --noEmit -p tsconfig.json`
- Build do projeto
- Teste rápido no preview: digitar uma mensagem e pressionar Enter para enviar; Shift+Enter para nova linha.

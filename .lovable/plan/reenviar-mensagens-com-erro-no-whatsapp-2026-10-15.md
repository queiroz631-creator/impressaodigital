# Reenviar mensagens com erro no WhatsApp

## Objetivo
Quando uma mensagem enviada pela loja falhar (status "erro"), mostrar um botão **Reenviar** na própria mensagem, permitindo tentar o envio novamente sem redigitar o conteúdo.

## O que será feito

1. **Botão "Reenviar" na mensagem com erro**
   - Aparece somente em mensagens enviadas pela loja com status "erro", ao lado do aviso de erro já existente.
   - Mostra estado de "reenviando…" e impede cliques duplicados.

2. **Reenvio pelo servidor (nova função `reenviarMensagemWhatsapp`)**
   - Recebe o identificador da mensagem, valida permissão e confirma que ela está com erro e não foi apagada.
   - Reenvia o mesmo conteúdo (texto ou arquivo/imagem já registrado) pela mesma conversa e conexão, reutilizando as funções de envio atuais.
   - Em caso de sucesso: atualiza a mensagem para "enviada", limpa o erro e guarda o novo identificador do WhatsApp.
   - Em caso de falha: mantém o status "erro" e atualiza a mensagem de erro, sem criar mensagem duplicada no histórico.

3. **Sem alterações em outros módulos**
   - Não muda validações, fluxo do bot, status das conversas nem telas fora do WhatsApp.

## Detalhes técnicos
- Nova função em `src/lib/whatsapp.functions.ts` (`reenviarMensagemWhatsapp`), reutilizando `chamarZapi`, `conexaoDaConversa` e `promoverParaEmAtendimento`.
- Ajuste pontual em `src/routes/whatsapp.tsx` na renderização da mensagem com erro (linha ~1766) para incluir o botão e a mutação de reenvio, invalidando o cache de mensagens ao concluir.
- Mensagens de arquivo sem conteúdo salvo no Storage não poderão ser reenviadas; nesse caso o botão fica oculto ou mostra aviso claro.

## Verificação
- Testar reenvio de texto com sucesso e com nova falha (respostas simuladas, sem mensagens reais).
- Conferir que não há envio duplicado e que o histórico mantém uma única mensagem.
- Build e testes existentes sem regressões; sem publicar.

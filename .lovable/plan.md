# Corrigir mensagens enviadas fora do sistema

## Diagnóstico confirmado

- O histórico recente não contém nenhum callback com `fromMe = true`; portanto, as mensagens do celular/WhatsApp Web não estão chegando ao sistema.
- O webhook já sabe gravar essas mensagens como saída, mas hoje aceita somente callbacks cujo tipo seja `ReceivedCallback`.
- A configuração atual orienta apenas o webhook **Ao receber**. A Z-API exige também ativar `notifySentByMe = true` para incluir, nesse webhook, mensagens enviadas pelo próprio número.

## Correção

1. **Ativar a notificação no provedor**
   - Adicionar uma ação autenticada no backend para habilitar `notifySentByMe` na instância conectada.
   - Ampliar o cliente Z-API para aceitar requisições `PUT`.
   - Expor em Configurações → WhatsApp um botão claro para configurar/reativar essa sincronização e mostrar sucesso ou erro real.

2. **Aceitar com segurança o callback de saída**
   - Manter `ReceivedCallback` como evento principal e aceitar a mensagem enviada pelo próprio número quando `fromMe = true`, sem confundi-la com callbacks de entrega/status.
   - Continuar deduplicando pelo identificador da mensagem para não duplicar mensagens que o próprio sistema já registrou ao enviar.
   - Gravar como saída, autor “Atendente (WhatsApp)”, sem não lidas, sem bot e sem reabrir atendimento finalizado.

3. **Orientação de configuração**
   - Atualizar o texto da tela para explicar que o endereço deve estar em **Ao receber** e que “notificar enviadas por mim” precisa estar ativo; remover a orientação incorreta de usar callbacks de status para esse histórico.

## Validação

- Ativar a sincronização pela tela de Configurações e confirmar a resposta positiva da Z-API.
- Enviar uma mensagem pelo celular/WhatsApp Web e verificar que aparece imediatamente no painel, do lado das mensagens de saída.
- Confirmar que ela não aciona o bot, não aumenta não lidas e não reabre conversa finalizada.
- Enviar uma mensagem pelo próprio sistema e confirmar que o callback não cria uma cópia duplicada.

## Escopo técnico

- `src/lib/zapi.server.ts`: suporte ao método `PUT`.
- `src/lib/whatsapp.functions.ts`: função autenticada para ativar a notificação de mensagens enviadas pelo próprio número.
- `src/routes/configuracoes.tsx`: ação de configuração, retorno visual e instruções corretas.
- `src/routes/api/public/whatsapp/webhook.ts`: tornar a validação do tipo compatível com callbacks próprios sem liberar eventos de status.
- Sem mudanças no bot, fluxos, calculadora ou demais módulos.

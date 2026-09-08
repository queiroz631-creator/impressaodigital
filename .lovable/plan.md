# WhatsApp não está recebendo mensagens

## O que eu verifiquei agora

- O número está conectado na Z-API (`connected: true`, celular conectado).
- O envio funciona: há mensagem de saída registrada hoje às 02:44.
- A última mensagem recebida de cliente foi ontem às 20:50.
- Nos registros da última hora não há **nenhuma** chamada para o endereço de recebimento (`/api/public/whatsapp/webhook`), enquanto as rotinas internas (inatividade, status) chamam normalmente a cada minuto.

Conclusão: o problema não está no sistema nem na conexão do WhatsApp — a Z-API simplesmente não está avisando o sistema quando chega mensagem. Isso acontece quando o endereço de recebimento cadastrado na Z-API está vazio, com token antigo, ou apontando para um endereço de pré-visualização que mudou (a tela de Configurações monta esse endereço usando o endereço da janela aberta na hora).

## O que vou fazer

1. **Fixar o endereço correto na tela de Configurações**
   Em vez de usar o endereço da janela atual, mostrar sempre o endereço estável do sistema, com o token atual. Assim o texto copiado nunca aponta para um endereço temporário.

2. **Botão "Reconectar recebimento"**
   Novo botão ao lado do endereço que registra automaticamente na Z-API os avisos de mensagem recebida, mensagem enviada por mim e status de entrega — sem precisar entrar no painel da Z-API.

3. **Botão "Testar recebimento"**
   Mostra na tela: se o número está conectado, quando foi a última mensagem recebida e quando foi a última chamada da Z-API ao sistema. Serve para confirmar na hora se voltou a funcionar.

4. **Validação final**
   Depois de reconectar, peço para você mandar uma mensagem de teste do seu celular e confirmo pelos registros que ela chegou e apareceu na tela do WhatsApp.

## Detalhes técnicos

- Endereço estável: `https://impressaodigital.lovable.app/api/public/whatsapp/webhook?token=<webhook_token>`.
- Registro via Z-API: `POST /instances/{id}/token/{token}/update-webhook-received`, `update-webhook-message-status` e `update-webhook-received-delivery`, com header `Client-Token`.
- Chamadas à Z-API ficam em um server function novo (`src/lib/whatsapp-webhook.functions.ts`) usando os segredos já existentes (`ZAPI_*`); a tela em `src/routes/configuracoes.tsx` só chama esse server function.
- Nenhuma alteração no fluxo do bot, no layout geral ou no banco de dados (apenas leitura de `whatsapp_config` e das últimas mensagens para o diagnóstico).

# Botão de reconfiguração do webhook do WhatsApp

Hoje a URL do webhook só pode ser copiada e colada manualmente no painel da Z-API. Como o endereço do site mudou, o webhook antigo deixou de entregar mensagens. A ideia é ter um botão que ajusta isso sozinho.

## O que muda na tela

Em Configurações → WhatsApp (Z-API), ao lado de "Testar conexão":

- Novo botão **Reconfigurar webhook**: grava automaticamente na Z-API o endereço atual de recebimento (mensagens recebidas, mensagens enviadas pelo celular, status de entrega e desconexão).
- Uma linha mostrando o endereço que está atualmente gravado na Z-API, com aviso em vermelho quando ele estiver diferente do endereço correto.
- Mensagem de sucesso ou de erro após clicar.

Nada mais da tela muda: copiar URL, testar conexão e ativar mensagens do celular continuam iguais.

## Endereço usado

Será usado o endereço fixo de produção do site (impressaodigital.lovable.app) com o token de segurança já existente, para o webhook não quebrar de novo em futuras publicações. A tela avisa quando estiver aberta em endereço diferente do de produção.

## Detalhes técnicos

- Novas server functions em `src/lib/whatsapp.functions.ts`:
  - `lerWebhooksZapi`: GET nas rotas de leitura de webhook da Z-API para exibir o que está gravado.
  - `reconfigurarWebhooksZapi`: PUT em `update-webhook-received`, `update-webhook-received-delivery`, `update-webhook-message-status` e `update-webhook-disconnected` usando `chamarZapi` de `src/lib/zapi.server.ts`, com a URL `<SITE_URL>/api/public/whatsapp/webhook?token=<webhook_token>` lida de `whatsapp_config`.
  - Retorno tipado `{ ok, erro? , urls? }`; erros da Z-API registrados no servidor e resumidos ao usuário.
- `CardWhatsapp` em `src/routes/configuracoes.tsx` ganha uma query para o estado atual e uma mutation para o botão, com invalidação após sucesso.
- Sem alterações de banco, layout geral ou lógica do bot.

## Verificação

Após implementar: clicar em Reconfigurar, conferir que a leitura passa a mostrar o endereço novo e enviar uma mensagem de teste do celular para confirmar que a conversa aparece no sistema.

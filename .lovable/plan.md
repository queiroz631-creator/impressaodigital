# Configurar a Z-API na VPS

## Como funciona (sem alteração de código)

O sistema já está preparado: as credenciais da Z-API são lidas de variáveis de ambiente e o botão **Reconfigurar webhook** (em Configurações → WhatsApp) grava na Z-API o endereço definido em `SITE_URL`.

## Passo a passo na VPS

1. No `.env` da aplicação na VPS, preencher (modelo já existe em `deploy/.env.example`):
   - `ZAPI_BASE_URL=https://api.z-api.io`
   - `ZAPI_INSTANCE_ID` — ID da instância (painel da Z-API)
   - `ZAPI_INSTANCE_TOKEN` — token da instância (vem na URL de envio do painel)
   - `ZAPI_CLIENT_TOKEN` — Client-Token da conta (painel da Z-API → Segurança)
   - `SITE_URL=https://seudominio.com` — domínio público da VPS (essencial: é ele que vai para o webhook)
2. Reiniciar a aplicação: `pm2 reload impressaodigital` (as variáveis só são lidas no início do processo).
3. Abrir o sistema pelo domínio da VPS → Configurações → WhatsApp (Z-API):
   - Clicar em **Testar conexão** para confirmar as credenciais.
   - Clicar em **Reconfigurar webhook** — ele grava na Z-API os 4 webhooks (recebidas, enviadas pelo celular, status de entrega e desconexão) apontando para `https://seudominio.com/api/public/whatsapp/webhook?token=...`.
   - Conferir a linha que mostra o endereço gravado na Z-API: deve ficar sem o aviso vermelho de divergência.
4. Enviar uma mensagem de teste do celular e confirmar que a conversa aparece no sistema.
5. Recriar no banco da VPS os agendamentos do bot (inatividade, fila, status) apontando para o domínio da VPS — já documentado no `deploy/README.md`.

## O que será alterado no projeto

- `deploy/README.md`: nova seção "Z-API (WhatsApp)" com o passo a passo acima e observação de que, sem `SITE_URL` correto, o webhook apontaria para o endereço Lovable.

## Pontos de atenção

- Não é preciso mexer no painel da Z-API manualmente — o botão faz tudo via API.
- Se a VPS ainda estiver sem HTTPS/domínio definitivo, o webhook precisa ser reconfigurado de novo depois que o domínio estiver no ar.
- A transcrição de áudio e a interpretação do bot usam `LOVABLE_API_KEY`, que só funciona no ambiente Lovable; na VPS esses recursos ficam indisponíveis até adaptarmos para uma chave própria (ex.: Google Gemini) — isso é separado da Z-API.

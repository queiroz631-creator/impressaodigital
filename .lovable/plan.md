# Aba WhatsApp das Configurações após a Etapa 3

## Problema

A aba **WhatsApp** dentro de Configurações foi feita para uma única conexão e ficou desalinhada com o novo modelo de múltiplas conexões:

- Testa a conexão usando apenas as credenciais do servidor (a tela da imagem mostra "Desconectado — Instance not found"), ignorando as conexões cadastradas.
- Mostra e tenta gravar o **endereço de webhook antigo** (com `?token=`), diferente do endereço novo por conexão (`/api/public/whatsapp/webhook/<token>`).
- **Corrige o webhook automaticamente ao abrir a página** — isso viola a regra definida na Etapa 3 de que o webhook só muda quando o administrador clica em "Reconfigurar webhook".
- Orienta a guardar credenciais em variáveis de ambiente, embora agora elas fiquem na página Conexões.

## Objetivo

A aba WhatsApp das Configurações deixa de gerenciar conexão e vira um cartão simples com:

1. **Endereço do sistema** (mantido como está — é o endereço público usado pelas rotinas do bot e como base dos webhooks), com Salvar e "Usar este endereço".
2. Um aviso explicando que **conexões, credenciais, teste, status e webhook agora ficam na página Conexões**, com um botão **"Abrir Conexões"** levando a `/conexoes`.

## O que sai da aba

- Teste de conexão e selo Conectado/Desconectado (fica no cartão de cada conexão, na página Conexões).
- Campo "URL do webhook" com botão Copiar (fica o botão "Copiar webhook" em cada conexão).
- Botão "Reconfigurar webhook" e a **correção automática ao abrir a página** (fica o botão "Reconfigurar webhook" de cada conexão — somente sob comando).
- Botão "Ativar mensagens do celular" (o "Reconfigurar webhook" da página Conexões já ativa essa opção na Z-API).
- Texto sobre as variáveis de ambiente `ZAPI_*` (credenciais agora são guardadas por conexão).

## O que não muda

- As demais abas de Configurações (Empresa, PIX e prazo, Impressão, Link do orçamento) continuam iguais.
- O campo "Endereço do sistema" continua salvando em `whatsapp_config.app_url`, sem mexer no banco.
- Nenhuma mudança no WhatsApp, no bot, nas rotinas, nas rotas de webhook ou na Z-API — é apenas reorganização visual.
- Nenhuma migração nova.

## Detalhes técnicos

- Arquivo: `src/routes/configuracoes.tsx` — o componente `CardWhatsapp` é reescrito em versão simplificada (endereço do sistema + aviso + botão para `/conexoes` via `Link` do TanStack Router).
- As server functions antigas (`statusInstanciaZapi`, `lerWebhooksZapi`, `reconfigurarWebhooksZapi`, `ativarMensagensEnviadasPorMim`) deixam de ser usadas por essa tela; serão removidas dela. Se ficarem sem nenhum uso, são removidas do código; se ainda forem usadas em outro ponto, permanecem.
- Verificação: typecheck, lint e build; conferência visual no preview da aba WhatsApp e da navegação para Conexões.
- Sem commit e sem push.

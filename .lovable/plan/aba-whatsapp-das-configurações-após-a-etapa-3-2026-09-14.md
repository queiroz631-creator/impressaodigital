# Aba WhatsApp das Configurações após a Etapa 3

## Problema

A aba **WhatsApp** dentro de Configurações foi feita para uma única conexão e ficou desalinhada com o novo modelo de múltiplas conexões:

- Testa a conexão usando apenas as credenciais do servidor (a tela mostra "Desconectado — Instance not found"), ignorando as conexões cadastradas.
- Mostra e tenta gravar o **endereço de webhook antigo** (com `?token=`), diferente do endereço novo por conexão (`/api/public/whatsapp/webhook/<token>`).
- **Corrige o webhook automaticamente ao abrir a página** — viola a regra da Etapa 3 de que o webhook só muda quando o administrador clica em "Reconfigurar webhook".
- Orienta a guardar credenciais em variáveis de ambiente, embora agora elas fiquem na página Conexões.

## Objetivo

A aba WhatsApp das Configurações deixa de gerenciar conexão e vira um cartão simples com:

1. **Endereço do sistema** (mantido como está — endereço público usado pelas rotinas do bot e como base dos webhooks), com Salvar e "Usar este endereço".
2. Um aviso explicando que **conexões, credenciais, teste, status e webhook agora ficam na página Conexões**, com um botão **"Abrir Conexões"** levando a `/conexoes`.

## O que sai da aba

- Teste de conexão e selo Conectado/Desconectado (fica no cartão de cada conexão, na página Conexões).
- Campo "URL do webhook" com botão Copiar (fica o botão "Copiar webhook" em cada conexão).
- Botão "Reconfigurar webhook" e a **correção automática ao abrir a página** (fica o botão "Reconfigurar webhook" de cada conexão — somente sob comando).
- Botão "Ativar mensagens do celular" (o "Reconfigurar webhook" da página Conexões já ativa essa opção na Z-API).
- Texto sobre as variáveis de ambiente `ZAPI_*` (credenciais agora são guardadas por conexão).

## Regras obrigatórias desta etapa

- **Reorganização exclusivamente visual** da aba Configurações → WhatsApp. Não alterar: `whatsapp_conexoes`, credenciais das conexões, webhooks das conexões, Z-API, bot, cron/pg_cron, fila de mensagens, rotinas de inatividade/status, tela do WhatsApp, banco de dados. Nenhuma migration nova.
- **Nenhuma alteração automática de webhook** durante carregamento, montagem ou atualização da página. Nenhuma chamada que altere dados na Z-API ao simplesmente abrir a página.
- **Antes de remover qualquer server function antiga** (`statusInstanciaZapi`, `lerWebhooksZapi`, `reconfigurarWebhooksZapi`, `ativarMensagensEnviadasPorMim`), buscar todas as referências no projeto. Se alguma for usada pela página Conexões ou por qualquer outro módulo, a função é **mantida** — apenas deixa de ser usada em `configuracoes.tsx`.
- As demais abas de Configurações (Empresa, PIX e prazo, Impressão, Link do orçamento) continuam iguais.
- O campo "Endereço do sistema" continua salvando em `whatsapp_config.app_url`, sem mexer no banco.
- Sem commit e sem push.

## Detalhes técnicos

- Arquivo principal: `src/routes/configuracoes.tsx` — o componente `CardWhatsapp` é reescrito em versão simplificada (endereço do sistema + aviso + botão para `/conexoes` via `Link` do TanStack Router); saem do componente as queries de status/webhooks, a mutação de reconfiguração e o efeito de correção automática.
- Busca de referências às server functions antigas em todo o `src/` antes de qualquer remoção; só remove o que ficar completamente sem uso.
- Verificação: typecheck, lint e build; conferência visual no preview da aba WhatsApp, da navegação para Conexões e do funcionamento normal de `/conexoes`.

## Relatório final (após executar)

1. Arquivos alterados.
2. Funções removidas ou mantidas e onde ainda são utilizadas.
3. Confirmação de que nenhuma migration foi criada.
4. Confirmação de que nenhum webhook foi alterado.
5. Resultado do typecheck, lint e build.
6. Confirmação de que `/conexoes` continua funcionando normalmente.

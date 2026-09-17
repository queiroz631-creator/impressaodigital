# Gerar novo token para a API do Lojamix Sync

## Objetivo
Substituir o `LOJAMIX_SYNC_TOKEN` atual por um novo valor aleatório e seguro.

## Passos

1. Remover o segredo `LOJAMIX_SYNC_TOKEN` atual.
2. Gerar um novo token aleatório seguro com o mesmo nome `LOJAMIX_SYNC_TOKEN`.
   - O novo valor fica salvo no cofre de segredos; ele não é exibido no chat.
3. Confirmar que as 8 rotas da API do Lojamix Sync continuam exigindo exclusivamente `LOJAMIX_SYNC_TOKEN` (nenhuma alteração de código é necessária — elas já leem o segredo do ambiente).

## O que você precisa fazer depois
- Como o novo valor não aparece no chat, copie o novo token em **Configurações → Segredos** do projeto.
- Atualize o `SISTEMA_TOKEN` no arquivo `.env` da máquina da loja com o mesmo valor.
- Reinicie o Lojamix Sync na loja. Até fazer isso, a sincronização retornará "Não autorizado" (401).

## Não será alterado
- Nenhum código do site, rotas, bot, sincronização de notas/clientes ou banco de dados.
- O `webhook_token` das rotinas internas (validação de notas, cron) — ele é separado e continua igual.
- Sem commit, push, deploy ou publicação.

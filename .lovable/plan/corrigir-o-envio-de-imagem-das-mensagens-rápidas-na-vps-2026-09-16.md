# Corrigir o envio de imagem das mensagens rápidas na VPS

## O que está acontecendo

O erro aparece somente quando a mensagem rápida tem imagem — salvar texto funciona.
Ou seja: o problema não está na tabela de mensagens rápidas, e sim nas **permissões do
armazenamento de arquivos** do banco da VPS.

O script `deploy/migrar-storage.sh` que você usou já cria a pasta `mensagens-rapidas`
na VPS (ela está na lista de buckets), então a pasta provavelmente existe. O que falta
são as **regras de permissão de arquivos** dessa pasta: são elas que autorizam um usuário
logado a enviar, ler, atualizar e apagar imagens. Sem elas, o banco recusa a gravação e
devolve exatamente a mensagem que você viu. É a mesma causa da falha ao enviar a mensagem
rápida com foto pelo WhatsApp: sem conseguir gravar/ler o arquivo, o envio não completa.

Essas regras foram criadas no projeto em uma migração de 08/09, anterior ao ponto de
partida registrado para a VPS — por isso podem nunca ter sido aplicadas lá. Não é possível
confirmar daqui (o banco da VPS não é acessível), então o primeiro passo do plano é uma
verificação que responde isso em segundos, direto na VPS.

## Passo 1 — Verificar (somente leitura)

Novo arquivo `deploy/verificar-storage.sh`, que você roda na VPS e mostra:

- se a pasta `mensagens-rapidas` existe no armazenamento, se é privada e o limite de tamanho;
- quais regras de permissão de arquivos existem hoje para essa pasta;
- a mesma verificação para as outras pastas do sistema (`bot-midia`, `orcamento-arquivos`,
  `sistema`, `whatsapp`), para pegar de uma vez qualquer outra que esteja sem permissão.

O script apenas lê. Não altera nada.

## Passo 2 — Corrigir

Novo arquivo `deploy/corrigir-storage.sql`, aplicado na VPS depois da verificação:

- recria, só quando faltarem, as regras de leitura, envio, atualização e exclusão dos
  arquivos de cada pasta usada pelo sistema, iguais às do projeto;
- cria a pasta de arquivos apenas se ela não existir, privada, como no sistema atual;
- é seguro rodar mais de uma vez: nada existente é apagado ou sobrescrito, nenhum arquivo
  é removido.

## Passo 3 — Conferir na prática

Na VPS: abrir Mensagens Rápidas, salvar uma mensagem com imagem e depois enviá-la com foto
pelo WhatsApp. Se ainda falhar, a verificação do passo 1 passa a mostrar o motivo exato.

## Detalhes técnicos

- Verificação: consultas em `storage.buckets` e em `pg_policies` filtradas por `bucket_id`,
  via `psql` no container do banco da VPS (mesma abordagem dos scripts já existentes em
  `deploy/`).
- Correção: `CREATE POLICY` protegido por checagem em `pg_policies`
  (`DO $$ ... IF NOT EXISTS`), espelhando as 4 políticas de `20260908223416_*.sql`, e
  `INSERT ... ON CONFLICT (id) DO NOTHING` em `storage.buckets`.
- Nada do site, das rotas, do bot, da sincronização de notas/clientes ou das migrações
  existentes é alterado. Nenhuma migração nova no banco da nuvem.
- Sem commit, envio ou publicação.

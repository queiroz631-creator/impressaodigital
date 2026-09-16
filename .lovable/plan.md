# Corrigir o envio de imagem das mensagens rápidas na VPS

## O que está acontecendo

O erro aparece somente quando a mensagem rápida tem imagem — salvar texto funciona.
Ou seja: o problema não está na tabela de mensagens rápidas, e sim no **armazenamento
de arquivos** do banco da VPS: a pasta de arquivos `mensagens-rapidas` e/ou as regras
de permissão dela não existem lá.

Confirmado no projeto: as regras de permissão dessa pasta foram criadas na migração de
08/09, mas a **pasta de arquivos em si** nunca fez parte das migrações (na nuvem ela foi
criada por ferramenta). Se o backup usado na VPS não trouxe as pastas de arquivos, a
gravação é recusada — e é isso que gera a mensagem que você viu. Também explica a falha
ao enviar a mensagem rápida com foto pelo WhatsApp: sem o arquivo, o envio não completa.

Ainda não é possível afirmar com certeza se falta a pasta, faltam as regras, ou os dois —
o banco da VPS não é acessível daqui. Por isso o primeiro passo do plano é uma verificação
que responde isso em segundos, direto na VPS.

## Passo 1 — Verificar (somente leitura)

Novo arquivo `deploy/verificar-storage-mensagens.sh`, que você roda na VPS e mostra:

- se a pasta `mensagens-rapidas` existe no armazenamento;
- se ela é pública ou privada e qual o limite de tamanho;
- quais regras de permissão de arquivos existem para essa pasta;
- a mesma verificação para as outras pastas usadas pelo sistema
  (`bot-midia`, `orcamento-arquivos`, `sistema`, `whatsapp`), para pegar de uma vez
  qualquer outra que esteja faltando.

O script apenas lê. Não altera nada.

## Passo 2 — Corrigir

Novo arquivo `deploy/corrigir-storage.sql`, aplicado na VPS depois da verificação:

- cria as pastas de arquivos que estiverem faltando, com o mesmo modo (privada/pública)
  e o mesmo limite de tamanho que valem hoje no sistema em produção;
- recria, só se faltarem, as regras de permissão de leitura, envio, atualização e
  exclusão dos arquivos de cada pasta, iguais às da migração de 08/09;
- é seguro rodar mais de uma vez: nada existente é apagado ou sobrescrito, nenhum
  arquivo é removido.

## Passo 3 — Conferir na prática

Na VPS: abrir Mensagens Rápidas, salvar uma mensagem com imagem e depois enviá-la
com foto pelo WhatsApp. Se ainda falhar, o script de verificação passa a mostrar o
motivo exato, sem adivinhação.

## Detalhes técnicos

- Verificação: consultas em `storage.buckets` e nas políticas de `storage.objects`
  filtradas por `bucket_id`, via `psql` no container do banco da VPS (mesma abordagem
  dos scripts existentes em `deploy/`).
- Correção: `INSERT ... ON CONFLICT (id) DO NOTHING` em `storage.buckets` e
  `CREATE POLICY` protegido por checagem em `pg_policies` (`DO $$ ... IF NOT EXISTS`),
  espelhando as 4 políticas de `20260908223416_*.sql`.
- Nada do site, das rotas, do bot, da sincronização de notas/clientes ou das
  migrações existentes é alterado. Nenhuma migração nova no banco da nuvem.
- Sem commit, envio ou publicação.

# Migrações automáticas do banco para a VPS via Git

## Situação atual

- Toda alteração feita no banco pelo Lovable já é gravada automaticamente como arquivo em `supabase/migrations/` (73 arquivos hoje) e sincroniza com o GitHub — essa parte já funciona.
- O que não existe: na VPS, ninguém aplica esses arquivos novos. Hoje é preciso rodar scripts manuais (como o `deploy/vps-bot-endereco.sql`), o que causou o erro do bot.

## O que será criado

1. **`deploy/aplicar-migracoes.sh`** — script que roda na VPS:
   - Cria (se não existir) uma tabela de controle no banco da VPS com o nome de cada migração já aplicada.
   - Percorre `supabase/migrations/*.sql` em ordem de data e aplica só os arquivos que ainda não foram aplicados, um a um, parando com aviso claro se algum falhar.
   - Registra cada migração aplicada na tabela de controle, então pode ser executado várias vezes sem reaplicar nada.

2. **`deploy/deploy.sh`** — passa a chamar `aplicar-migracoes.sh` logo após o `git pull` e antes do build. Assim, cada `bash deploy/deploy.sh` já atualiza o banco da VPS junto com o código.

3. **`deploy/README.md`** — documenta o fluxo: "alterou o banco no Lovable → sincronizou o Git → rodou deploy.sh na VPS → banco da VPS atualizado sozinho".

## Pontos de atenção

- Migrações que dependem de `pg_net`/`pg_cron` (rotinas do bot) exigem as extensões ativas na VPS — o script verifica e avisa se faltar.
- Migrações antigas (anteriores à VPS) já existem no banco restaurado; o script marca como aplicadas as que já estão no backup para não reaplicar — na primeira execução ele pergunta/registra a linha de corte.
- Nada muda no ambiente Lovable nem no código da aplicação.

## Detalhes técnicos

- Tabela de controle: `public._migracoes_aplicadas (nome text primary key, aplicado_em timestamptz default now())`.
- Script usa `docker exec -i supabase-db psql -U postgres -d postgres` para aplicar cada arquivo e `ON_ERROR_STOP=1` para abortar em erro.
- Idempotente: `INSERT ... ON CONFLICT DO NOTHING` no registro.

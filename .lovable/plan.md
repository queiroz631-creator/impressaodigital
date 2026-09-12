# Migrações automáticas do banco de produção na VPS

## Situação atual (verificada)

- Toda alteração de banco feita no Lovable já gera um arquivo em `supabase/migrations/` — hoje são **73 arquivos**, e eles já sincronizam com o GitHub.
- Falta apenas a VPS aplicar automaticamente as migrações novas. Hoje isso é manual (foi o que causou o problema do bot).

## Baseline (qual migração corresponde ao banco da VPS)

Determinado pelo histórico real do projeto, não arbitrariamente:

- O backup restaurado na VPS é o `impressaodigital_260909` (09/09/2026). A última migração anterior a ele é
  `20260909204005_e228651b-244a-4ad1-b2e2-26493e52a0d0.sql`.
- Depois dele existem só duas migrações, ambas de 12/09: `20260912044325...` e `20260912044341...` (campo
  "Endereço do sistema" e as rotinas do bot). Essas já foram aplicadas na VPS à mão, pelo
  `deploy/vps-bot-endereco.sql`.

Portanto o baseline será gravado em **`deploy/migrations-baseline.txt`** com o nome:

```text
20260912044341_909d866e-0aa4-4020-9090-112fd05a21c6.sql
```

Tudo até esse arquivo (inclusive) é marcado como já aplicado, **sem executar nada**. Só o que vier depois roda.
O arquivo é comentado e fácil de alterar. Se ele estiver ausente ou com um nome que não existe em
`supabase/migrations/`, o script **aborta** com mensagem clara pedindo definição manual do baseline.

## O que será criado

**`deploy/aplicar-migracoes.sh`**

- Confere que o container `supabase-db` existe e está rodando, e testa a conexão antes de qualquer coisa.
- Cria (se faltar) a tabela de controle `public._migracoes_aplicadas` (`nome` chave primária, `aplicado_em`).
- Se a tabela estiver vazia, faz o baseline: registra todas as migrações até o nome do
  `migrations-baseline.txt` sem executá-las.
- Lista `supabase/migrations/*.sql` em ordem alfabética (= cronológica) e, para cada uma:
  `[SKIP]` se já registrada, `[APPLY]` + `[OK]` quando aplicada com sucesso.
- Cada migração roda isolada com `ON_ERROR_STOP=1` e em transação única, exceto quando o arquivo declarar
  que não pode rodar em transação (`CREATE INDEX CONCURRENTLY`, marcador `-- no-transaction`).
- Registra na tabela de controle **somente depois** do sucesso.
- Em erro: mostra o nome da migração e a mensagem do PostgreSQL, não registra nada e sai com código ≠ 0.
- Antes de aplicar, lê `pg_extension` e avisa/interrompe se uma migração pendente usar `pg_net` ou `pg_cron`
  e a extensão não estiver instalada. Não instala nem remove extensões.
- Modo diagnóstico `--pendentes`: só lista o que falta aplicar, sem tocar no banco.
- Nenhuma senha, chave ou token no script — usa apenas o acesso já existente
  `docker exec -i supabase-db psql -U postgres -d postgres`.

## O que será modificado

**`deploy/deploy.sh`** — ordem: `git pull` → `aplicar-migracoes.sh` → `npm ci`/`npm install` → `npm run build`
→ `pm2 reload` → `pm2 save`. Se as migrações falharem, o deploy para ali: sem build e sem reiniciar a
aplicação, para nunca subir código novo sobre banco incompatível. O carregamento do `.env` e a checagem
atual continuam iguais; nada de `git reset`, `git clean`, `git checkout .` ou `git restore` — alterações
locais da VPS são preservadas.

**`deploy/README.md`** — o fluxo completo (alterou no Lovable → migração criada → GitHub → `bash deploy/deploy.sh`
na VPS → banco atualizado antes do build), como o baseline funciona e onde mudá-lo, como listar migrações
aplicadas e pendentes, e o que fazer quando uma falha acontecer.

## Fora de escopo

Nada muda no Lovable, no bot, na Z-API, no Gemini, no Storage, na autenticação, no layout ou nos dados.
Nenhuma migração de produção é executada a partir do ambiente Lovable.

## Validação

Sintaxe (`bash -n`) e shellcheck se disponível; conferência de que o `deploy.sh` chama o script na ordem
certa, que migração já registrada é ignorada, que erro interrompe, que o baseline não executa migrações
antigas, e que nenhuma credencial entrou no repositório. No fim, relatório com arquivos criados/alterados,
baseline escolhido e resultados.

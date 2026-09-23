#!/usr/bin/env bash
# =============================================================================
# Verifica o armazenamento de arquivos (Storage) no banco da VPS.
#
#   bash deploy/verificar-storage.sh
#
# Somente leitura: mostra, para cada pasta de arquivos usada pelo sistema,
# se ela existe e quais regras de permissão de arquivos estão criadas.
# Não altera nada. Sem senhas: usa o acesso local do container do Postgres.
# =============================================================================
set -uo pipefail

CONTAINER="${SUPABASE_DB_CONTAINER:-supabase-db}"
DB_USER="${SUPABASE_DB_USER:-postgres}"
DB_NAME="${SUPABASE_DB_NAME:-postgres}"

linha() { printf '========================================\n'; }
titulo() { linha; printf ' %s\n' "$1"; linha; }
erro() { printf '\n[ERRO] %s\n' "$1" >&2; }

psql_exec() {
  docker exec -i "$CONTAINER" \
    psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" "$@"
}

titulo "VERIFICAÇÃO DO STORAGE (somente leitura)"

if ! command -v docker >/dev/null 2>&1; then
  erro "Docker não encontrado nesta máquina. Rode este script na VPS."
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  erro "O container do banco \"$CONTAINER\" não está rodando."
  echo "Verifique com: docker ps"
  echo "Se o nome for diferente, use: SUPABASE_DB_CONTAINER=<nome> bash deploy/verificar-storage.sh"
  exit 1
fi

if ! psql_exec -tAc 'select 1' >/dev/null 2>&1; then
  erro "Não foi possível conectar ao PostgreSQL dentro do container \"$CONTAINER\"."
  exit 1
fi
echo "Banco conectado: OK"
echo

# --- 1. pastas de arquivos (buckets) ---------------------------------------
titulo "PASTAS DE ARQUIVOS (buckets)"

psql_exec <<'SQL'
SELECT b.id AS pasta,
       CASE WHEN b.public THEN 'publica' ELSE 'privada' END AS visibilidade,
       COALESCE(round(b.file_size_limit / 1048576.0, 1)::text || ' MB', 'padrao do projeto') AS limite_arquivo,
       (SELECT count(*) FROM storage.objects o WHERE o.bucket_id = b.id) AS arquivos
  FROM storage.buckets b
 WHERE b.id IN ('bot-midia', 'mensagens-rapidas', 'orcamento-arquivos', 'sistema', 'whatsapp', 'database_export_11_09_26', 'portal-sorteios')
 ORDER BY b.id;
SQL

echo
AUSENTES="$(psql_exec -tA <<'SQL'
WITH esperados(nome) AS (
  VALUES ('bot-midia'), ('mensagens-rapidas'), ('orcamento-arquivos'),
         ('sistema'), ('whatsapp'), ('database_export_11_09_26'), ('portal-sorteios')
)
SELECT e.nome
  FROM esperados e
 WHERE NOT EXISTS (SELECT 1 FROM storage.buckets b WHERE b.id = e.nome)
 ORDER BY e.nome;
SQL
)"

if [ -n "$AUSENTES" ]; then
  echo "[ATENÇÃO] Pastas ausentes no banco:"
  printf '  - %s\n' $AUSENTES
else
  echo "Todas as pastas usadas pelo sistema existem."
fi
echo

# --- 2. regras de permissão de arquivos ------------------------------------
titulo "REGRAS DE PERMISSÃO DE ARQUIVOS (storage.objects)"

psql_exec <<'SQL'
SELECT p.policyname AS regra,
       p.cmd AS operacao,
       CASE p.qual  IS NULL WHEN true THEN false ELSE true END AS tem_filtro
  FROM pg_policies p
 WHERE p.schemaname = 'storage'
   AND p.tablename = 'objects'
 ORDER BY p.policyname;
SQL

echo
FALTAM="$(psql_exec -tA <<'SQL'
WITH esperadas(policyname) AS (
  VALUES
    ('Usuarios autenticados leem imagens de mensagens rapidas'),
    ('Usuarios autenticados enviam imagens de mensagens rapidas'),
    ('Usuarios autenticados atualizam imagens de mensagens rapidas'),
    ('Usuarios autenticados excluem imagens de mensagens rapidas'),
    ('orcamento_arquivos_auth_read'),
    ('orcamento_arquivos_auth_insert'),
    ('orcamento_arquivos_auth_update'),
    ('orcamento_arquivos_auth_delete'),
    ('whatsapp_bucket_select'),
    ('whatsapp_bucket_insert'),
    ('whatsapp_bucket_update'),
    ('whatsapp_bucket_delete'),
    ('Autenticados leem midia do bot'),
    ('Autenticados enviam midia do bot'),
    ('Autenticados atualizam midia do bot'),
    ('Autenticados excluem midia do bot')
)
SELECT e.policyname
  FROM esperadas e
 WHERE NOT EXISTS (
   SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'storage'
      AND p.tablename = 'objects'
      AND p.policyname = e.policyname
 )
 ORDER BY e.policyname;
SQL
)"

if [ -n "$FALTAM" ]; then
  echo "[ATENÇÃO] Regras de permissão ausentes:"
  printf '  - %s\n' $FALTAM
  echo
  echo "Para corrigir, aplique deploy/corrigir-storage.sql:"
  echo "  docker exec -i $CONTAINER psql -U $DB_USER -d $DB_NAME -v ON_ERROR_STOP=1 -f - < deploy/corrigir-storage.sql"
else
  echo "Todas as regras de permissão usadas pelo sistema existem."
fi
echo

linha
printf ' FIM DA VERIFICAÇÃO — nada foi alterado.\n'
linha

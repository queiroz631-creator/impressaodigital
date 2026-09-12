#!/usr/bin/env bash
# =============================================================================
# Aplica no banco da VPS as migrações novas que vieram do Git.
#
#   bash deploy/aplicar-migracoes.sh              # aplica as pendentes
#   bash deploy/aplicar-migracoes.sh --pendentes  # só lista, não altera nada
#
# Não contém senhas nem chaves: usa o acesso local do container do Postgres.
# =============================================================================
set -uo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
DIR_MIGRACOES="$RAIZ/supabase/migrations"
ARQ_BASELINE="$RAIZ/deploy/migrations-baseline.txt"
CONTAINER="${SUPABASE_DB_CONTAINER:-supabase-db}"
DB_USER="${SUPABASE_DB_USER:-postgres}"
DB_NAME="${SUPABASE_DB_NAME:-postgres}"
TABELA="public._migracoes_aplicadas"

SOMENTE_PENDENTES=0
if [ "${1:-}" = "--pendentes" ]; then SOMENTE_PENDENTES=1; fi

linha() { printf '========================================\n'; }
titulo() { linha; printf ' %s\n' "$1"; linha; }
erro() { printf '\n[ERRO] %s\n' "$1" >&2; }

psql_exec() {
  # SQL vem pelo stdin; ON_ERROR_STOP garante código de saída != 0 em erro.
  docker exec -i "$CONTAINER" \
    psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" "$@"
}

psql_valor() {
  docker exec -i "$CONTAINER" \
    psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" -tAc "$1"
}

titulo "MIGRAÇÕES DO BANCO"

# --- 1. container -----------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  erro "Docker não encontrado nesta máquina. Rode este script na VPS."
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  erro "O container do banco \"$CONTAINER\" não está rodando."
  echo "Verifique com: docker ps"
  echo "Se o nome for diferente, use: SUPABASE_DB_CONTAINER=<nome> bash deploy/aplicar-migracoes.sh"
  exit 1
fi

# --- 2. conexão -------------------------------------------------------------
if ! psql_valor 'select 1' >/dev/null 2>&1; then
  erro "Não foi possível conectar ao PostgreSQL dentro do container \"$CONTAINER\"."
  exit 1
fi
echo "Banco conectado: OK"

# --- 3. tabela de controle --------------------------------------------------
if ! psql_exec >/dev/null 2>&1 <<SQL
CREATE TABLE IF NOT EXISTS $TABELA (
  nome text PRIMARY KEY,
  aplicado_em timestamptz NOT NULL DEFAULT now()
);
SQL
then
  erro "Não foi possível criar/verificar a tabela de controle $TABELA."
  exit 1
fi
echo "Tabela de controle: OK"

# --- 4. lista de migrações --------------------------------------------------
if [ ! -d "$DIR_MIGRACOES" ]; then
  erro "Pasta de migrações não encontrada: $DIR_MIGRACOES"
  exit 1
fi

MIGRACOES=()
while IFS= read -r arquivo; do
  MIGRACOES+=("$(basename "$arquivo")")
done < <(find "$DIR_MIGRACOES" -maxdepth 1 -name '*.sql' -type f | LC_ALL=C sort)

if [ "${#MIGRACOES[@]}" -eq 0 ]; then
  echo "Nenhuma migração encontrada. Nada a fazer."
  exit 0
fi
echo "Migrations encontradas: ${#MIGRACOES[@]}"

# --- 5. baseline (só na primeira execução) ---------------------------------
JA_APLICADAS="$(psql_valor "SELECT count(*) FROM $TABELA")"
if [ "$JA_APLICADAS" = "0" ]; then
  echo
  echo "Tabela de controle vazia — definindo o baseline (nenhum SQL será executado)."

  if [ ! -f "$ARQ_BASELINE" ]; then
    erro "Baseline não definido: arquivo ausente em deploy/migrations-baseline.txt"
    echo "Crie o arquivo com o nome da última migração já refletida no banco da VPS."
    exit 1
  fi

  BASELINE="$(grep -v '^[[:space:]]*#' "$ARQ_BASELINE" | tr -d '\r' \
              | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | grep -v '^$' | tail -n1)"

  if [ -z "$BASELINE" ]; then
    erro "Baseline não definido: deploy/migrations-baseline.txt está vazio."
    echo "Informe o nome da última migração já refletida no banco da VPS."
    exit 1
  fi

  ENCONTRADO=0
  for nome in "${MIGRACOES[@]}"; do
    if [ "$nome" = "$BASELINE" ]; then ENCONTRADO=1; break; fi
  done
  if [ "$ENCONTRADO" -eq 0 ]; then
    erro "Baseline \"$BASELINE\" não existe em supabase/migrations/."
    echo "Corrija deploy/migrations-baseline.txt com um nome de arquivo válido."
    exit 1
  fi

  BASE_SQL=""
  for nome in "${MIGRACOES[@]}"; do
    BASE_SQL="${BASE_SQL}INSERT INTO $TABELA (nome) VALUES ('${nome//\'/\'\'}') ON CONFLICT DO NOTHING;"$'\n'
    if [ "$nome" = "$BASELINE" ]; then break; fi
  done

  if ! psql_exec >/dev/null <<SQL
BEGIN;
$BASE_SQL
COMMIT;
SQL
  then
    erro "Falha ao registrar o baseline."
    exit 1
  fi
  echo "[BASELINE] registrado até: $BASELINE (sem executar nada)"
fi

# --- 6. quais estão pendentes ----------------------------------------------
REGISTRADAS="$(psql_valor "SELECT nome FROM $TABELA")"
esta_registrada() {
  printf '%s\n' "$REGISTRADAS" | grep -qxF "$1"
}

PENDENTES=()
for nome in "${MIGRACOES[@]}"; do
  if esta_registrada "$nome"; then
    [ "$SOMENTE_PENDENTES" -eq 0 ] && echo "[SKIP]  $nome"
  else
    PENDENTES+=("$nome")
  fi
done

if [ "$SOMENTE_PENDENTES" -eq 1 ]; then
  echo
  if [ "${#PENDENTES[@]}" -eq 0 ]; then
    echo "Nenhuma migração pendente."
  else
    echo "Migrações pendentes (${#PENDENTES[@]}):"
    for nome in "${PENDENTES[@]}"; do echo "  - $nome"; done
  fi
  exit 0
fi

if [ "${#PENDENTES[@]}" -eq 0 ]; then
  echo
  titulo "BANCO JÁ ATUALIZADO"
  exit 0
fi

# --- 7. extensões exigidas pelas pendentes ---------------------------------
EXTENSOES="$(psql_valor 'SELECT extname FROM pg_extension')"
tem_extensao() { printf '%s\n' "$EXTENSOES" | grep -qxF "$1"; }

for ext in pg_net pg_cron; do
  PRECISA=0
  for nome in "${PENDENTES[@]}"; do
    if grep -qiE "(^|[^a-z_])${ext}\." "$DIR_MIGRACOES/$nome" \
       || grep -qiE "extension[^;]*${ext}" "$DIR_MIGRACOES/$nome"; then
      PRECISA=1
      break
    fi
  done
  if [ "$PRECISA" -eq 1 ] && ! tem_extensao "$ext"; then
    erro "Uma migração pendente usa a extensão \"$ext\", que não está instalada neste banco."
    echo "Instale com um usuário superusuário antes de continuar:"
    echo "  CREATE EXTENSION IF NOT EXISTS $ext;"
    exit 1
  fi
done

# --- 8. aplicar -------------------------------------------------------------
for nome in "${PENDENTES[@]}"; do
  echo "[APPLY] $nome"
  ARQUIVO="$DIR_MIGRACOES/$nome"

  # Algumas migrações não podem rodar dentro de transação.
  SEM_TRANSACAO=0
  if grep -qiE 'create[[:space:]]+index[[:space:]]+concurrently|--[[:space:]]*no-transaction' "$ARQUIVO"; then
    SEM_TRANSACAO=1
  fi

  if [ "$SEM_TRANSACAO" -eq 1 ]; then
    SAIDA="$(psql_exec -f - < "$ARQUIVO" 2>&1)"
    CODIGO=$?
  else
    SAIDA="$(psql_exec --single-transaction -f - < "$ARQUIVO" 2>&1)"
    CODIGO=$?
  fi

  if [ "$CODIGO" -ne 0 ]; then
    erro "Migration: $nome"
    echo "$SAIDA" >&2
    echo >&2
    echo "A migração NÃO foi registrada como aplicada. O deploy foi interrompido." >&2
    exit 1
  fi

  if ! psql_exec >/dev/null <<SQL
INSERT INTO $TABELA (nome) VALUES ('${nome//\'/\'\'}') ON CONFLICT DO NOTHING;
SQL
  then
    erro "A migração $nome foi aplicada, mas não pôde ser registrada em $TABELA."
    exit 1
  fi
  echo "[OK]    $nome aplicada"
done

echo
titulo "MIGRAÇÕES CONCLUÍDAS"

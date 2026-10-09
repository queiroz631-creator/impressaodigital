#!/usr/bin/env bash
# Validação local, sem conexão ou escrita no banco.
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${1:-$RAIZ/supabase/migrations}"

if [ ! -d "$DIR" ]; then
  echo "[ERRO] Pasta de migrações não encontrada: $DIR" >&2
  exit 1
fi

declare -A DATAS=()
INVALIDAS=0
TOTAL=0
while IFS= read -r -d '' arquivo; do
  nome="$(basename "$arquivo")"
  TOTAL=$((TOTAL + 1))
  if [[ ! "$nome" =~ ^[0-9]{14}_[A-Za-z0-9][A-Za-z0-9_-]*\.sql$ ]]; then
    echo "[ERRO] Migração fora do padrão datado: $nome" >&2
    echo "Use AAAAMMDDHHMMSS_descricao.sql, depois das migrações das quais ela depende." >&2
    INVALIDAS=1
    continue
  fi
  data="${nome:0:14}"
  if [[ -n "${DATAS[$data]:-}" ]]; then
    echo "[ERRO] Migrações com a mesma data: ${DATAS[$data]} e $nome" >&2
    INVALIDAS=1
  fi
  DATAS[$data]="$nome"
done < <(find "$DIR" -maxdepth 1 -type f -name '*.sql' -print0)

if [ "$INVALIDAS" -ne 0 ]; then
  echo "Nenhuma alteração no banco foi executada. Corrija os nomes e a ordem antes de continuar." >&2
  exit 1
fi
echo "Nomes das migrações validados: $TOTAL arquivo(s)."
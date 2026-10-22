#!/usr/bin/env bash
# =============================================================================
# Limpeza periódica do Storage (VPS).
#
#   bash deploy/limpeza-storage.sh             # simulação: só mostra o que faria
#   bash deploy/limpeza-storage.sh --executar  # remove de verdade
#
# O que faz (somente com segurança):
#   1. Processa a fila de limpezas PENDENTES do FOTO EXPRESS: remove o arquivo
#      apenas se nenhuma foto ativa ainda usa o mesmo original.
#   2. Relata (nunca apaga) arquivos órfãos dos buckets do FOTO EXPRESS com mais
#      de DIAS_ORFAO dias e sem registro no banco, para revisão manual.
#
# Agendamento (todo domingo às 3h, horário da VPS):
#   crontab -e
#   0 3 * * 0 cd /root/impressaodigital && bash deploy/limpeza-storage.sh --executar >> /var/log/limpeza-storage.log 2>&1
# =============================================================================
set -Eeuo pipefail

EXECUTAR=0
[ "${1:-}" = "--executar" ] && EXECUTAR=1

CONTAINER="${SUPABASE_DB_CONTAINER:-supabase-db}"
DB_USER="${SUPABASE_DB_USER:-postgres}"
DB_NAME="${SUPABASE_DB_NAME:-postgres}"
LIMITE="${LIMITE_LIMPEZAS:-500}"
DIAS_ORFAO="${DIAS_ORFAO:-7}"
SB_ENV="${SB_ENV:-/root/supabase-project/.env}"

[ -f .env ] && set -a && . ./.env && set +a
URL="${SUPABASE_URL:-}"
KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
if [ -z "$KEY" ] && [ -f "$SB_ENV" ]; then
  KEY="$(grep '^SERVICE_ROLE_KEY=' "$SB_ENV" | cut -d= -f2- | head -n1)"
fi
if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "ERRO: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env." >&2
  exit 1
fi

psql_q() { docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" -tA -F $'\t' "$@"; }

echo "========================================"
echo " Limpeza do Storage — $(date)"
[ $EXECUTAR -eq 1 ] && echo " MODO: EXECUÇÃO" || echo " MODO: SIMULAÇÃO (use --executar para remover)"
echo "========================================"

remover() { # bucket caminho
  local cod
  cod="$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE \
    -H "Authorization: Bearer $KEY" -H "apikey: $KEY" -H "Content-Type: application/json" \
    "$URL/storage/v1/object/$1" -d "{\"prefixes\":[$(printf '%s' "$2" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')]}")"
  [ "$cod" = "200" ]
}

# --- 1. fila do FOTO EXPRESS -------------------------------------------------
echo "[1/2] Fila de limpezas pendentes do FOTO EXPRESS"
ok=0; falha=0; mantida=0; total=0
while IFS=$'\t' read -r id ob op tb tp emuso; do
  [ -n "$id" ] || continue
  total=$((total+1))
  if [ "$emuso" = "t" ]; then mantida=$((mantida+1)); echo "  mantida (em uso): $op"; continue; fi
  if [ $EXECUTAR -eq 0 ]; then echo "  removeria: $ob/$op"; continue; fi
  erro=""
  remover "$ob" "$op" || erro="falha original"
  if [ "$ob/$op" != "$tb/$tp" ]; then remover "$tb" "$tp" || erro="${erro:+$erro; }falha miniatura"; fi
  if [ -z "$erro" ]; then
    psql_q -c "UPDATE public.foto_express_limpezas_storage SET status='CONCLUIDA', tentativas=tentativas+1, ultimo_erro=NULL WHERE id='$id';" >/dev/null
    ok=$((ok+1))
  else
    psql_q -c "UPDATE public.foto_express_limpezas_storage SET tentativas=tentativas+1, ultimo_erro='$erro (rotina VPS)' WHERE id='$id';" >/dev/null
    falha=$((falha+1)); echo "  ERRO: $op ($erro)"
  fi
done < <(psql_q <<SQL
SELECT l.id, l.original_bucket, l.original_path, l.thumbnail_bucket, l.thumbnail_path,
       EXISTS (SELECT 1 FROM public.foto_express_arquivos a
                WHERE a.original_bucket = l.original_bucket AND a.original_path = l.original_path)
  FROM public.foto_express_limpezas_storage l
 WHERE l.status = 'PENDENTE'
 ORDER BY l.criado_em
 LIMIT $LIMITE;
SQL
)
echo "  Pendentes: $total | removidas: $ok | em uso: $mantida | falhas: $falha"

# --- 2. relatório de órfãos (nada é apagado) ---------------------------------
echo
echo "[2/2] Possíveis órfãos do FOTO EXPRESS com mais de $DIAS_ORFAO dias (somente relatório)"
psql_q <<SQL
SELECT o.bucket_id, count(*) AS arquivos,
       pg_size_pretty(coalesce(sum((o.metadata->>'size')::bigint),0)) AS tamanho
  FROM storage.objects o
 WHERE o.bucket_id IN ('foto-express-originais','foto-express-thumbnails')
   AND o.created_at < now() - interval '$DIAS_ORFAO days'
   AND NOT EXISTS (SELECT 1 FROM public.foto_express_arquivos a
                    WHERE (a.original_bucket=o.bucket_id AND a.original_path=o.name)
                       OR (a.thumbnail_bucket=o.bucket_id AND a.thumbnail_path=o.name))
   AND o.name NOT LIKE 'geracoes/%'
 GROUP BY o.bucket_id;
SQL

echo
echo "Concluído: $(date)"

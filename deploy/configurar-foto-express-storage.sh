#!/usr/bin/env bash
# Garante os buckets privados do FOTO EXPRESS na VPS sem apagar objetos existentes.
set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:-https://supabase.queiroztecno.com.br}"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-${DEST_SERVICE_ROLE_KEY:-}}"

if [ -z "$SERVICE_ROLE_KEY" ]; then
  SB_ENV="/root/supabase-project/.env"
  if [ -f "$SB_ENV" ]; then
    SERVICE_ROLE_KEY="$(grep '^SERVICE_ROLE_KEY=' "$SB_ENV" | cut -d= -f2- | head -n1)"
  fi
fi
if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "ERRO: informe SUPABASE_SERVICE_ROLE_KEY ou DEST_SERVICE_ROLE_KEY."
  exit 1
fi

configurar_bucket() {
  local nome="$1" limite="$2" tipos="$3"
  local corpo
  corpo="{\"id\":\"$nome\",\"name\":\"$nome\",\"public\":false,\"file_size_limit\":$limite,\"allowed_mime_types\":$tipos}"
  local status
  status="$(curl -sS -o /tmp/foto-express-storage-resposta.json -w '%{http_code}' \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "apikey: $SERVICE_ROLE_KEY" \
    "$SUPABASE_URL/storage/v1/bucket/$nome")"
  if [ "$status" = "200" ]; then
    status="$(curl -sS -o /tmp/foto-express-storage-resposta.json -w '%{http_code}' -X PUT \
      -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "apikey: $SERVICE_ROLE_KEY" \
      -H 'Content-Type: application/json' --data "$corpo" \
      "$SUPABASE_URL/storage/v1/bucket/$nome")"
  else
    status="$(curl -sS -o /tmp/foto-express-storage-resposta.json -w '%{http_code}' -X POST \
      -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "apikey: $SERVICE_ROLE_KEY" \
      -H 'Content-Type: application/json' --data "$corpo" \
      "$SUPABASE_URL/storage/v1/bucket")"
  fi
  case "$status" in 200|201) echo "OK: $nome" ;; *) cat /tmp/foto-express-storage-resposta.json; exit 1 ;; esac
}

TIPOS_IMAGEM='["image/jpeg","image/png","image/webp"]'
configurar_bucket foto-express-originais 20971520 "$TIPOS_IMAGEM"
configurar_bucket foto-express-thumbnails 2097152 "$TIPOS_IMAGEM"
configurar_bucket foto-express-impressoes 104857600 null
rm -f /tmp/foto-express-storage-resposta.json
echo "Storage do FOTO EXPRESS configurado sem remover arquivos."

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

RESPOSTA="$(mktemp /tmp/foto-express-storage.XXXXXX)"
trap 'rm -f "$RESPOSTA"' EXIT

requisitar() {
  local metodo="$1" caminho="$2" corpo="${3:-}"
  local argumentos=()
  if [ -n "$corpo" ]; then
    argumentos=(-H 'Content-Type: application/json' --data "$corpo")
  fi
  if ! STATUS="$(curl -sS --connect-timeout 15 --max-time 60 \
    -o "$RESPOSTA" -w '%{http_code}' -X "$metodo" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "apikey: $SERVICE_ROLE_KEY" \
    "${argumentos[@]}" "${SUPABASE_URL%/}/storage/v1/$caminho")"; then
    echo "ERRO: falha de conexão ao consultar/configurar o Storage. Nenhum arquivo foi removido." >&2
    exit 1
  fi
}

falhar() {
  local nome="$1" limite="$2"
  echo "ERRO: não foi possível configurar $nome (HTTP $STATUS)." >&2
  case "$STATUS" in
    413)
      echo "O Storage rejeitou o limite solicitado de $((limite / 1048576)) MiB por arquivo." >&2
      echo "Confira o limite global FILE_SIZE_LIMIT no serviço Storage da VPS e configure-o para pelo menos $limite bytes." >&2
      echo "Depois recrie somente o container do serviço Storage para aplicar a configuração, sem remover volumes, e rode o deploy novamente." >&2
      ;;
    401|403) echo "Confira a chave de serviço e as permissões de acesso ao Storage na VPS." >&2 ;;
    *) echo "Confira a disponibilidade e os logs do serviço Storage na VPS." >&2 ;;
  esac
  echo "Nenhum bucket ou arquivo foi removido; o limite solicitado não foi reduzido automaticamente." >&2
  exit 1
}

configurar_bucket() {
  local nome="$1" limite="$2" tipos="$3"
  local corpo
  corpo="{\"id\":\"$nome\",\"name\":\"$nome\",\"public\":false,\"file_size_limit\":$limite,\"allowed_mime_types\":$tipos}"
  requisitar GET "bucket/$nome"
  if [ "$STATUS" = "200" ]; then
    requisitar PUT "bucket/$nome" "$corpo"
  elif [ "$STATUS" = "404" ] || { [ "$STATUS" = "400" ] && \
    grep -qiE '"code"[[:space:]]*:[[:space:]]*"(NoSuchBucket|BucketNotFound)"|"message"[[:space:]]*:[[:space:]]*"Bucket not found"' "$RESPOSTA"; }; then
    # Algumas versões retornam 400 + Bucket not found em vez de HTTP 404.
    requisitar POST bucket "$corpo"
    if [ "$STATUS" = "409" ]; then
      # Outro deploy pode ter criado o bucket entre a consulta e a criação.
      requisitar PUT "bucket/$nome" "$corpo"
    fi
  else
    # Nunca interpretar falhas de acesso/servidor como bucket inexistente.
    falhar "$nome" "$limite"
  fi
  case "$STATUS" in 200|201) echo "OK: $nome" ;; *) falhar "$nome" "$limite" ;; esac
}

TIPOS_IMAGEM='["image/jpeg","image/png","image/webp"]'
configurar_bucket foto-express-originais 20971520 "$TIPOS_IMAGEM"
configurar_bucket foto-express-thumbnails 2097152 "$TIPOS_IMAGEM"
configurar_bucket foto-express-impressoes 104857600 null
echo "Storage do FOTO EXPRESS configurado sem remover arquivos."

#!/usr/bin/env bash
# =============================================================================
# IMPRESSÃO DIGITAL - INSTALAÇÃO + MIGRAÇÃO COMPLETA EM VPS NOVA - FINAL
#
# USO:
#   bash install-migrate-one-command.sh /root/impressaodigital_260909.backup
#
# OU, diretamente do GitHub:
#   curl -fsSL https://raw.githubusercontent.com/queiroz631-creator/impressaodigital/main/deploy/install-migrate-one-command.sh \
#     -o /root/install-migrate-one-command.sh
#   chmod +x /root/install-migrate-one-command.sh
#   bash /root/install-migrate-one-command.sh /root/impressaodigital_260909.backup
#
# O BACKUP DO LOVABLE NÃO DEVE FICAR NO GITHUB.
# =============================================================================

set -Eeuo pipefail

APP_NAME="impressaodigital"
APP_DIR="/var/www/impressaodigital"
REPO_URL="https://github.com/queiroz631-creator/impressaodigital.git"
DOMAIN="queiroztecno.com.br"
SUPABASE_DOMAIN="supabase.queiroztecno.com.br"

# A instalação oficial atual cria o projeto dentro desta árvore.
SUPABASE_ROOT="/root/supabase-project"
SUPABASE_DIR="/root/supabase-project"
SUPABASE_SETUP_URL="https://supabase.link/setup.sh"

BACKUP="${1:-}"
CRED_FILE="/root/impressaodigital-credentials.txt"
PRE_RESTORE_BACKUP="/root/pre-restore-impressaodigital-$(date +%Y%m%d-%H%M%S).backup"

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m[OK]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[AVISO]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[ERRO]\033[0m %s\n' "$*" >&2; exit 1; }

trap 'die "Falha na linha $LINENO. Consulte a mensagem acima."' ERR

[ "$(id -u)" -eq 0 ] || die "Execute como root."
command -v apt-get >/dev/null 2>&1 || die "Este instalador exige Ubuntu/Debian."

[ -n "$BACKUP" ] || die "Informe o backup PostgreSQL como primeiro argumento."
[ -f "$BACKUP" ] || die "Backup não encontrado: $BACKUP"

. /etc/os-release
case "${ID:-}" in
  ubuntu|debian) ;;
  *) die "Sistema não suportado: ${PRETTY_NAME:-desconhecido}" ;;
esac

echo
echo "============================================================"
echo "     IMPRESSÃO DIGITAL - INSTALAÇÃO + MIGRAÇÃO"
echo "============================================================"
echo " Site:       https://$DOMAIN"
echo " Supabase:   https://$SUPABASE_DOMAIN"
echo " GitHub:     $REPO_URL"
echo " Backup:     $BACKUP"
echo "============================================================"
echo
warn "Este instalador restaura o banco e RECRIA o schema public."
warn "Não execute em uma instalação que contenha dados que você queira preservar."

# ---------------------------------------------------------------------------
# 1. Validações
# ---------------------------------------------------------------------------
log "1/15 - Validando VPS, backup, DNS e recursos"

RAM_MB="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
DISK_GB="$(df -Pk / | awk 'NR==2 {printf "%.0f", $4/1024/1024}')"
VPS_IP="$(curl -4 -fsS --max-time 10 https://api.ipify.org || true)"
SITE_IP="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}' || true)"
SB_IP="$(getent ahostsv4 "$SUPABASE_DOMAIN" | awk 'NR==1{print $1}' || true)"

echo "RAM: ${RAM_MB} MB"
echo "Espaço livre: ${DISK_GB} GB"
echo "IP da VPS: ${VPS_IP:-não detectado}"
echo "DNS site: ${SITE_IP:-não resolvido}"
echo "DNS Supabase: ${SB_IP:-não resolvido}"

if [ "$RAM_MB" -lt 3800 ]; then
  warn "RAM abaixo de ~4 GB. Supabase recomenda pelo menos 4 GB; 8 GB+ é preferível."
fi
if [ "$DISK_GB" -lt 35 ]; then
  warn "Pouco espaço livre. O stack completo recomenda aproximadamente 40 GB ou mais."
fi

DNS_OK=0
if [ -n "$VPS_IP" ] && [ "$SITE_IP" = "$VPS_IP" ] && [ "$SB_IP" = "$VPS_IP" ]; then
  DNS_OK=1
  ok "DNS do site e Supabase apontam para a VPS."
else
  warn "DNS ainda não coincide com a VPS. O instalador continuará, mas HTTPS poderá ser pulado."
fi

# ---------------------------------------------------------------------------
# 2. Pacotes base
# ---------------------------------------------------------------------------
log "2/15 - Instalando pacotes base"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y \
  ca-certificates curl gnupg git jq openssl unzip \
  build-essential ufw nginx certbot python3-certbot-nginx \
  rsync

# ---------------------------------------------------------------------------
# 3. Node 20
# ---------------------------------------------------------------------------
log "3/15 - Instalando Node.js 20"

if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(".")[0]')" != "20" ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

node --version
npm --version

# ---------------------------------------------------------------------------
# 4. Docker
# ---------------------------------------------------------------------------
log "4/15 - Instalando Docker + Compose"

if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

systemctl enable --now docker
docker --version
docker compose version

# ---------------------------------------------------------------------------
# 5. PM2
# ---------------------------------------------------------------------------
log "5/15 - Instalando PM2"

npm install -g pm2
pm2 --version

# ---------------------------------------------------------------------------
# 6. Aplicação
# ---------------------------------------------------------------------------
log "6/15 - Baixando aplicação do GitHub"

mkdir -p /var/www

if [ ! -d "$APP_DIR/.git" ]; then
  git clone --branch main "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch origin main
  git -C "$APP_DIR" checkout main
  git -C "$APP_DIR" reset --hard origin/main
fi

[ -f "$APP_DIR/package.json" ] || die "package.json não encontrado."
[ -f "$APP_DIR/deploy/ecosystem.config.cjs" ] || die "deploy/ecosystem.config.cjs não encontrado."

chmod +x "$APP_DIR"/deploy/*.sh 2>/dev/null || true

# ---------------------------------------------------------------------------
# 7. Supabase oficial
# ---------------------------------------------------------------------------
log "7/15 - Instalando Supabase self-hosted pela instalação oficial"

mkdir -p /root

# Em VPS nova, instala limpo. Se já existir, preserva.
if [ ! -f "$SUPABASE_DIR/.env" ]; then
  rm -rf "$SUPABASE_ROOT"
  cd /root
  curl -fsSL "$SUPABASE_SETUP_URL" -o /root/supabase-setup.sh
  chmod +x /root/supabase-setup.sh

  # A instalação oficial atual cria:
  # /root/supabase-project
  sh /root/supabase-setup.sh --project-dir supabase-project -y

  [ -f "$SUPABASE_DIR/.env" ] || die "Supabase não criou $SUPABASE_DIR/.env"
else
  ok "Supabase já existe; preservando instalação."
fi

SB_ENV="$SUPABASE_DIR/.env"

# ---------------------------------------------------------------------------
# 8. URLs/chaves do Supabase
# ---------------------------------------------------------------------------
log "8/15 - Configurando URLs e chaves do Supabase"

set_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$SB_ENV"; then
    sed -i "s|^${key}=.*$|${key}=${value}|" "$SB_ENV"
  else
    printf '%s=%s\n' "$key" "$value" >> "$SB_ENV"
  fi
}

set_env "SUPABASE_PUBLIC_URL" "https://${SUPABASE_DOMAIN}"
set_env "API_EXTERNAL_URL" "https://${SUPABASE_DOMAIN}/auth/v1"
set_env "SITE_URL" "https://${DOMAIN}"
set_env "PROXY_DOMAIN" "${SUPABASE_DOMAIN}"

cd "$SUPABASE_DIR"

if [ -x "utils/generate-keys.sh" ]; then
  sh utils/generate-keys.sh --update-env >/dev/null
fi
if [ -x "utils/add-new-auth-keys.sh" ]; then
  sh utils/add-new-auth-keys.sh --update-env >/dev/null
fi

PUBLISHABLE_KEY="$(grep '^SUPABASE_PUBLISHABLE_KEY=' "$SB_ENV" | cut -d= -f2-)"
SERVICE_ROLE_KEY="$(grep '^SERVICE_ROLE_KEY=' "$SB_ENV" | cut -d= -f2-)"
DB_PASS="$(grep '^POSTGRES_PASSWORD=' "$SB_ENV" | cut -d= -f2-)"

[ -n "$PUBLISHABLE_KEY" ] || die "SUPABASE_PUBLISHABLE_KEY não foi gerada."
[ -n "$SERVICE_ROLE_KEY" ] || die "SERVICE_ROLE_KEY não foi gerada."
[ -n "$DB_PASS" ] || die "POSTGRES_PASSWORD não encontrado."

# ---------------------------------------------------------------------------
# 9. Inicia Supabase e espera banco saudável
# ---------------------------------------------------------------------------
log "9/15 - Iniciando Supabase"

cd "$SUPABASE_DIR"
sh run.sh start

echo "Aguardando o banco do Supabase ficar saudável..."
for i in $(seq 1 60); do
  if docker compose ps --format '{{.Service}} {{.Health}}' 2>/dev/null | grep -q '^db healthy$'; then
    ok "supabase-db está saudável."
    break
  fi

  # Alguns Compose antigos não exibem Health no --format.
  if docker inspect -f '{{.State.Health.Status}}' supabase-db 2>/dev/null | grep -q '^healthy$'; then
    ok "supabase-db está saudável."
    break
  fi

  if [ "$i" -eq 60 ]; then
    docker compose ps || true
    docker compose logs --tail=120 db || true
    die "supabase-db não ficou saudável."
  fi
  sleep 5
done

docker compose ps

# Descobre o container PostgreSQL real.
DB_CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'supabase-db$' | head -n 1 || true)"
[ -n "$DB_CONTAINER" ] || DB_CONTAINER="supabase-db"

# ---------------------------------------------------------------------------
# 10. Backup de segurança + migração
# ---------------------------------------------------------------------------
log "10/15 - Fazendo backup de segurança e restaurando o banco do Lovable"

echo "Criando backup do banco atual antes da restauração..."
docker exec "$DB_CONTAINER" pg_dump \
  -U postgres \
  -d postgres \
  -Fc \
  > "$PRE_RESTORE_BACKUP"

chmod 600 "$PRE_RESTORE_BACKUP"
ok "Backup de segurança salvo em: $PRE_RESTORE_BACKUP"

# Confere se é um dump PostgreSQL válido.
# O backup do Lovable usa o formato CUSTOM 1.16, gerado por PostgreSQL 17.
# O Ubuntu 24.04 pode instalar um pg_restore mais antigo (ex.: 14/16),
# então a validação usa PostgreSQL 17 dentro de um container.
docker run --rm -i postgres:17 pg_restore -l - < "$BACKUP" >/dev/null 2>&1   || die "O arquivo informado não parece ser um backup PostgreSQL 17 válido."

echo "1/3 - Restaurando somente auth.users..."
docker exec -i "$DB_CONTAINER" pg_restore \
  -U postgres \
  --dbname=postgres \
  --no-owner \
  --no-privileges \
  --data-only \
  --schema=auth \
  --table=users \
  --exit-on-error \
  < "$BACKUP"

ok "auth.users restaurado."

echo "2/3 - Recriando schema public..."
docker exec "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
"

echo "3/3 - Restaurando schema public..."
docker exec -i "$DB_CONTAINER" pg_restore \
  -U postgres \
  --dbname=postgres \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  --schema=public \
  < "$BACKUP"

ok "Schema public restaurado."

# ---------------------------------------------------------------------------
# 11. Permissões/RLS/default privileges
# ---------------------------------------------------------------------------
log "11/15 - Aplicando permissões do Supabase para authenticated"

docker exec "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO authenticated;

GRANT USAGE, SELECT, UPDATE
ON ALL SEQUENCES IN SCHEMA public
TO authenticated;

GRANT EXECUTE
ON ALL FUNCTIONS IN SCHEMA public
TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT EXECUTE ON FUNCTIONS TO authenticated;
"

ok "Permissões authenticated aplicadas."

# Verificações objetivas da migração.
TABLE_COUNT="$(docker exec "$DB_CONTAINER" psql -U postgres -d postgres -Atc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")"

CLIENTES_COUNT="$(docker exec "$DB_CONTAINER" psql -U postgres -d postgres -Atc \
  "SELECT count(*) FROM public.clientes;" 2>/dev/null || echo 0)"

ORCAMENTOS_COUNT="$(docker exec "$DB_CONTAINER" psql -U postgres -d postgres -Atc \
  "SELECT count(*) FROM public.orcamentos;" 2>/dev/null || echo 0)"

PROFILES_COUNT="$(docker exec "$DB_CONTAINER" psql -U postgres -d postgres -Atc \
  "SELECT count(*) FROM public.profiles;" 2>/dev/null || echo 0)"

USERS_COUNT="$(docker exec "$DB_CONTAINER" psql -U postgres -d postgres -Atc \
  "SELECT count(*) FROM auth.users;" 2>/dev/null || echo 0)"

echo "Tabelas public: $TABLE_COUNT"
echo "Clientes:       $CLIENTES_COUNT"
echo "Orçamentos:     $ORCAMENTOS_COUNT"
echo "Profiles:       $PROFILES_COUNT"
echo "Usuários auth:  $USERS_COUNT"

[ "$TABLE_COUNT" -ge 1 ] || die "Nenhuma tabela public foi restaurada."
[ "$USERS_COUNT" -ge 1 ] || die "Nenhum usuário auth foi restaurado."

# ---------------------------------------------------------------------------
# 12. Corrige vite.config.ts e cria .env da aplicação
# ---------------------------------------------------------------------------
log "12/15 - Configurando aplicação e removendo referência antiga do Lovable"

APP_ENV="$APP_DIR/.env"

if [ ! -f "$APP_ENV" ]; then
  if [ -f "$APP_DIR/deploy/.env.example" ]; then
    cp "$APP_DIR/deploy/.env.example" "$APP_ENV"
  else
    touch "$APP_ENV"
  fi
fi

set_app_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$APP_ENV"; then
    sed -i "s|^${key}=.*$|${key}=${value}|" "$APP_ENV"
  else
    printf '%s=%s\n' "$key" "$value" >> "$APP_ENV"
  fi
}

set_app_env "SUPABASE_URL" "https://${SUPABASE_DOMAIN}"
set_app_env "SUPABASE_PUBLISHABLE_KEY" "$PUBLISHABLE_KEY"
set_app_env "SUPABASE_SERVICE_ROLE_KEY" "$SERVICE_ROLE_KEY"
set_app_env "VITE_SUPABASE_URL" "https://${SUPABASE_DOMAIN}"
set_app_env "VITE_SUPABASE_PUBLISHABLE_KEY" "$PUBLISHABLE_KEY"
set_app_env "VITE_SUPABASE_PROJECT_ID" "default"
set_app_env "SITE_URL" "https://${DOMAIN}"

# Z-API: preserva valores existentes; cria placeholders somente se ausentes.
grep -q '^ZAPI_BASE_URL=' "$APP_ENV" || echo 'ZAPI_BASE_URL=https://api.z-api.io' >> "$APP_ENV"
grep -q '^ZAPI_INSTANCE_ID=' "$APP_ENV" || echo 'ZAPI_INSTANCE_ID=' >> "$APP_ENV"
grep -q '^ZAPI_INSTANCE_TOKEN=' "$APP_ENV" || echo 'ZAPI_INSTANCE_TOKEN=' >> "$APP_ENV"
grep -q '^ZAPI_CLIENT_TOKEN=' "$APP_ENV" || echo 'ZAPI_CLIENT_TOKEN=' >> "$APP_ENV"

chmod 600 "$APP_ENV"

# Corrige o problema conhecido do vite.config.ts:
# se houver define com URL/chaves antigas do projeto Lovable, remove o bloco define.
if [ -f "$APP_DIR/vite.config.ts" ]; then
  cp -a "$APP_DIR/vite.config.ts" "$APP_DIR/vite.config.ts.before-selfhosted"

  python3 - "$APP_DIR/vite.config.ts" <<'PY'
from pathlib import Path
import re, sys

p = Path(sys.argv[1])
s = p.read_text(encoding="utf-8")

# Remove o bloco define: { ... } quando ele estiver dentro de export default defineConfig.
# O objetivo é deixar Vite ler VITE_* do ambiente normalmente.
m = re.search(r'(?ms)^[ \t]*define:\s*\{.*?\n[ \t]*\},\s*\n', s)
if m and ("VITE_SUPABASE_URL" in m.group(0) or "VITE_SUPABASE_PUBLISHABLE_KEY" in m.group(0)):
    s = s[:m.start()] + s[m.end():]
    p.write_text(s, encoding="utf-8")
PY
fi

# Remove referências do antigo projeto Supabase do build/config quando presentes.
OLD_SUPABASE="qmnienngwksbeiyczrka.supabase.co"
if grep -Rqs "$OLD_SUPABASE" "$APP_DIR/vite.config.ts" "$APP_DIR/.env" 2>/dev/null; then
  die "A referência antiga $OLD_SUPABASE ainda está presente no vite.config.ts/.env."
fi

# ---------------------------------------------------------------------------
# 13. Nginx + firewall
# ---------------------------------------------------------------------------
log "13/15 - Configurando Nginx e firewall"

cat > "/etc/nginx/sites-available/$APP_NAME" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        client_max_body_size 100m;
        proxy_read_timeout 300s;
        proxy_connect_timeout 60s;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name $SUPABASE_DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        client_max_body_size 100m;
        proxy_read_timeout 300s;
        proxy_connect_timeout 60s;
    }
}
NGINX

rm -f /etc/nginx/sites-enabled/default
ln -sfn "/etc/nginx/sites-available/$APP_NAME" "/etc/nginx/sites-enabled/$APP_NAME"

nginx -t
systemctl enable --now nginx
systemctl reload nginx

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# ---------------------------------------------------------------------------
# 14. Build + PM2
# ---------------------------------------------------------------------------
log "14/15 - Instalando dependências, build e PM2"

cd "$APP_DIR"

if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

NITRO_PRESET=node-server npm run build

# Valida que o build não ficou apontando para o Supabase antigo.
if grep -Rqs "$OLD_SUPABASE" "$APP_DIR/.output" 2>/dev/null; then
  die "O build contém referência ao Supabase antigo ($OLD_SUPABASE). Deploy interrompido."
fi

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$APP_DIR/deploy/ecosystem.config.cjs" --update-env
else
  pm2 start "$APP_DIR/deploy/ecosystem.config.cjs"
fi

# PM2 no boot para root.
STARTUP_CMD="$(pm2 startup systemd -u root --hp /root 2>/dev/null | tail -n 1 || true)"
if echo "$STARTUP_CMD" | grep -q '^sudo '; then
  eval "$STARTUP_CMD"
fi
pm2 save

# ---------------------------------------------------------------------------
# 15. HTTPS + testes + credenciais
# ---------------------------------------------------------------------------
log "15/15 - HTTPS, testes finais e relatório"

if [ "$DNS_OK" -eq 1 ]; then
  CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"

  if [ -z "$CERTBOT_EMAIL" ]; then
    read -r -p "Digite o e-mail para o Let's Encrypt (Enter para usar sem e-mail): " CERTBOT_EMAIL || true
  fi

  CERT_ARGS=(
    --nginx
    --non-interactive
    --agree-tos
    --redirect
    -d "$DOMAIN"
    -d "www.$DOMAIN"
    -d "$SUPABASE_DOMAIN"
  )

  if [ -n "$CERTBOT_EMAIL" ]; then
    certbot "${CERT_ARGS[@]}" --email "$CERTBOT_EMAIL" || \
      warn "Certbot falhou. O sistema continua em HTTP; tente novamente depois."
  else
    certbot "${CERT_ARGS[@]}" --register-unsafely-without-email || \
      warn "Certbot falhou. O sistema continua em HTTP; tente novamente depois."
  fi
else
  warn "HTTPS não executado porque o DNS não foi confirmado."
fi

sleep 5

APP_HTTP="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3000 || true)"
SB_HTTP="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:8000 || true)"

[ "$APP_HTTP" = "200" ] && ok "Aplicação local: HTTP $APP_HTTP" || warn "Aplicação local retornou HTTP $APP_HTTP"
if [ "$SB_HTTP" = "200" ] || [ "$SB_HTTP" = "401" ]; then
  ok "Supabase local respondeu HTTP $SB_HTTP"
else
  warn "Supabase local retornou HTTP $SB_HTTP"
fi

# Salva credenciais administrativas sem imprimir chaves na tela.
DASH_USER="$(grep '^DASHBOARD_USERNAME=' "$SB_ENV" | cut -d= -f2- || true)"
DASH_PASS="$(grep '^DASHBOARD_PASSWORD=' "$SB_ENV" | cut -d= -f2- || true)"

cat > "$CRED_FILE" <<EOF
IMPRESSÃO DIGITAL
=================

Site:
https://$DOMAIN

Supabase:
https://$SUPABASE_DOMAIN

Supabase Studio:
https://$SUPABASE_DOMAIN

Dashboard username:
$DASH_USER

Dashboard password:
$DASH_PASS

Postgres password:
$DB_PASS

Supabase .env:
$SB_ENV

Aplicação .env:
$APP_ENV

Backup de segurança pré-restauração:
$PRE_RESTORE_BACKUP

Backup Lovable restaurado:
$BACKUP

IMPORTANTE:
Este arquivo contém credenciais. NÃO envie para o GitHub.
EOF

chmod 600 "$CRED_FILE"

echo
echo "============================================================"
echo "       INSTALAÇÃO + MIGRAÇÃO FINALIZADA"
echo "============================================================"
echo
echo "SITE:"
echo "  https://$DOMAIN"
echo
echo "SUPABASE:"
echo "  https://$SUPABASE_DOMAIN"
echo
echo "CREDENCIAIS:"
echo "  cat $CRED_FILE"
echo
echo "STATUS:"
echo "  pm2 status"
echo "  cd $SUPABASE_DIR && docker compose ps"
echo
echo "LOGS:"
echo "  pm2 logs $APP_NAME"
echo "  cd $SUPABASE_DIR && sh run.sh logs"
echo
echo "BACKUP DE SEGURANÇA:"
echo "  $PRE_RESTORE_BACKUP"
echo
echo "PRÓXIMOS DEPLOYS:"
echo "  cd $APP_DIR && bash deploy/deploy.sh"
echo
echo "MIGRAÇÃO CONCLUÍDA:"
echo "  public tables: $TABLE_COUNT"
echo "  clientes:      $CLIENTES_COUNT"
echo "  orcamentos:    $ORCAMENTOS_COUNT"
echo "  profiles:      $PROFILES_COUNT"
echo "  auth.users:    $USERS_COUNT"
echo
echo "PENDÊNCIAS QUE NÃO ESTÃO NO BACKUP DO BANCO:"
echo "  1. Objetos físicos do Storage precisam ser migrados separadamente."
echo "  2. Z-API precisa receber as credenciais/webhooks."
echo "  3. Se a aplicação usar LOVABLE_API_KEY para IA, configure uma chave própria."
echo "============================================================"

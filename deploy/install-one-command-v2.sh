#!/usr/bin/env bash
# =============================================================================
# IMPRESSÃO DIGITAL - INSTALAÇÃO COMPLETA EM VPS NOVA
#
# Um único comando:
# curl -fsSL https://raw.githubusercontent.com/queiroz631-creator/impressaodigital/main/deploy/install-one-command.sh | sudo bash
#
# Pré-requisitos:
# - VPS Ubuntu 22.04/24.04
# - DNS A:
#     queiroztecno.com.br -> IP da VPS
#     www                 -> queiroztecno.com.br
#     supabase            -> IP da VPS
#
# O script instala/configura:
# - Node 20
# - Docker + Compose
# - Nginx
# - Certbot/HTTPS
# - PM2
# - Aplicação Lovable/TanStack
# - Supabase self-hosted (instalação oficial)
# - Firewall
# - PM2 no boot
#
# Não importa o backup do Lovable automaticamente.
# Não grava segredos no GitHub.
# =============================================================================

set -Eeuo pipefail

APP_NAME="impressaodigital"
APP_DIR="/var/www/impressaodigital"
SUPABASE_DIR="/root/supabase-project"
REPO_URL="https://github.com/queiroz631-creator/impressaodigital.git"
DOMAIN="queiroztecno.com.br"
SUPABASE_DOMAIN="supabase.queiroztecno.com.br"
SUPABASE_SETUP_URL="https://supabase.link/setup.sh"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()  { printf '\033[1;32m[OK]\033[0m %s\n' "$*"; }
warn(){ printf '\033[1;33m[AVISO]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[ERRO]\033[0m %s\n' "$*" >&2; exit 1; }

trap 'die "Falha na linha $LINENO. Consulte a mensagem acima."' ERR

[ "$(id -u)" -eq 0 ] || die "Execute como root: sudo bash install-one-command.sh"
command -v apt-get >/dev/null || die "Este instalador exige Ubuntu/Debian."

. /etc/os-release
case "${ID:-}" in
  ubuntu|debian) ;;
  *) die "Sistema não suportado: ${PRETTY_NAME:-desconhecido}" ;;
esac

echo
echo "============================================================"
echo "       IMPRESSÃO DIGITAL - DEPLOY 1 COMANDO"
echo "============================================================"
echo " Site:     https://$DOMAIN"
echo " Supabase: https://$SUPABASE_DOMAIN"
echo " GitHub:   $REPO_URL"
echo "============================================================"

# ---------------------------------------------------------------------------
# 1. Validações da VPS/DNS
# ---------------------------------------------------------------------------
log "1/12 - Validando VPS e DNS"

RAM_MB="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
DISK_GB="$(df -Pk / | awk 'NR==2 {printf "%.0f", $4/1024/1024}')"
VPS_IP="$(curl -4 -fsS --max-time 10 https://api.ipify.org || true)"
SITE_IP="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}' || true)"
SB_IP="$(getent ahostsv4 "$SUPABASE_DOMAIN" | awk 'NR==1{print $1}' || true)"

echo "RAM: ${RAM_MB} MB"
echo "Espaço livre em /: ${DISK_GB} GB"
echo "IP da VPS: ${VPS_IP:-não detectado}"
echo "DNS site: ${SITE_IP:-não resolvido}"
echo "DNS Supabase: ${SB_IP:-não resolvido}"

if [ "$RAM_MB" -lt 3800 ]; then
  warn "Supabase recomenda pelo menos 4 GB de RAM; idealmente 8 GB+ para produção."
fi
if [ "$DISK_GB" -lt 35 ]; then
  warn "Pouco espaço livre. Recomenda-se pelo menos ~40 GB para o stack completo."
fi

DNS_OK=0
if [ -n "$VPS_IP" ] && [ "$SITE_IP" = "$VPS_IP" ] && [ "$SB_IP" = "$VPS_IP" ]; then
  DNS_OK=1
  ok "DNS dos dois domínios aponta para esta VPS."
else
  warn "DNS ainda não está confirmado. O instalador continuará e tentará HTTPS no final."
fi

# ---------------------------------------------------------------------------
# 2. Pacotes base
# ---------------------------------------------------------------------------
log "2/12 - Instalando pacotes base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y \
  ca-certificates curl gnupg git jq openssl unzip \
  build-essential ufw nginx certbot python3-certbot-nginx

# ---------------------------------------------------------------------------
# 3. Node 20
# ---------------------------------------------------------------------------
log "3/12 - Instalando Node.js 20"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(".")[0]')" != "20" ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node --version
npm --version

# ---------------------------------------------------------------------------
# 4. Docker
# ---------------------------------------------------------------------------
log "4/12 - Instalando Docker + Compose"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  . /etc/os-release
  case "${ID}" in
    ubuntu)
      DOCKER_CODENAME="${VERSION_CODENAME}"
      ;;
    debian)
      DOCKER_CODENAME="${VERSION_CODENAME}"
      ;;
  esac

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${DOCKER_CODENAME} stable" \
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
log "5/12 - Instalando PM2"
npm install -g pm2
pm2 --version

# ---------------------------------------------------------------------------
# 6. Aplicação
# ---------------------------------------------------------------------------
log "6/12 - Baixando aplicação do GitHub"
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
[ -f "$APP_DIR/deploy/deploy.sh" ] || die "deploy/deploy.sh não encontrado."

chmod +x "$APP_DIR"/deploy/*.sh

# ---------------------------------------------------------------------------
# 7. Supabase oficial
# ---------------------------------------------------------------------------
log "7/12 - Instalando Supabase self-hosted pela instalação oficial"

mkdir -p /root
if [ ! -f "$SUPABASE_DIR/docker-compose.yml" ]; then
  rm -rf "$SUPABASE_DIR.tmp"
  mkdir -p "$SUPABASE_DIR.tmp"

  # O setup oficial cria projeto, gera todos os segredos/chaves e baixa imagens.
  # Usamos -y somente para aceitar os padrões; URLs serão corrigidas logo depois.
  cd /root
  curl -fsSL "$SUPABASE_SETUP_URL" -o /root/supabase-setup.sh
  chmod +x /root/supabase-setup.sh
  rm -rf "$SUPABASE_DIR"
  sh /root/supabase-setup.sh --project-dir supabase-project -y

  [ -f "$SUPABASE_DIR/.env" ] || die "Supabase não criou $SUPABASE_DIR/.env"
else
  ok "Supabase já existe; preservando instalação."
fi

SB_ENV="$SUPABASE_DIR/.env"

# ---------------------------------------------------------------------------
# 8. URLs e chaves Supabase
# ---------------------------------------------------------------------------
log "8/12 - Configurando URLs e chaves do Supabase"

# Substitui/cria as URLs públicas corretas.
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

# Garantir chaves modernas caso a versão instalada ainda não as tenha.
cd "$SUPABASE_DIR"
if [ -x "utils/generate-keys.sh" ]; then
  sh utils/generate-keys.sh --update-env >/dev/null
fi
if [ -x "utils/add-new-auth-keys.sh" ]; then
  sh utils/add-new-auth-keys.sh --update-env >/dev/null
fi

# Recupera chaves para a aplicação.
PUBLISHABLE_KEY="$(grep '^SUPABASE_PUBLISHABLE_KEY=' "$SB_ENV" | cut -d= -f2-)"
SECRET_KEY="$(grep '^SUPABASE_SECRET_KEY=' "$SB_ENV" | cut -d= -f2-)"
SERVICE_ROLE_KEY="$(grep '^SERVICE_ROLE_KEY=' "$SB_ENV" | cut -d= -f2-)"

[ -n "$PUBLISHABLE_KEY" ] || die "SUPABASE_PUBLISHABLE_KEY não foi gerada."
[ -n "$SERVICE_ROLE_KEY" ] || die "SERVICE_ROLE_KEY não foi gerada."

# ---------------------------------------------------------------------------
# 9. Inicia Supabase
# ---------------------------------------------------------------------------
log "9/12 - Iniciando Supabase"

cd "$SUPABASE_DIR"
sh run.sh start

# Espera um pouco e verifica os serviços.
sleep 10
docker compose ps

# ---------------------------------------------------------------------------
# 10. Cria .env da aplicação
# ---------------------------------------------------------------------------
log "10/12 - Configurando ambiente da aplicação"

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

# Mantém Z-API se já existir no .env; caso não exista, cria vazios.
grep -q '^ZAPI_BASE_URL=' "$APP_ENV" || echo 'ZAPI_BASE_URL=https://api.z-api.io' >> "$APP_ENV"
grep -q '^ZAPI_INSTANCE_ID=' "$APP_ENV" || echo 'ZAPI_INSTANCE_ID=' >> "$APP_ENV"
grep -q '^ZAPI_INSTANCE_TOKEN=' "$APP_ENV" || echo 'ZAPI_INSTANCE_TOKEN=' >> "$APP_ENV"
grep -q '^ZAPI_CLIENT_TOKEN=' "$APP_ENV" || echo 'ZAPI_CLIENT_TOKEN=' >> "$APP_ENV"

chmod 600 "$APP_ENV"

# ---------------------------------------------------------------------------
# 11. Nginx + build + PM2
# ---------------------------------------------------------------------------
log "11/12 - Configurando Nginx, build e PM2"

cat > /etc/nginx/sites-available/$APP_NAME <<NGINX
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
ln -sfn /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/$APP_NAME
nginx -t
systemctl enable --now nginx
systemctl reload nginx

# Firewall.
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# Build.
cd "$APP_DIR"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

NITRO_PRESET=node-server npm run build

# PM2.
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$APP_DIR/deploy/ecosystem.config.cjs" --update-env
else
  pm2 start "$APP_DIR/deploy/ecosystem.config.cjs"
fi

# PM2 startup para root.
STARTUP_CMD="$(pm2 startup systemd -u root --hp /root | tail -n 1 || true)"
if echo "$STARTUP_CMD" | grep -q '^sudo '; then
  eval "$STARTUP_CMD"
fi
pm2 save

# ---------------------------------------------------------------------------
# 12. HTTPS + testes
# ---------------------------------------------------------------------------
log "12/12 - HTTPS e testes finais"

# O Certbot precisa que os dois nomes resolvam para a VPS.
if [ "$DNS_OK" -eq 1 ]; then
  certbot --nginx --non-interactive --agree-tos \
    --register-unsafely-without-email \
    --redirect \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    -d "$SUPABASE_DOMAIN" || \
    warn "Certbot falhou. O site continua em HTTP e o certificado pode ser emitido depois."
else
  warn "HTTPS não foi executado porque o DNS não está confirmado."
fi

# Testes locais.
sleep 3
APP_HTTP="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000 || true)"
SB_HTTP="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000 || true)"

[ "$APP_HTTP" = "200" ] && ok "Aplicação local: HTTP $APP_HTTP" || warn "Aplicação local retornou HTTP $APP_HTTP"
if [ "$SB_HTTP" = "200" ] || [ "$SB_HTTP" = "401" ]; then
  ok "Supabase local respondeu HTTP $SB_HTTP"
else
  warn "Supabase local retornou HTTP $SB_HTTP"
fi

# ---------------------------------------------------------------------------
# Credenciais administrativas: salva localmente, não imprime chaves.
# ---------------------------------------------------------------------------
CRED_FILE="/root/impressaodigital-credentials.txt"
DASH_USER="$(grep '^DASHBOARD_USERNAME=' "$SB_ENV" | cut -d= -f2-)"
DASH_PASS="$(grep '^DASHBOARD_PASSWORD=' "$SB_ENV" | cut -d= -f2-)"
DB_PASS="$(grep '^POSTGRES_PASSWORD=' "$SB_ENV" | cut -d= -f2-)"

cat > "$CRED_FILE" <<EOF
IMPRESSÃO DIGITAL
=================

Site:
https://$DOMAIN

Supabase Studio:
https://$SUPABASE_DOMAIN

Supabase Dashboard:
username: $DASH_USER
password: $DASH_PASS

Postgres password:
$DB_PASS

Arquivo de configuração do Supabase:
$SB_ENV

Arquivo .env da aplicação:
$APP_ENV

ATENÇÃO:
Este arquivo contém credenciais. Não envie para o GitHub.
EOF
chmod 600 "$CRED_FILE"

# ---------------------------------------------------------------------------
# Resultado
# ---------------------------------------------------------------------------
echo
echo "============================================================"
echo "              INSTALAÇÃO FINALIZADA"
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
echo "PRÓXIMOS DEPLOYS:"
echo "  cd $APP_DIR && bash deploy/deploy.sh"
echo
echo "IMPORTANTE:"
echo "  1. O banco do Lovable ainda precisa ser restaurado do backup."
echo "  2. Storage do Lovable precisa ser migrado."
echo "  3. Z-API precisa receber as credenciais/webhooks."
echo "  4. A IA que dependia de LOVABLE_API_KEY precisa ser adaptada para uma chave própria."
echo "============================================================"

#!/usr/bin/env bash
# install-migrate-one-command.sh
# Instala uma VPS nova e migra o projeto Impressão Digital para Supabase self-hosted.
#
# USO:
#   sudo bash install-migrate-one-command.sh /root/impressaodigital_260909.backup
#
# Antes de executar:
#   1) DNS A de queiroztecno.com.br e supabase.queiroztecno.com.br -> IP da VPS
#   2) backup .backup já enviado para a VPS
#
# O script:
#   - instala Docker, Node 20, PM2, Nginx e Certbot
#   - instala Supabase self-hosted
#   - configura HTTPS
#   - clona o projeto do GitHub
#   - cria o .env da aplicação
#   - restaura auth.users e public
#   - aplica os GRANTs que foram necessários nesta migração
#   - faz build e inicia PM2
#
# NÃO migra os arquivos físicos do Storage. Eles precisam ser copiados separadamente.

set -Eeuo pipefail
export DEBIAN_FRONTEND=noninteractive

APP_NAME="impressaodigital"
APP_DIR="/var/www/impressaodigital"
SUPABASE_DIR="/root/supabase-project"
REPO_URL="https://github.com/queiroz631-creator/impressaodigital.git"

DOMAIN="${DOMAIN:-queiroztecno.com.br}"
WWW_DOMAIN="${WWW_DOMAIN:-www.queiroztecno.com.br}"
SUPABASE_DOMAIN="${SUPABASE_DOMAIN:-supabase.queiroztecno.com.br}"
EMAIL="${CERTBOT_EMAIL:-}"
BACKUP="${1:-}"

log() {
  echo
  echo "============================================================"
  echo "$*"
  echo "============================================================"
}

die() {
  echo "ERRO: $*" >&2
  exit 1
}

if [[ $EUID -ne 0 ]]; then
  die "Execute como root."
fi

if [[ -z "$BACKUP" ]]; then
  read -r -p "Caminho completo do backup .backup: " BACKUP
fi
[[ -f "$BACKUP" ]] || die "Backup não encontrado: $BACKUP"

if [[ -z "$EMAIL" ]]; then
  read -r -p "E-mail para o Let's Encrypt: " EMAIL
fi
[[ -n "$EMAIL" ]] || die "E-mail obrigatório."

log "[1/12] Atualizando Ubuntu e instalando dependências"
apt-get update
apt-get install -y \
  ca-certificates curl git jq unzip rsync nginx certbot \
  python3-certbot-nginx ufw openssl

log "[2/12] Instalando Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker
docker --version
docker compose version

log "[3/12] Instalando Node.js 20 e PM2"
NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
fi

if [[ "$NODE_MAJOR" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

npm install -g pm2
node -v
npm -v
pm2 -v

log "[4/12] Baixando o projeto"
mkdir -p /var/www

if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" reset --hard origin/main
else
  rm -rf "$APP_DIR"
  git clone --branch main "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

log "[5/12] Instalando Supabase self-hosted"
if [[ ! -f "$SUPABASE_DIR/docker/docker-compose.yml" ]]; then
  rm -rf "$SUPABASE_DIR"
  git clone --depth 1 https://github.com/supabase/supabase.git "$SUPABASE_DIR"

  cd "$SUPABASE_DIR/docker"
  chmod +x setup.sh 2>/dev/null || true

  # O setup oficial gera os segredos e cria o .env.
  if [[ -x ./setup.sh ]]; then
    ./setup.sh -y
  else
    curl -fsSL \
      https://raw.githubusercontent.com/supabase/supabase/master/docker/setup.sh \
      -o setup.sh
    chmod +x setup.sh
    ./setup.sh -y
  fi
else
  echo "Supabase já instalado em $SUPABASE_DIR."
fi

cd "$SUPABASE_DIR/docker"

set_env() {
  local key="$1"
  local value="$2"

  if grep -q "^${key}=" .env; then
    sed -i "s#^${key}=.*#${key}=${value}#" .env
  else
    printf '\n%s=%s\n' "$key" "$value" >> .env
  fi
}

# URLs usadas pelo Supabase atrás do Nginx.
set_env "SUPABASE_PUBLIC_URL" "https://${SUPABASE_DOMAIN}"
set_env "API_EXTERNAL_URL" "https://${SUPABASE_DOMAIN}/auth/v1"
set_env "SITE_URL" "https://${DOMAIN}"
set_env "PROXY_DOMAIN" "${SUPABASE_DOMAIN}"

log "[6/12] Iniciando Supabase"
sh run.sh start
sleep 10
docker compose ps

log "[7/12] Criando .env da aplicação"
PUBLISHABLE_KEY="$(grep '^SUPABASE_PUBLISHABLE_KEY=' .env | cut -d= -f2- || true)"

# O projeto atual usa SUPABASE_SERVICE_ROLE_KEY no lado servidor.
# Preferimos a chave legacy SERVICE_ROLE_KEY quando disponível.
SERVICE_ROLE_KEY="$(grep '^SERVICE_ROLE_KEY=' .env | cut -d= -f2- || true)"
if [[ -z "$SERVICE_ROLE_KEY" ]]; then
  SERVICE_ROLE_KEY="$(grep '^SUPABASE_SECRET_KEY=' .env | cut -d= -f2- || true)"
fi

[[ -n "$PUBLISHABLE_KEY" ]] || die "SUPABASE_PUBLISHABLE_KEY não foi gerada."
[[ -n "$SERVICE_ROLE_KEY" ]] || die "Chave server-side do Supabase não foi encontrada."

cat > "$APP_DIR/.env" <<EOF
SUPABASE_URL=https://${SUPABASE_DOMAIN}
SUPABASE_PUBLISHABLE_KEY=${PUBLISHABLE_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}

VITE_SUPABASE_URL=https://${SUPABASE_DOMAIN}
VITE_SUPABASE_PUBLISHABLE_KEY=${PUBLISHABLE_KEY}
VITE_SUPABASE_PROJECT_ID=default

SITE_URL=https://${DOMAIN}

ZAPI_BASE_URL=https://api.z-api.io
ZAPI_INSTANCE_ID=
ZAPI_INSTANCE_TOKEN=
ZAPI_CLIENT_TOKEN=
EOF

chmod 600 "$APP_DIR/.env"

# O projeto Lovable original tinha URLs antigas fixadas no vite.config.ts.
# Remove apenas o bloco define caso a URL antiga ainda esteja presente.
if grep -q 'qmnienngwksbeiyczrka.supabase.co' "$APP_DIR/vite.config.ts" 2>/dev/null; then
  cp "$APP_DIR/vite.config.ts" "$APP_DIR/vite.config.ts.backup-before-supabase"
  python3 - "$APP_DIR/vite.config.ts" <<'PY'
from pathlib import Path
import sys

p = Path(sys.argv[1])
s = p.read_text()

start = s.find("    define: {")
if start != -1:
    end = s.find("    },", start)
    if end != -1:
        s = s[:start] + s[end + len("    },"):]

p.write_text(s)
PY
fi

log "[8/12] Fazendo backup de segurança e restaurando o banco"
cp "$BACKUP" /root/lovable-migration.backup
chmod 600 /root/lovable-migration.backup

# Backup do estado atual da VPS antes da restauração.
docker exec supabase-db pg_dump -U postgres -d postgres -Fc \
  > "/root/banco-vps-antes-restauracao-$(date +%Y%m%d-%H%M%S).backup"

# 1. Importa primeiro os usuários do Auth.
# Isso é importante porque tabelas como public.orcamentos possuem FK para auth.users.
docker exec -i supabase-db pg_restore \
  -U postgres \
  --dbname=postgres \
  --no-owner \
  --no-privileges \
  --data-only \
  --schema=auth \
  --table=users \
  --exit-on-error \
  < /root/lovable-migration.backup

# 2. Recria SOMENTE o schema public.
# Não mexe em auth, storage ou realtime.
docker exec -i supabase-db psql \
  -U postgres \
  -d postgres \
  -v ON_ERROR_STOP=1 \
  -c "DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;"

# 3. Restaura schema, dados, funções, triggers e policies do public.
docker exec -i supabase-db pg_restore \
  -U postgres \
  --dbname=postgres \
  --no-owner \
  --no-privileges \
  --schema=public \
  --exit-on-error \
  < /root/lovable-migration.backup

log "[9/12] Aplicando permissões do papel authenticated"
# Este foi o ajuste que resolveu o acesso aos dados nesta migração.
docker exec -i supabase-db psql \
  -U postgres \
  -d postgres \
  -v ON_ERROR_STOP=1 \
  -c "GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
      GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;"

# Mantém os privilégios para objetos public criados futuramente.
docker exec -i supabase-db psql \
  -U postgres \
  -d postgres \
  -v ON_ERROR_STOP=1 \
  -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT EXECUTE ON FUNCTIONS TO authenticated;"

log "[10/12] Configurando Nginx"
rm -f /etc/nginx/sites-enabled/default

cat > /etc/nginx/sites-available/queiroztecno <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${WWW_DOMAIN};

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
        proxy_read_timeout 300;
        proxy_connect_timeout 60;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name ${SUPABASE_DOMAIN};

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
        proxy_read_timeout 300;
        proxy_connect_timeout 60;
    }
}
EOF

ln -sf /etc/nginx/sites-available/queiroztecno /etc/nginx/sites-enabled/queiroztecno

nginx -t
systemctl enable --now nginx
systemctl reload nginx

log "[11/12] Emitindo HTTPS"
certbot --nginx \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  -d "$DOMAIN" \
  -d "$WWW_DOMAIN" \
  -d "$SUPABASE_DOMAIN" \
  --redirect

log "[12/12] Build, PM2 e testes"
cd "$APP_DIR"

npm ci
NITRO_PRESET=node-server npm run build

# Garante que o build não contém a URL antiga do Lovable.
if grep -Rqs "qmnienngwksbeiyczrka.supabase.co" .output 2>/dev/null; then
  die "A URL antiga do Lovable ainda está no build."
fi

pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
pm2 start deploy/ecosystem.config.cjs
pm2 save

# Configura o PM2 para voltar após reboot.
pm2 startup systemd -u root --hp /root >/tmp/pm2-startup.txt 2>&1 || true
systemctl enable pm2-root >/dev/null 2>&1 || true

sleep 5

echo
echo "===== PM2 ====="
pm2 status

echo
echo "===== SUPABASE ====="
cd "$SUPABASE_DIR/docker"
docker compose ps

echo
echo "===== SITE ====="
curl -fsSI "https://${DOMAIN}" | head -n 5

echo
echo "===== CONTAGENS DO BANCO ====="
docker exec -i supabase-db psql \
  -U postgres \
  -d postgres \
  -tAc "SELECT 'TABELAS PUBLIC', count(*)
         FROM information_schema.tables
         WHERE table_schema='public'
         UNION ALL
         SELECT 'USERS AUTH', count(*) FROM auth.users
         UNION ALL
         SELECT 'CLIENTES', count(*) FROM public.clientes
         UNION ALL
         SELECT 'ORCAMENTOS', count(*) FROM public.orcamentos;"

echo
echo "===== TESTE DA API AUTH ====="
curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
  -H "apikey: ${PUBLISHABLE_KEY}" \
  "https://${SUPABASE_DOMAIN}/auth/v1/settings" || true

log "INSTALAÇÃO E MIGRAÇÃO CONCLUÍDAS"

cat <<EOF

SITE:
  https://${DOMAIN}

SUPABASE:
  https://${SUPABASE_DOMAIN}

APLICAÇÃO:
  ${APP_DIR}

SUPABASE:
  ${SUPABASE_DIR}/docker

BACKUP ORIGINAL:
  /root/lovable-migration.backup

CREDENCIAIS SUPABASE:
  ${SUPABASE_DIR}/docker/.env
  NÃO compartilhe este arquivo.

COMANDOS:
  pm2 status
  pm2 logs ${APP_NAME}
  cd ${SUPABASE_DIR}/docker && sh run.sh logs
  cd ${APP_DIR} && bash deploy/deploy.sh

IMPORTANTE:
  - Storage: os objetos/arquivos físicos dos buckets não fazem parte desta restauração
    e precisam ser copiados separadamente.
  - Z-API: preencha as credenciais no ${APP_DIR}/.env e execute:
      pm2 reload ${APP_NAME} --update-env
  - A chave LOVABLE_API_KEY não deve ser usada como solução de produção fora do Lovable.
  - Mantenha o backup protegido.
EOF

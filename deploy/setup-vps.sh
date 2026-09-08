#!/usr/bin/env bash
# =============================================================================
# Setup inicial da VPS Hostinger (Ubuntu 22.04/24.04) — Impressão Digital
# Executa UMA VEZ numa VPS nova. Instala Node 20, Docker, Nginx, Certbot, PM2,
# clona a aplicação e baixa o Supabase self-hosted.
#
# Uso:  sudo bash setup-vps.sh <URL_DO_REPOSITORIO_GIT>
# Ex.:  sudo bash setup-vps.sh https://github.com/usuario/impressaodigital.git
# =============================================================================
set -euo pipefail

REPO_URL="${1:-}"
APP_DIR="/var/www/impressaodigital"
SUPABASE_DIR="/opt/supabase"

if [ -z "$REPO_URL" ]; then
  echo "Uso: sudo bash setup-vps.sh <URL_DO_REPOSITORIO_GIT>"
  echo "Ex.: sudo bash setup-vps.sh https://github.com/usuario/impressaodigital.git"
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "Execute como root: sudo bash setup-vps.sh ..."
  exit 1
fi

echo "==> [1/7] Atualizando o sistema"
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg git ufw build-essential

echo "==> [2/7] Instalando Node.js 20 LTS"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node --version

echo "==> [3/7] Instalando PM2 (gerenciador de processo)"
npm install -g pm2

echo "==> [4/7] Instalando Docker + Docker Compose"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
docker --version

echo "==> [5/7] Instalando Nginx + Certbot (HTTPS)"
apt-get install -y nginx certbot python3-certbot-nginx

echo "==> [6/7] Clonando a aplicação em $APP_DIR"
mkdir -p "$APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" pull
fi
chmod +x "$APP_DIR/deploy/"*.sh

echo "==> Baixando Supabase self-hosted em $SUPABASE_DIR"
mkdir -p "$SUPABASE_DIR"
if [ ! -d "$SUPABASE_DIR/supabase" ]; then
  git clone --depth 1 https://github.com/supabase/supabase.git "$SUPABASE_DIR/supabase"
fi
if [ ! -f "$SUPABASE_DIR/supabase/docker/.env" ]; then
  cp "$SUPABASE_DIR/supabase/docker/.env.example" "$SUPABASE_DIR/supabase/docker/.env"
fi

echo "==> [7/7] Firewall (libera SSH, HTTP e HTTPS)"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo
echo "============================================================"
echo " SETUP CONCLUÍDO"
echo "============================================================"
echo "Próximos passos (detalhes em $APP_DIR/deploy/README.md):"
echo " 1) Edite as senhas/chaves do Supabase:"
echo "      nano $SUPABASE_DIR/supabase/docker/.env"
echo " 2) Suba o Supabase:"
echo "      cd $SUPABASE_DIR/supabase/docker && docker compose up -d"
echo " 3) Crie o .env da aplicação:"
echo "      cp $APP_DIR/deploy/.env.example $APP_DIR/.env && nano $APP_DIR/.env"
echo " 4) Publique a aplicação:"
echo "      cd $APP_DIR && bash deploy/deploy.sh"
echo " 5) Configure o Nginx e o HTTPS (certbot) — veja o README."

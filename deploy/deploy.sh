#!/usr/bin/env bash
# =============================================================================
# Publica/atualiza a aplicação na VPS. Rode sempre que houver versão nova:
#   cd /var/www/impressaodigital && bash deploy/deploy.sh
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Baixando a última versão do GitHub"
git pull

echo "==> Carregando variáveis de ambiente (.env)"
echo "    Lembre-se: .env é ignorado pelo Git. O modelo versionado é deploy/.env.example"
if [ ! -f .env ]; then
  echo "ERRO: arquivo .env não encontrado."
  echo "Copie o modelo: cp deploy/.env.example .env  e preencha os valores."
  exit 1
fi
set -a
# shellcheck disable=SC1091
. ./.env
set +a

echo "==> Instalando dependências"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

echo "==> Gerando build de produção (servidor Node)"
NITRO_PRESET=node-server npm run build

echo "==> (Re)iniciando a aplicação no PM2"
if pm2 describe impressaodigital >/dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.cjs
else
  pm2 start deploy/ecosystem.config.cjs
fi
pm2 save

echo
echo "==> Publicação concluída."
echo "    Status: pm2 status"
echo "    Logs:   pm2 logs impressaodigital"

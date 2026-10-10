#!/bin/bash

set -Eeuo pipefail

BACKUP_DIR="/root/backups/impressaodigital"
STORAGE_DIR="/root/supabase-project/volumes/storage"
DB_CONTAINER="supabase-db"
DB_USER="postgres"
DB_NAME="postgres"
RETENTION=7

DATE="$(date '+%Y-%m-%d_%H-%M-%S')"
WORK_DIR="${BACKUP_DIR}/.tmp-${DATE}"
BACKUP_FILE="${BACKUP_DIR}/backup-${DATE}.tar.gz"
LOG_FILE="${BACKUP_DIR}/backup.log"

exec >> "$LOG_FILE" 2>&1

echo "========================================"
echo "Início do backup: $(date)"
echo "========================================"

cleanup() {
    rm -rf "$WORK_DIR"
}
trap cleanup EXIT

mkdir -p "$BACKUP_DIR"
mkdir -p "$WORK_DIR/database"
mkdir -p "$WORK_DIR/storage"

echo "[1/5] Verificando banco..."
docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME"

echo "[2/5] Fazendo backup do PostgreSQL..."
docker exec "$DB_CONTAINER" \
    pg_dump -U "$DB_USER" -d "$DB_NAME" \
    --format=plain \
    --no-owner \
    --no-privileges \
    | gzip > "$WORK_DIR/database/database.sql.gz"

if [ ! -s "$WORK_DIR/database/database.sql.gz" ]; then
    echo "ERRO: backup do banco está vazio."
    exit 1
fi

echo "Banco: $(du -h "$WORK_DIR/database/database.sql.gz" | cut -f1)"

echo "[3/5] Fazendo backup do Storage..."
if [ ! -d "$STORAGE_DIR" ]; then
    echo "ERRO: diretório do Storage não encontrado:"
    echo "$STORAGE_DIR"
    exit 1
fi

tar -C "$STORAGE_DIR" -czf "$WORK_DIR/storage/storage.tar.gz" .

if [ ! -s "$WORK_DIR/storage/storage.tar.gz" ]; then
    echo "ERRO: backup do Storage está vazio."
    exit 1
fi

echo "Storage: $(du -h "$WORK_DIR/storage/storage.tar.gz" | cut -f1)"

echo "[4/5] Criando backup final..."
tar -C "$WORK_DIR" -czf "$BACKUP_FILE" database storage

echo "[5/5] Validando backup..."
tar -tzf "$BACKUP_FILE" >/dev/null

if [ ! -s "$BACKUP_FILE" ]; then
    echo "ERRO: arquivo final não foi criado."
    exit 1
fi

echo "Backup criado:"
ls -lh "$BACKUP_FILE"

echo "Removendo backups antigos..."

mapfile -t BACKUPS < <(
    find "$BACKUP_DIR" \
        -maxdepth 1 \
        -type f \
        -name 'backup-*.tar.gz' \
        -printf '%T@ %p\n' \
        | sort -nr \
        | tail -n +$((RETENTION + 1)) \
        | cut -d' ' -f2-
)

for FILE in "${BACKUPS[@]}"; do
    [ -n "$FILE" ] || continue
    echo "Removendo: $FILE"
    rm -f "$FILE"
done

echo
echo "Backups atualmente armazenados:"
find "$BACKUP_DIR" \
    -maxdepth 1 \
    -type f \
    -name 'backup-*.tar.gz' \
    -printf '%TY-%Tm-%Td %TH:%TM  %s bytes  %p\n' \
    | sort -r

echo
echo "Backup concluído com sucesso: $(date)"
echo "========================================"
echo

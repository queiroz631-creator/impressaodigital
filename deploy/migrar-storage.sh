#!/usr/bin/env bash
# =============================================================================
# Migração de Storage do Lovable Cloud para o Supabase self-hosted na VPS.
#
# USO:
#   export SOURCE_SERVICE_ROLE_KEY=<chave-service-role-do-lovable>
#   bash deploy/migrar-storage.sh
#
# Opcional:
#   export SOURCE_URL=https://qmnienngwksbeiyczrka.supabase.co
#   export DEST_URL=https://supabase.queiroztecno.com.br
#   export DEST_SERVICE_ROLE_KEY=<chave-da-vps>  # se não informada, lê do .env do Supabase
#   export BUCKETS="bot-midia mensagens-rapidas orcamento-arquivos sistema whatsapp database_export_09_09_26"
#
# O script:
#   - cria os buckets privados no destino;
#   - lista todos os arquivos da origem;
#   - baixa e reenvia cada arquivo preservando o caminho;
#   - pula arquivos que já existem no destino (pode rodar várias vezes);
#   - grava em /root/migrar-storage.log os arquivos que falharam.
#
# Nada é apagado na origem.
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

export SOURCE_URL="${SOURCE_URL:-https://qmnienngwksbeiyczrka.supabase.co}"
export DEST_URL="${DEST_URL:-https://supabase.queiroztecno.com.br}"
export BUCKETS="${BUCKETS:-bot-midia mensagens-rapidas orcamento-arquivos sistema whatsapp database_export_09_09_26}"

if [ -z "${SOURCE_SERVICE_ROLE_KEY:-}" ]; then
  echo "ERRO: informe a chave de serviço da origem (Lovable) em SOURCE_SERVICE_ROLE_KEY."
  exit 1
fi

if [ -z "${DEST_SERVICE_ROLE_KEY:-}" ]; then
  SB_ENV="/root/supabase-project/.env"
  if [ -f "$SB_ENV" ]; then
    DEST_SERVICE_ROLE_KEY="$(grep '^SERVICE_ROLE_KEY=' "$SB_ENV" | cut -d= -f2- | head -n1)"
  fi
fi

if [ -z "${DEST_SERVICE_ROLE_KEY:-}" ]; then
  echo "ERRO: informe a chave de serviço do destino (VPS) em DEST_SERVICE_ROLE_KEY"
  echo "       ou deixe o Supabase rodando em /root/supabase-project/.env."
  exit 1
fi

export DEST_SERVICE_ROLE_KEY
export LOG_FILE="${LOG_FILE:-/root/migrar-storage.log}"

python3 - "$@" <<'PY'
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

SOURCE_URL = os.environ["SOURCE_URL"].rstrip("/")
SOURCE_KEY = os.environ["SOURCE_SERVICE_ROLE_KEY"]
DEST_URL = os.environ["DEST_URL"].rstrip("/")
DEST_KEY = os.environ["DEST_SERVICE_ROLE_KEY"]
BUCKETS = os.environ["BUCKETS"].split()
LOG_FILE = os.environ["LOG_FILE"]


def request(base, key, method, path, body=None, headers=None, raw_path=False):
    """Faz uma requisição à API REST de Storage do Supabase."""
    if raw_path:
        url = f"{base}{path}"
    else:
        url = f"{base}/storage/v1{path}"

    req_headers = {"Accept": "application/json"}
    if key:
        req_headers["Authorization"] = f"Bearer {key}"
        req_headers["apikey"] = key
    if headers:
        req_headers.update(headers)

    data = None
    if body is not None:
        if isinstance(body, (dict, list)):
            data = json.dumps(body).encode("utf-8")
            req_headers.setdefault("Content-Type", "application/json")
        else:
            data = body

    req = urllib.request.Request(url, data=data, method=method, headers=req_headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.status, resp.read(), resp.headers
    except urllib.error.HTTPError as e:
        return e.code, e.read(), e.headers
    except Exception as e:
        return 0, str(e).encode(), {}


def create_bucket_if_needed(bucket):
    """Cria o bucket no destino como privado, se ainda não existir."""
    status, data, _ = request(DEST_URL, DEST_KEY, "GET", f"/bucket/{bucket}")
    if status == 200:
        return True

    status, data, _ = request(
        DEST_URL,
        DEST_KEY,
        "POST",
        "/bucket",
        body={"id": bucket, "name": bucket, "public": False},
    )
    if status in (200, 201):
        return True

    # Bucket já existe mas o GET anterior pode ter falhado por permissão.
    if status == 409:
        return True

    print(f"  [bucket] falha ao criar '{bucket}': {status} {data.decode(errors='replace')[:200]}")
    return False


def list_objects(base, key, bucket, prefix=""):
    """Lista objetos de um bucket, recursivamente quando necessário."""
    found = []
    visited = set()
    stack = [prefix]

    while stack:
        current_prefix = stack.pop()
        if current_prefix in visited:
            continue
        visited.add(current_prefix)

        offset = 0
        limit = 1000
        while True:
            status, data, _ = request(
                base,
                key,
                "POST",
                f"/object/list/{bucket}",
                body={"prefix": current_prefix, "limit": limit, "offset": offset},
            )
            if status != 200:
                print(
                    f"  [list] falha em '{bucket}/{current_prefix}': "
                    f"{status} {data.decode(errors='replace')[:200]}"
                )
                break

            items = json.loads(data.decode("utf-8"))
            if not items:
                break

            for item in items:
                name = item.get("name", "")
                if name.endswith("/"):
                    stack.append(name)
                else:
                    found.append(name)

            if len(items) < limit:
                break
            offset += limit

    return found


def download_object(bucket, path):
    """Baixa um arquivo da origem e retorna os bytes."""
    encoded = urllib.parse.quote(path, safe="/")
    status, data, headers = request(
        SOURCE_URL,
        SOURCE_KEY,
        "GET",
        f"/object/authenticated/{bucket}/{encoded}",
        raw_path=True,
    )
    if status != 200:
        return None, f"{status} {data.decode(errors='replace')[:200]}"

    content_type = headers.get("Content-Type", "application/octet-stream")
    return data, content_type


def upload_object(bucket, path, data, content_type):
    """Envia um arquivo para o destino preservando o caminho."""
    encoded = urllib.parse.quote(path, safe="/")
    status, data_resp, _ = request(
        DEST_URL,
        DEST_KEY,
        "POST",
        f"/object/{bucket}/{encoded}",
        body=data,
        headers={"Content-Type": content_type, "x-upsert": "false"},
        raw_path=True,
    )
    if status in (200, 201):
        return True, None
    return False, f"{status} {data_resp.decode(errors='replace')[:200]}"


def main():
    print("=" * 60)
    print(" MIGRAÇÃO DE STORAGE: LOVABLE CLOUD -> VPS")
    print("=" * 60)
    print(f"Origem:  {SOURCE_URL}")
    print(f"Destino: {DEST_URL}")
    print(f"Buckets: {', '.join(BUCKETS)}")
    print(f"Log:     {LOG_FILE}")
    print()

    log_path = Path(LOG_FILE)
    log_path.write_text("")  # limpa log da execução anterior

    total_copiados = 0
    total_pulados = 0
    total_falhas = 0

    for bucket in BUCKETS:
        print(f"\nBucket: {bucket}")

        if not create_bucket_if_needed(bucket):
            total_falhas += 1
            continue

        print("  Listando arquivos no destino...")
        dest_existing = set(list_objects(DEST_URL, DEST_KEY, bucket))
        print(f"  {len(dest_existing)} arquivo(s) já existem no destino.")

        print("  Listando arquivos na origem...")
        source_files = list_objects(SOURCE_URL, SOURCE_KEY, bucket)
        print(f"  {len(source_files)} arquivo(s) encontrados na origem.")

        copiados = 0
        pulados = 0
        falhas = 0

        for i, path in enumerate(source_files, 1):
            if path in dest_existing:
                pulados += 1
                continue

            # Mostra progresso a cada arquivo.
            print(f"  [{i}/{len(source_files)}] {path[:80]}", end=" ")

            data, err = download_object(bucket, path)
            if data is None:
                print(f"FALHA DOWNLOAD: {err}")
                log_path.open("a").write(f"DOWNLOAD {bucket}/{path}: {err}\n")
                falhas += 1
                continue

            ok, err = upload_object(bucket, path, data, err)
            if ok:
                print("OK")
                copiados += 1
            else:
                print(f"FALHA UPLOAD: {err}")
                log_path.open("a").write(f"UPLOAD {bucket}/{path}: {err}\n")
                falhas += 1

            # Pequena pausa para não sobrecarregar as APIs.
            time.sleep(0.05)

        print(f"  Resumo do bucket '{bucket}':")
        print(f"    Copiados: {copiados}")
        print(f"    Pulados:  {pulados}")
        print(f"    Falhas:   {falhas}")

        total_copiados += copiados
        total_pulados += pulados
        total_falhas += falhas

    print("\n" + "=" * 60)
    print(" RESUMO GERAL")
    print("=" * 60)
    print(f"Copiados: {total_copiados}")
    print(f"Pulados:  {total_pulados}")
    print(f"Falhas:   {total_falhas}")
    print(f"Log:      {LOG_FILE}")

    if total_falhas > 0:
        print("\nAVISO: houve falhas. Rode o script novamente após corrigir a causa.")
        sys.exit(1)

    print("\nMigração concluída com sucesso.")


if __name__ == "__main__":
    main()
PY

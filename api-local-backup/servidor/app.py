import os
import subprocess
import threading
import uuid
from pathlib import Path
from datetime import datetime, timezone

from flask import Flask, jsonify, request, send_file, abort
from functools import wraps

app = Flask(__name__)

BACKUP_DIR = Path(os.environ.get(
    "BACKUP_DIR",
    "/root/backups/impressaodigital"
)).resolve()

API_TOKEN = os.environ.get("BACKUP_API_TOKEN", "")

BACKUP_SCRIPT = Path(os.environ.get(
    "BACKUP_SCRIPT",
    "/root/backups/backup-impressaodigital.sh"
)).resolve()

if not API_TOKEN:
    raise RuntimeError("BACKUP_API_TOKEN não configurado")

backup_lock = threading.Lock()
backup_jobs = {}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def authenticated(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")

        if not auth.startswith("Bearer "):
            return jsonify({"error": "Não autorizado"}), 401

        token = auth[7:]

        if not token or token != API_TOKEN:
            return jsonify({"error": "Não autorizado"}), 401

        return f(*args, **kwargs)

    return wrapper


def backup_files():
    if not BACKUP_DIR.exists():
        return []

    return sorted(
        [
            p for p in BACKUP_DIR.iterdir()
            if p.is_file()
            and p.name.startswith("backup-")
            and p.name.endswith(".tar.gz")
        ],
        key=lambda p: p.stat().st_mtime,
        reverse=True
    )


def backup_job_worker(job_id, arquivos_antes):
    try:
        backup_jobs[job_id]["status"] = "EXECUTANDO"
        backup_jobs[job_id]["mensagem"] = "Gerando backup no servidor..."
        backup_jobs[job_id]["inicio"] = now_iso()

        if not BACKUP_SCRIPT.is_file():
            raise RuntimeError(
                f"Script de backup não encontrado: {BACKUP_SCRIPT}"
            )

        if not os.access(BACKUP_SCRIPT, os.X_OK):
            raise RuntimeError(
                f"Script de backup não possui permissão de execução: {BACKUP_SCRIPT}"
            )

        resultado = subprocess.run(
            ["/bin/bash", str(BACKUP_SCRIPT)],
            cwd=str(BACKUP_SCRIPT.parent),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=3600
        )

        backup_jobs[job_id]["saida"] = resultado.stdout[-10000:]

        if resultado.returncode != 0:
            raise RuntimeError(
                f"Script terminou com código {resultado.returncode}"
            )

        arquivos_depois = backup_files()

        novos = [
            p for p in arquivos_depois
            if p.name not in arquivos_antes
        ]

        if not novos:
            raise RuntimeError(
                "O backup terminou, mas nenhum arquivo novo foi encontrado."
            )

        novo = max(
            novos,
            key=lambda p: p.stat().st_mtime
        )

        backup_jobs[job_id]["status"] = "CONCLUIDO"
        backup_jobs[job_id]["mensagem"] = "Backup criado com sucesso."
        backup_jobs[job_id]["filename"] = novo.name
        backup_jobs[job_id]["tamanho_bytes"] = novo.stat().st_size
        backup_jobs[job_id]["fim"] = now_iso()

    except subprocess.TimeoutExpired:
        backup_jobs[job_id]["status"] = "ERRO"
        backup_jobs[job_id]["mensagem"] = (
            "O backup excedeu o limite máximo de 1 hora."
        )
        backup_jobs[job_id]["fim"] = now_iso()

    except Exception as e:
        backup_jobs[job_id]["status"] = "ERRO"
        backup_jobs[job_id]["mensagem"] = str(e)
        backup_jobs[job_id]["fim"] = now_iso()

    finally:
        backup_jobs[job_id]["running"] = False


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/backups")
@authenticated
def list_backups():
    backups = []

    for path in backup_files():
        stat = path.stat()

        backups.append({
            "arquivo": path.name,
            "tamanho_bytes": stat.st_size,
            "tamanho_mb": round(stat.st_size / 1024 / 1024, 2),
            "modificado_em": int(stat.st_mtime)
        })

    return jsonify({
        "total": len(backups),
        "backups": backups
    })


@app.get("/api/backups/latest")
@authenticated
def latest_backup():
    backups = backup_files()

    if not backups:
        return jsonify({
            "error": "Nenhum backup encontrado"
        }), 404

    path = backups[0]

    return send_file(
        path,
        as_attachment=True,
        download_name=path.name
    )


@app.post("/api/backups")
@authenticated
def solicitar_backup():
    with backup_lock:
        for job in backup_jobs.values():
            if job.get("running"):
                return jsonify({
                    "status": "EM_ANDAMENTO",
                    "mensagem": "Já existe um backup em andamento.",
                    "job_id": job["job_id"]
                }), 409

        arquivos_antes = {
            p.name for p in backup_files()
        }

        job_id = str(uuid.uuid4())

        backup_jobs[job_id] = {
            "job_id": job_id,
            "status": "AGUARDANDO",
            "mensagem": "Backup sendo iniciado...",
            "filename": None,
            "tamanho_bytes": None,
            "inicio": None,
            "fim": None,
            "running": True,
            "saida": "",
        }

        thread = threading.Thread(
            target=backup_job_worker,
            args=(job_id, arquivos_antes),
            daemon=True
        )
        thread.start()

    return jsonify({
        "status": "EM_ANDAMENTO",
        "mensagem": "Backup em andamento.",
        "job_id": job_id
    }), 202


@app.get("/api/backups/status/<job_id>")
@authenticated
def status_backup(job_id):
    job = backup_jobs.get(job_id)

    if not job:
        return jsonify({
            "error": "Operação de backup não encontrada."
        }), 404

    return jsonify({
        "job_id": job["job_id"],
        "status": job["status"],
        "mensagem": job["mensagem"],
        "filename": job.get("filename"),
        "tamanho_bytes": job.get("tamanho_bytes"),
        "inicio": job.get("inicio"),
        "fim": job.get("fim"),
    })


@app.get("/api/backups/<filename>/download")
@authenticated
def download_backup(filename):
    if Path(filename).name != filename:
        abort(400)

    if not filename.startswith("backup-") or not filename.endswith(".tar.gz"):
        abort(400)

    path = (BACKUP_DIR / filename).resolve()

    if path.parent != BACKUP_DIR:
        abort(403)

    if not path.is_file():
        abort(404)

    return send_file(
        path,
        as_attachment=True,
        download_name=path.name
    )


if __name__ == "__main__":
    app.run(
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "3100"))
    )

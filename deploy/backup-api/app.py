import os
import subprocess
import threading
import uuid
import json
import tempfile
import fcntl
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

JOB_DIR = Path(os.environ.get(
    "BACKUP_JOB_DIR",
    "/opt/backup-api/jobs"
)).resolve()

JOB_LOCK_FILE = JOB_DIR / ".lock"

if not API_TOKEN:
    raise RuntimeError("BACKUP_API_TOKEN não configurado")

JOB_DIR.mkdir(parents=True, exist_ok=True)

backup_lock = threading.Lock()


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def job_path(job_id):
    try:
        parsed = uuid.UUID(job_id)
    except (ValueError, AttributeError):
        return None

    if str(parsed) != job_id:
        return None

    return JOB_DIR / f"{job_id}.json"


def read_job(job_id):
    path = job_path(job_id)

    if path is None or not path.is_file():
        return None

    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None


def write_job(job):
    path = job_path(job["job_id"])

    if path is None:
        raise RuntimeError("ID de operação inválido.")

    fd, temp_name = tempfile.mkstemp(
        prefix=f".{job['job_id']}.",
        suffix=".tmp",
        dir=str(JOB_DIR)
    )

    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(job, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())

        os.replace(temp_name, path)
    finally:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass


def update_job(job_id, **changes):
    path = job_path(job_id)

    if path is None:
        raise RuntimeError("ID de operação inválido.")

    with JOB_LOCK_FILE.open("a+", encoding="utf-8") as lock_file:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)

        job = read_job(job_id)

        if job is None:
            raise RuntimeError(
                f"Operação de backup não encontrada: {job_id}"
            )

        job.update(changes)
        write_job(job)

        fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)

    return job


def find_running_job():
    try:
        paths = JOB_DIR.glob("*.json")
    except OSError:
        return None

    for path in paths:
        try:
            with path.open("r", encoding="utf-8") as f:
                job = json.load(f)

            if job.get("running") and job.get("status") in {
                "AGUARDANDO",
                "EXECUTANDO",
                "EM_ANDAMENTO",
            }:
                return job
        except (OSError, json.JSONDecodeError):
            continue

    return None


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
        update_job(
            job_id,
            status="EXECUTANDO",
            mensagem="Gerando backup no servidor...",
            inicio=now_iso()
        )

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

        update_job(
            job_id,
            saida=resultado.stdout[-10000:]
        )

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

        update_job(
            job_id,
            status="CONCLUIDO",
            mensagem="Backup criado com sucesso.",
            filename=novo.name,
            tamanho_bytes=novo.stat().st_size,
            fim=now_iso(),
            running=False
        )

    except subprocess.TimeoutExpired:
        try:
            update_job(
                job_id,
                status="ERRO",
                mensagem="O backup excedeu o limite máximo de 1 hora.",
                fim=now_iso(),
                running=False
            )
        except Exception:
            pass

    except Exception as e:
        try:
            update_job(
                job_id,
                status="ERRO",
                mensagem=str(e),
                fim=now_iso(),
                running=False
            )
        except Exception:
            pass


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
        with JOB_LOCK_FILE.open("a+", encoding="utf-8") as lock_file:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)

            job_em_andamento = find_running_job()

            if job_em_andamento:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)

                return jsonify({
                    "status": "EM_ANDAMENTO",
                    "mensagem": "Já existe um backup em andamento.",
                    "job_id": job_em_andamento["job_id"]
                }), 409

            arquivos_antes = {
                p.name for p in backup_files()
            }

            job_id = str(uuid.uuid4())

            job = {
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

            write_job(job)
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)

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
    job = read_job(job_id)

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

"""Persistência de configuração do Lojamix Sync.

Configuração não sensível fica em JSON. Segredos ficam separados e, no
Windows, protegidos pelo DPAPI com escopo de máquina. O arquivo de segredos
nunca é exibido pela API ou pela interface.
"""
from __future__ import annotations

import base64
import ctypes
import json
import os
import sys
from ctypes import wintypes
from pathlib import Path
from typing import Any

BASE_DIR = Path(os.environ.get("PROGRAMDATA", Path.home())) / "LojamixSync"
CONFIG_FILE = BASE_DIR / "config.json"
SECRETS_FILE = BASE_DIR / "secrets.dat"

DEFAULT_CONFIG: dict[str, Any] = {
    "sqlserver_host": "",
    "sqlserver_port": 1433,
    "sqlserver_database": "Lojamix",
    "sqlserver_driver": "ODBC Driver 18 for SQL Server",
    "sqlserver_timeout": 15,
    "sqlserver_encrypt": "yes",
    "sqlserver_trust_server_certificate": "yes",
    "sistema_url": "https://queiroztecno.com.br",
    "sistema_timeout": 30,
    "api_local_port": 8100,
    "sync_interval_seconds": 60,
    "lote_tamanho": 100,
    "lote_maximo_ciclos": 10,
    "revisao_bloco": 500,
    "consumidor_clientes": "api-local-loja",
    "escrita_sqlserver_habilitada": False,
    # Desligado: o fluxo de gravação de clientes no Lojamix fica inativo.
    "gravar_clientes_no_lojamix": False,
    "criar_cliente_no_lojamix": True,
    # Ligado por padrão: nada é criado no Lojamix até o operador desligar.
    "simulacao_criacao_cliente": True,
    "pendentes_bloco": 100,
}


def _ensure_dir() -> None:
    BASE_DIR.mkdir(parents=True, exist_ok=True)


def load_config() -> dict[str, Any]:
    _ensure_dir()
    if not CONFIG_FILE.exists():
        save_config(DEFAULT_CONFIG)
        return dict(DEFAULT_CONFIG)
    try:
        data = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        result = dict(DEFAULT_CONFIG)
        result.update(data if isinstance(data, dict) else {})
        return result
    except Exception:
        return dict(DEFAULT_CONFIG)


def save_config(data: dict[str, Any]) -> None:
    _ensure_dir()
    merged = dict(DEFAULT_CONFIG)
    merged.update(data)
    tmp = CONFIG_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, CONFIG_FILE)


def _dpapi_protect(raw: bytes) -> bytes:
    if sys.platform != "win32":
        raise RuntimeError("DPAPI disponível apenas no Windows.")
    class DATA_BLOB(ctypes.Structure):
        _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]
    crypt = ctypes.windll.crypt32.CryptProtectData
    local_machine = 0x4
    in_blob = DATA_BLOB(len(raw), ctypes.cast(ctypes.create_string_buffer(raw), ctypes.POINTER(ctypes.c_char)))
    out_blob = DATA_BLOB()
    if not crypt(ctypes.byref(in_blob), None, None, None, None, local_machine, ctypes.byref(out_blob)):
        raise ctypes.WinError()
    try:
        return ctypes.string_at(out_blob.pbData, out_blob.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(out_blob.pbData)


def _dpapi_unprotect(raw: bytes) -> bytes:
    if sys.platform != "win32":
        raise RuntimeError("DPAPI disponível apenas no Windows.")
    class DATA_BLOB(ctypes.Structure):
        _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]
    crypt = ctypes.windll.crypt32.CryptUnprotectData
    in_buf = ctypes.create_string_buffer(raw)
    in_blob = DATA_BLOB(len(raw), ctypes.cast(in_buf, ctypes.POINTER(ctypes.c_char)))
    out_blob = DATA_BLOB()
    if not crypt(ctypes.byref(in_blob), None, None, None, None, 0, ctypes.byref(out_blob)):
        raise ctypes.WinError()
    try:
        return ctypes.string_at(out_blob.pbData, out_blob.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(out_blob.pbData)


def load_secrets() -> dict[str, str]:
    _ensure_dir()
    if not SECRETS_FILE.exists():
        data = {
            "sqlserver_user": "",
            "sqlserver_password": "",
            "sistema_token": "",
            "api_local_token": base64.b16encode(os.urandom(32)).decode("ascii").lower(),
        }
        try:
            save_secrets(data)
        except Exception:
            pass
        return data
    try:
        raw = base64.b64decode(SECRETS_FILE.read_bytes())
        data = json.loads(_dpapi_unprotect(raw).decode("utf-8"))
        if not data.get("api_local_token"):
            data["api_local_token"] = base64.b16encode(os.urandom(32)).decode("ascii").lower()
            save_secrets(data)
        return data
    except Exception:
        return {
            "sqlserver_user": "",
            "sqlserver_password": "",
            "sistema_token": "",
            "api_local_token": base64.b16encode(os.urandom(32)).decode("ascii").lower(),
        }


def save_secrets(data: dict[str, str]) -> None:
    _ensure_dir()
    payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
    protected = _dpapi_protect(payload)
    tmp = SECRETS_FILE.with_suffix(".tmp")
    tmp.write_bytes(base64.b64encode(protected))
    os.replace(tmp, SECRETS_FILE)

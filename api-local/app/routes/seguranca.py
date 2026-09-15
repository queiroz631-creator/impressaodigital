"""Autenticação das rotas de sincronização da API local.

Somente GET /health é público. O token nunca é devolvido nem registrado.
"""

import secrets

from fastapi import Header, HTTPException

from app.config import config


async def exigir_token(x_api_token: str | None = Header(default=None)) -> None:
    esperado = config().api_local_token
    if not esperado:
        raise HTTPException(status_code=503, detail="API local sem token configurado.")
    if not x_api_token or not secrets.compare_digest(x_api_token, esperado):
        raise HTTPException(status_code=401, detail="Nao autorizado.")

"""API local da loja — ponte entre o SQL Server Lojamix e o sistema.

SQL Server Lojamix -> API local -> HTTPS + token -> Sistema

Somente GET /health é público. As rotas /api/sync/* exigem o token da API local
no header `X-API-Token`. Nenhuma resposta expõe senha, token, string de conexão
ou dados pessoais.
"""

from fastapi import FastAPI

from app.routes import reconciliar, sync_clientes, sync_notas

app = FastAPI(title="API local da loja", version="1.0.0", docs_url=None, redoc_url=None)

app.include_router(sync_notas.router)
app.include_router(sync_clientes.router)
app.include_router(reconciliar.router)


@app.get("/health")
async def health() -> dict[str, str]:
    """Estado básico. Não devolve credenciais, token nem dados de negócio."""
    return {"status": "ok"}

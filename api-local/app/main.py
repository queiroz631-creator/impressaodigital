"""Aplicação FastAPI do Lojamix Sync."""
from fastapi import FastAPI
from app.routes import reconciliar, sync_clientes, sync_notas, controle

app = FastAPI(title="Lojamix Sync", version="1.1.5", docs_url=None, redoc_url=None)
app.include_router(sync_notas.router)
app.include_router(sync_clientes.router)
app.include_router(reconciliar.router)
app.include_router(controle.router)

@app.get("/health")
async def health():
    return {"status": "ok"}

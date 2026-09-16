"""API local de controle para a interface gráfica."""
from fastapi import APIRouter, Depends
from app.routes.seguranca import exigir_token
from app.runtime import snapshot
from app.worker import SyncWorker
from app.database import disponivel
from app.services import clientes

router = APIRouter(prefix="/api/local", tags=["controle"], dependencies=[Depends(exigir_token)])
_worker: SyncWorker | None = None

def definir_worker(worker: SyncWorker) -> None:
    global _worker
    _worker = worker

@router.get("/status")
async def status():
    data = snapshot()
    data["sqlserver"] = "online" if disponivel() else "offline"
    return data

@router.post("/sync-now")
async def sync_now():
    if _worker: _worker.sync_now()
    return {"ok": True}

@router.post("/clientes-reprocessar")
async def clientes_reprocessar():
    """Zera só os marcadores de clientes (LOJA -> SISTEMA) e refaz o envio.

    Nunca altera os marcadores de notas. Recusa quando há um ciclo de clientes
    em andamento.
    """
    resultado = clientes.reprocessar()
    if resultado.get("reiniciado") and _worker:
        _worker.sync_now()
    return resultado

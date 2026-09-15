"""Rotas de sincronização de notas (loja -> sistema)."""

from fastapi import APIRouter, Depends, HTTPException

from app.database import ErroBanco
from app.routes.seguranca import exigir_token
from app.schemas.sync import CicloNotas, CicloSituacoes
from app.services import notas, sistema
from app.utils.logging import erro_seguro

router = APIRouter(prefix="/api/sync", tags=["notas"], dependencies=[Depends(exigir_token)])


def _tratar(e: BaseException) -> HTTPException:
    if isinstance(e, notas.SemSorteioAtivo):
        return HTTPException(status_code=409, detail="Nenhum sorteio ativo no momento.")
    if isinstance(e, ErroBanco):
        return HTTPException(status_code=502, detail=str(e))
    if isinstance(e, sistema.ErroSistema):
        return HTTPException(status_code=502, detail=str(e))
    return HTTPException(status_code=500, detail=erro_seguro(e))


@router.post("/notas-lote")
async def notas_lote(entrada: CicloNotas):
    """Lê as notas novas do Lojamix e envia em lotes ao sistema."""
    try:
        return notas.enviar_novas(entrada.lote, entrada.ciclos).model_dump()
    except Exception as e:  # noqa: BLE001
        raise _tratar(e) from None


@router.post("/notas-confirmar")
async def notas_confirmar(entrada: CicloNotas):
    """Reexecuta o ciclo: lotes não confirmados são reenviados de forma idempotente."""
    try:
        return notas.enviar_novas(entrada.lote, entrada.ciclos).model_dump()
    except Exception as e:  # noqa: BLE001
        raise _tratar(e) from None


@router.post("/notas-situacao")
async def notas_situacao(entrada: CicloSituacoes):
    """Revisa a faixa já enviada e comunica cancelamentos ao sistema."""
    try:
        return notas.enviar_situacoes(entrada.bloco).model_dump()
    except Exception as e:  # noqa: BLE001
        raise _tratar(e) from None

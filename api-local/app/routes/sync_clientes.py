"""Rotas de sincronização de clientes (dois sentidos)."""

from fastapi import APIRouter, Depends, HTTPException

from app.database import ErroBanco
from app.routes.seguranca import exigir_token
from app.schemas.sync import CicloClientes, ConfirmacaoClientes, LeituraClientes
from app.services import clientes, sistema
from app.utils.logging import erro_seguro

router = APIRouter(prefix="/api/sync", tags=["clientes"], dependencies=[Depends(exigir_token)])


def _tratar(e: BaseException) -> HTTPException:
    if isinstance(e, (ErroBanco, sistema.ErroSistema)):
        return HTTPException(status_code=502, detail=str(e))
    return HTTPException(status_code=500, detail=erro_seguro(e))


@router.post("/clientes-receber")
async def clientes_receber(entrada: CicloClientes):
    """Lê clientes pessoa física do Lojamix, normaliza e envia ao sistema."""
    try:
        return clientes.enviar_para_sistema(entrada.lote).model_dump()
    except Exception as e:  # noqa: BLE001
        raise _tratar(e) from None


@router.get("/clientes-alteracoes")
async def clientes_alteracoes(limite: int | None = None):
    """Alterações feitas no sistema a partir do cursor oficial (não avança o cursor)."""
    try:
        return clientes.ler_alteracoes(LeituraClientes(limite=limite).limite)
    except Exception as e:  # noqa: BLE001
        raise _tratar(e) from None


@router.post("/clientes-confirmar")
async def clientes_confirmar(entrada: ConfirmacaoClientes):
    """Confirma o cursor oficial após aplicar as alterações no SQL Server."""
    try:
        return clientes.confirmar(entrada.sequencia, entrada.erro)
    except Exception as e:  # noqa: BLE001
        raise _tratar(e) from None


@router.post("/clientes-aplicar")
async def clientes_aplicar(entrada: LeituraClientes):
    """Ciclo completo sistema -> loja: ler, aplicar no Lojamix e confirmar."""
    try:
        return clientes.aplicar_alteracoes(entrada.limite)
    except Exception as e:  # noqa: BLE001
        raise _tratar(e) from None

"""Rota de reconciliação — rede de segurança, não o caminho normal."""

from fastapi import APIRouter, Depends, HTTPException

from app.database import ErroBanco
from app.routes.seguranca import exigir_token
from app.services import clientes, notas, sistema
from app.utils.logging import erro_seguro

router = APIRouter(prefix="/api/sync", tags=["reconciliar"], dependencies=[Depends(exigir_token)])


@router.post("/reconciliar")
async def reconciliar():
    """Aciona a reconciliação do sistema e revisa pontos possivelmente presos.

    Não faz varredura completa: apenas a reconciliação do sistema (itens presos
    em processamento, erros reprocessáveis, notas pendentes com base já
    sincronizada) e uma revisão de situação da faixa já enviada.
    """
    resultado: dict[str, object] = {}
    try:
        resultado["sistema"] = sistema.chamar(sistema.RECONCILIAR)
    except sistema.ErroSistema as e:
        raise HTTPException(status_code=502, detail=str(e)) from None

    try:
        resultado["situacoes"] = notas.enviar_situacoes().model_dump()
    except notas.SemSorteioAtivo:
        resultado["situacoes"] = {"analisadas": 0}
    except (ErroBanco, sistema.ErroSistema) as e:
        resultado["situacoes"] = {"erro": str(e)}
    except Exception as e:  # noqa: BLE001
        resultado["situacoes"] = {"erro": erro_seguro(e)}

    try:
        resultado["clientes"] = clientes.aplicar_alteracoes()
    except (ErroBanco, sistema.ErroSistema) as e:
        resultado["clientes"] = {"erro": str(e)}
    except Exception as e:  # noqa: BLE001
        resultado["clientes"] = {"erro": erro_seguro(e)}

    # Revisão de elegibilidade: cliente com nota no período que só depois
    # ganhou CPF/telefone válido. Mesmos critérios do envio normal.
    try:
        resultado["clientesElegiveis"] = clientes.reconciliar_elegiveis().model_dump()
    except notas.SemSorteioAtivo:
        resultado["clientesElegiveis"] = {"lidos": 0}
    except (ErroBanco, sistema.ErroSistema) as e:
        resultado["clientesElegiveis"] = {"erro": str(e)}
    except Exception as e:  # noqa: BLE001
        resultado["clientesElegiveis"] = {"erro": erro_seguro(e)}


    return resultado

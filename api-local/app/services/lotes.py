"""Identificadores de lote/operação.

O `loteId` é a chave de idempotência do envio: reenviar o mesmo lote não cria
nada em dobro no sistema.
"""

import uuid
from datetime import datetime, timezone


def novo_lote(prefixo: str) -> str:
    marca = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    return f"{prefixo}-{marca}-{uuid.uuid4().hex[:12]}"


def lote_deterministico(prefixo: str, faixa_inicio: int, faixa_fim: int) -> str:
    """Lote reproduzível para a mesma faixa de notas: retry não duplica."""
    return f"{prefixo}-{faixa_inicio}-{faixa_fim}"

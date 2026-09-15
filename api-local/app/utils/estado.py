"""Estado local da API (marcador das notas).

Guarda o último `id_nota_fiscal` processado e o ponto da última revisão de
situação. É apenas cache/estado local: a fonte oficial dos cursores do fluxo
SUPABASE -> LOJA continua sendo `sorteio_sincronizacao_cursores` no sistema.

Gravação atômica (arquivo temporário + os.replace + fsync) para não corromper
em queda de energia ou encerramento inesperado. O arquivo pode ser apagado:
neste caso a leitura recomeça do zero, e a idempotência do sistema impede
duplicidade.
"""

import json
import os
import tempfile
from pathlib import Path
from typing import Any

from app.config import config
from app.utils.logging import logger

_PADRAO: dict[str, Any] = {
    "ultimo_id_nota": 0,
    "ultimo_id_revisado": 0,
    "ultimo_id_entidade": 0,
}



def _caminho() -> Path:
    return Path(config().estado_arquivo)


def ler() -> dict[str, Any]:
    caminho = _caminho()
    if not caminho.exists():
        return dict(_PADRAO)
    try:
        with caminho.open("r", encoding="utf-8") as arquivo:
            dados = json.load(arquivo)
        if not isinstance(dados, dict):
            raise ValueError("formato inválido")
        estado = dict(_PADRAO)
        estado.update({c: dados.get(c, _PADRAO[c]) for c in _PADRAO})
        return estado
    except Exception:
        # Arquivo corrompido não pode travar a sincronização: recomeça do zero.
        logger().warning("estado local ilegível; recomecando do inicio")
        return dict(_PADRAO)


def gravar(estado: dict[str, Any]) -> None:
    caminho = _caminho()
    caminho.parent.mkdir(parents=True, exist_ok=True)
    destino = str(caminho)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", dir=str(caminho.parent), delete=False
    ) as temporario:
        json.dump(estado, temporario, ensure_ascii=False)
        temporario.flush()
        os.fsync(temporario.fileno())
        provisorio = temporario.name
    os.replace(provisorio, destino)


def avancar(campo: str, valor: int) -> dict[str, Any]:
    """Avança um marcador — nunca retrocede."""
    estado = ler()
    if campo not in _PADRAO:
        raise ValueError("marcador desconhecido")
    estado[campo] = max(int(estado.get(campo, 0) or 0), int(valor))
    gravar(estado)
    return estado

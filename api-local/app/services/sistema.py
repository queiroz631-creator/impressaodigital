"""Cliente HTTP do sistema (nuvem).

Todas as chamadas vão para as rotas internas já existentes, autenticadas pelo
mesmo token interno (`?token=`). O token nunca aparece em log nem em resposta.
"""

from typing import Any

import httpx

from app.config import config
from app.utils.logging import erro_seguro, logger


class ErroSistema(Exception):
    """Falha ao falar com o sistema, já sanitizada."""


def _url(rota: str) -> str:
    cfg = config()
    base = cfg.sistema_url.rstrip("/")
    return f"{base}{rota}?token={cfg.sistema_token}"


def _rotulo(rota: str) -> str:
    return rota  # sem token: seguro para log


def chamar(rota: str, corpo: dict[str, Any] | None = None) -> dict[str, Any]:
    cfg = config()
    if not cfg.sistema_url or not cfg.sistema_token:
        raise ErroSistema("Integracao com o sistema nao configurada.")
    try:
        resposta = httpx.post(
            _url(rota),
            json=corpo if corpo is not None else {},
            timeout=cfg.sistema_timeout,
        )
    except httpx.HTTPError as e:
        logger().error("falha de rede em %s: %s", _rotulo(rota), erro_seguro(e))
        raise ErroSistema("Sistema indisponivel.") from None

    if resposta.status_code == 401:
        raise ErroSistema("Token interno rejeitado pelo sistema.")
    if resposta.status_code >= 400:
        # Captura o corpo para diagnosticar 400/404/409/422/500 etc.
        # O token nunca faz parte do texto da resposta e erro_seguro ainda
        # remove qualquer segredo que eventualmente apareça.
        corpo = resposta.text.strip()
        detalhe = erro_seguro(
            Exception(corpo)
        ) if corpo else "sem corpo de resposta"
        logger().error(
            "erro HTTP %s em %s: %s",
            resposta.status_code,
            _rotulo(rota),
            detalhe,
        )
        raise ErroSistema(
            f"Sistema respondeu HTTP {resposta.status_code}: {detalhe}"
        )
    try:
        dados = resposta.json()
    except ValueError:
        raise ErroSistema("Resposta invalida do sistema.") from None
    if isinstance(dados, dict) and dados.get("ok") is False:
        raise ErroSistema(str(dados.get("erro", "Erro no sistema."))[:300])
    return dados if isinstance(dados, dict) else {}


# ---- rotas do sistema (Etapas 5 e 6) ----

SORTEIO_ATIVO = "/api/public/sorteios/sync/sorteio-ativo"
NOTAS_LOTE = "/api/public/sorteios/sync/notas-lote"
NOTAS_CONFIRMAR = "/api/public/sorteios/sync/notas-confirmar"
NOTAS_SITUACAO = "/api/public/sorteios/sync/notas-situacao"
CLIENTES_RECEBER = "/api/public/sorteios/sync/clientes-receber"
CLIENTES_ALTERACOES = "/api/public/sorteios/sync/clientes-alteracoes"
CLIENTES_CONFIRMAR = "/api/public/sorteios/sync/clientes-confirmar"
RECONCILIAR = "/api/public/sorteios/reconciliar"

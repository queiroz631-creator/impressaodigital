"""Sincronização de clientes nos dois sentidos.

LOJA -> SISTEMA: normaliza os dados textuais (CAIXA ALTA, sem acentos, sem
caracteres especiais), trata os campos estruturados com regra própria e envia
somente o essencial (nome, CPF, telefone, data de nascimento, e-mail).
`id_entidade` vai como identificador permanente da origem (`origemId`).

SISTEMA -> LOJA: lê apenas as alterações após o cursor oficial, aplica no SQL
Server e só então confirma. Nada é excluído em nenhum dos sentidos.
"""

from typing import Any

from app.config import config
from app.repositories import clientes_repo
from app.schemas.sync import ResumoClientes
from app.services import sistema
from app.services.lotes import lote_deterministico
from app.utils import estado, normalizacao
from app.utils.logging import erro_seguro, logger


def _cliente_para_envio(linha: dict[str, Any]) -> dict[str, Any]:
    return {
        "origemId": str(linha["id_entidade"]),
        "nome": normalizacao.texto(linha.get("nome")) or "",
        "cpf": normalizacao.cpf(linha.get("cpf")),
        "telefone": normalizacao.digitos(linha.get("telefone")),
        "email": normalizacao.email(linha.get("email")),
        "dataNascimento": normalizacao.data_iso(linha.get("data_nascimento")),
    }


def enviar_para_sistema(lote: int | None = None) -> ResumoClientes:
    cfg = config()
    tamanho = min(lote or cfg.lote_tamanho, 500)
    resumo = ResumoClientes()

    marcador = int(estado.ler().get("ultimo_id_entidade", 0) or 0)
    linhas = clientes_repo.alterados(tamanho, marcador)
    resumo.lidos = len(linhas)
    if not linhas:
        resumo.ultimoIdEntidade = marcador
        return resumo

    clientes = [c for c in (_cliente_para_envio(l) for l in linhas) if c["nome"]]
    maior_id = max(int(l["id_entidade"]) for l in linhas)
    lote_id = lote_deterministico("clientes", marcador + 1, maior_id)

    try:
        r = sistema.chamar(
            sistema.CLIENTES_RECEBER,
            {"loteId": lote_id, "clientes": clientes},
        )
        resumo.enviados = len(clientes)
        resumo.criados = int(r.get("criados") or 0)
        resumo.atualizados = int(r.get("atualizados") or 0)
        resumo.ignorados = int(r.get("ignorados") or 0)
    except sistema.ErroSistema as e:
        resumo.erros += 1
        logger().error("clientes nao enviados: %s", erro_seguro(e))
        resumo.ultimoIdEntidade = marcador
        return resumo

    estado.avancar("ultimo_id_entidade", maior_id)
    resumo.ultimoIdEntidade = maior_id
    return resumo


def ler_alteracoes(limite: int | None = None) -> dict[str, Any]:
    """Alterações do sistema a partir do cursor oficial. O cursor não avança aqui."""
    cfg = config()
    return sistema.chamar(
        sistema.CLIENTES_ALTERACOES,
        {"consumidor": cfg.consumidor_clientes, "limite": min(limite or cfg.lote_tamanho, 500)},
    )


def confirmar(sequencia: int, erro: str | None = None) -> dict[str, Any]:
    """Confirma o cursor oficial — só depois de aplicado no SQL Server."""
    cfg = config()
    corpo: dict[str, Any] = {"consumidor": cfg.consumidor_clientes, "sequencia": sequencia}
    if erro:
        corpo["erro"] = erro[:500]
    return sistema.chamar(sistema.CLIENTES_CONFIRMAR, corpo)


def aplicar_alteracoes(limite: int | None = None) -> dict[str, Any]:
    """Ciclo SISTEMA -> LOJA: ler, aplicar, confirmar (nesta ordem).

    A alteração vem marcada com origem SUPABASE no sistema, portanto aplicar
    aqui não gera um novo evento de volta (sem loop).
    """
    dados = ler_alteracoes(limite)
    itens = dados.get("itens") or []
    if not itens:
        return {"aplicados": 0, "cursor": dados.get("cursor", 0), "erros": 0}

    aplicados = 0
    ultima_ok = int(dados.get("cursor") or 0)
    falha: str | None = None

    for item in itens:
        cliente = item.get("cliente") or {}
        origem_id = cliente.get("origem_id")
        if not origem_id:
            # Cliente criado no sistema e ainda sem referência na loja: ignora,
            # mas não bloqueia o cursor dos demais.
            ultima_ok = int(item.get("sequencia") or ultima_ok)
            continue
        try:
            clientes_repo.aplicar_alteracao(
                str(origem_id),
                normalizacao.texto(cliente.get("nome")),
                normalizacao.email(cliente.get("email")),
                normalizacao.digitos(cliente.get("telefone")),
            )
            aplicados += 1
            ultima_ok = int(item.get("sequencia") or ultima_ok)
        except Exception as e:  # noqa: BLE001 - erro já sanitizado no confirmar
            falha = erro_seguro(e)
            logger().error("falha ao aplicar cliente no Lojamix: %s", falha)
            break

    resultado = confirmar(ultima_ok, falha)
    return {
        "aplicados": aplicados,
        "cursor": resultado.get("cursor", ultima_ok),
        "erros": 1 if falha else 0,
    }

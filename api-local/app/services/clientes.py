"""Sincronização de clientes nos dois sentidos.

LOJA -> SISTEMA: só envia quem é elegível ao sorteio — pessoa física, CPF
preenchido e válido, telefone preenchido e pelo menos uma nota fiscal no
período do sorteio ativo. Normaliza os dados textuais (CAIXA ALTA, sem
acentos, sem caracteres especiais), trata os campos estruturados com regra
própria e envia somente o essencial (nome, CPF, telefone, data de nascimento,
e-mail). `id_entidade` vai como identificador permanente da origem
(`origemId`). Duas passagens:

1. cadastros novos (por `id_entidade`);
2. clientes antigos que compraram agora (por faixa de `id_nota_fiscal`), com
   marcador próprio `ultimo_id_nota_cliente` — o marcador das notas
   (`ultimo_id_nota`) nunca é lido nem alterado aqui. O limite superior da
   faixa é o maior `id_nota_fiscal` capturado UMA vez no início do ciclo;
   notas criadas depois ficam para o ciclo seguinte. Cada marcador só avança
   depois do lote aceito pelo sistema.

SISTEMA -> LOJA: lê apenas as alterações após o cursor oficial, aplica no SQL
Server e só então confirma. Nada é excluído em nenhum dos sentidos.
"""

from typing import Any

from app.config import config
from app.repositories import clientes_repo
from app.schemas.sync import ResumoClientes, SorteioAtivo
from app.services import notas, sistema
from app.services.lotes import lote_deterministico
from app.utils import estado, normalizacao
from app.utils.logging import erro_seguro, logger


def _cliente_para_envio(linha: dict[str, Any]) -> dict[str, Any]:
    return {
        "origemId": str(linha["id_entidade"]),
        "nome": normalizacao.texto(linha.get("nome")) or "",
        "cpf": normalizacao.cpf(linha.get("cpf")),
        "telefone": normalizacao.telefone(linha.get("telefone")),
        "email": normalizacao.email(linha.get("email")),
        "dataNascimento": normalizacao.data_iso(linha.get("data_nascimento")),
    }


def _elegivel(cliente: dict[str, Any]) -> bool:
    """Confere no Python o que o SQL não consegue: CPF válido, telefone e nome."""
    return bool(cliente["nome"] and cliente["cpf"] and cliente["telefone"])


def _enviar_lote(rotulo: str, linhas: list[dict[str, Any]], lote_id: str,
                 resumo: ResumoClientes) -> bool:
    """Envia um lote de elegíveis. Devolve True somente se o sistema aceitou."""
    clientes = [c for c in (_cliente_para_envio(l) for l in linhas) if _elegivel(c)]
    if not clientes:
        return True
    try:
        r = sistema.chamar(sistema.CLIENTES_RECEBER, {"loteId": lote_id, "clientes": clientes})
        resumo.enviados += len(clientes)
        resumo.criados += int(r.get("criados") or 0)
        resumo.atualizados += int(r.get("atualizados") or 0)
        resumo.ignorados += int(r.get("ignorados") or 0)
        return True
    except sistema.ErroSistema as e:
        resumo.erros += 1
        logger().error("clientes nao enviados (%s): %s", rotulo, erro_seguro(e))
        return False


def enviar_para_sistema(lote: int | None = None) -> ResumoClientes:
    cfg = config()
    tamanho = min(lote or cfg.lote_tamanho, 500)
    maximo = min(cfg.lote_maximo_ciclos, 100)
    resumo = ResumoClientes()

    sorteio = notas.sorteio_ativo()
    inicio, fim = notas.periodo_exclusivo(sorteio)

    dados = estado.ler()
    marcador_entidade = int(dados.get("ultimo_id_entidade", 0) or 0)
    desde_nota = int(dados.get("ultimo_id_nota_cliente", 0) or 0)
    # Limite da segunda passagem: capturado UMA vez, no início do ciclo.
    ate_nota = clientes_repo.maior_id_nota()

    # Passagem 1: cadastros novos elegíveis (por id_entidade).
    for _ in range(maximo):
        linhas = clientes_repo.alterados(tamanho, marcador_entidade, inicio, fim)
        if not linhas:
            break
        resumo.lidos += len(linhas)
        maior_id = max(int(l["id_entidade"]) for l in linhas)
        lote_id = lote_deterministico("clientes", marcador_entidade + 1, maior_id)
        if not _enviar_lote("cadastros", linhas, lote_id, resumo):
            resumo.ultimoIdEntidade = int(estado.ler()["ultimo_id_entidade"])
            return resumo
        estado.avancar("ultimo_id_entidade", maior_id)
        marcador_entidade = maior_id
        resumo.ultimoIdEntidade = maior_id
        if len(linhas) < tamanho:
            break

    # Passagem 2: clientes antigos que compraram agora (por id_nota_fiscal).
    while desde_nota < ate_nota:
        linhas = clientes_repo.elegiveis_por_nota(tamanho, inicio, fim, desde_nota, ate_nota)
        if not linhas:
            # Nada elegível nesta faixa: o envio é trivialmente aceito.
            estado.avancar("ultimo_id_nota_cliente", ate_nota)
            break
        resumo.lidos += len(linhas)
        menor_id = min(int(l["id_entidade"]) for l in linhas)
        maior_id = max(int(l["id_entidade"]) for l in linhas)
        lote_id = lote_deterministico("clientes-nota", desde_nota + 1, ate_nota)
        if not _enviar_lote("por-nota", linhas, lote_id, resumo):
            break
        # A faixa até ate_nota foi coberta (os que não vieram não têm nota
        # elegível na faixa), então o marcador próprio pode concluí-la.
        estado.avancar("ultimo_id_nota_cliente", ate_nota)
        desde_nota = ate_nota
        if len(linhas) < tamanho or menor_id == maior_id:
            break

    if resumo.ultimoIdEntidade == 0:
        resumo.ultimoIdEntidade = int(estado.ler()["ultimo_id_entidade"])
    return resumo


def reconciliar_elegiveis(lote: int | None = None) -> ResumoClientes:
    """Rede de segurança: cliente com nota no período que só depois ganhou
    CPF/telefone válido.

    Mesmos critérios de elegibilidade, mesmo envio idempotente — nunca
    reenvia todo mundo. Percorre a faixa de cadastros em blocos com marcador
    próprio que recicla ao chegar ao fim.
    """
    cfg = config()
    tamanho = min(lote or cfg.lote_tamanho, 500)
    resumo = ResumoClientes()

    sorteio = notas.sorteio_ativo()
    inicio, fim = notas.periodo_exclusivo(sorteio)

    dados = estado.ler()
    ate = clientes_repo.maior_id_entidade()
    desde = int(dados.get("ultimo_id_cliente_revisado", 0) or 0)
    if ate == 0:
        return resumo
    if desde >= ate:
        desde = 0  # recicla a faixa

    linhas = clientes_repo.elegiveis_por_entidade(tamanho, inicio, fim, desde, ate)
    resumo.lidos = len(linhas)

    if linhas:
        maior_id = max(int(l["id_entidade"]) for l in linhas)
        lote_id = lote_deterministico("clientes-revisao", desde + 1, maior_id)
        if _enviar_lote("revisao", linhas, lote_id, resumo):
            estado.avancar("ultimo_id_cliente_revisado", maior_id)
            resumo.ultimoIdEntidade = maior_id
        return resumo

    # Bloco sem elegíveis: avança a revisão; no fim da faixa, recicla.
    estado.avancar("ultimo_id_cliente_revisado", ate)
    resumo.ultimoIdEntidade = ate
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

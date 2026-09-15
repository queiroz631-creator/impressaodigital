"""Sincronização das notas: Lojamix -> sistema.

Fluxo por ciclo:
1. consulta o sorteio ativo UMA vez (nunca por nota);
2. lê no SQL Server as notas novas (id_nota_fiscal > último processado);
3. envia o lote;
4. confirma o lote;
5. só então avança o marcador local.

A data de emissão serve só para o período do sorteio. A identidade lógica da
nota é sorteio + numero_documento_fiscal; `origemId` (id_nota_fiscal) é apenas
referência da origem. CPF/CNPJ não participam de nada disso.
"""

from typing import Any

from app.config import config
from app.repositories import notas_repo
from app.schemas.sync import ResumoNotas, ResumoSituacoes, SorteioAtivo
from app.services import sistema
from app.services.lotes import lote_deterministico
from app.utils import estado
from app.utils.logging import erro_seguro, logger
from app.utils.normalizacao import centavos, data_iso


class SemSorteioAtivo(Exception):
    """Nada a sincronizar: nenhum sorteio ativo no momento."""


def sorteio_ativo() -> SorteioAtivo:
    """Consultado UMA vez por ciclo e repassado ao restante do processamento."""
    dados = sistema.chamar(sistema.SORTEIO_ATIVO)
    sorteio = dados.get("sorteio")
    if not sorteio:
        raise SemSorteioAtivo("Nenhum sorteio ativo no momento.")
    return SorteioAtivo.model_validate(sorteio)


def _dia_seguinte(data: str) -> str:
    from datetime import date, timedelta

    return (date.fromisoformat(data[:10]) + timedelta(days=1)).isoformat()


def periodo_exclusivo(sorteio: SorteioAtivo) -> tuple[str, str]:
    """Limites do período do sorteio: início inclusivo, fim EXCLUSIVO.

    Quando a data final vem sem horário, o limite vira o começo do dia
    seguinte — o último dia do sorteio conta inteiro.
    """
    inicio = sorteio.dataInicio or "1900-01-01"
    fim = sorteio.dataFim or "2999-12-31"
    if "T" not in fim and ":" not in fim:
        fim = _dia_seguinte(fim)
    return inicio, fim


def _periodo(sorteio: SorteioAtivo) -> tuple[str, str]:
    return periodo_exclusivo(sorteio)



def _nota_para_envio(linha: dict[str, Any]) -> dict[str, Any]:
    return {
        "numero": str(linha["numero_documento_fiscal"]).strip(),
        "valorCentavos": centavos(linha.get("valor_total")),
        "dataNota": data_iso(linha.get("data_hora_emissao")),
        "origemId": str(linha["id_nota_fiscal"]),
    }


def enviar_novas(lote: int | None = None, ciclos: int | None = None) -> ResumoNotas:
    cfg = config()
    tamanho = min(lote or cfg.lote_tamanho, 500)
    maximo = min(ciclos or cfg.lote_maximo_ciclos, 100)

    sorteio = sorteio_ativo()
    inicio, fim = _periodo(sorteio)
    resumo = ResumoNotas(sorteioId=sorteio.id)

    for _ in range(maximo):
        marcador = int(estado.ler()["ultimo_id_nota"])
        linhas = notas_repo.novas(tamanho, inicio, fim, marcador)
        if not linhas:
            break

        resumo.lidas += len(linhas)
        # Notas canceladas na origem não entram como nota nova da base.
        validas = [l for l in linhas if int(l.get("id_situacao_documento_fiscal") or 0) != 3]
        maior_id = max(int(l["id_nota_fiscal"]) for l in linhas)
        lote_id = lote_deterministico("notas", marcador + 1, maior_id)

        try:
            if validas:
                sistema.chamar(
                    sistema.NOTAS_LOTE,
                    {
                        "loteId": lote_id,
                        "sorteioId": sorteio.id,
                        "notas": [_nota_para_envio(l) for l in validas],
                    },
                )
                resumo.enviadas += len(validas)

                sistema.chamar(
                    sistema.NOTAS_CONFIRMAR,
                    {
                        "loteId": lote_id,
                        "sorteioId": sorteio.id,
                        "processadas": len(validas),
                    },
                )
                resumo.confirmadas += len(validas)
        except sistema.ErroSistema as e:
            # Sem confirmação o marcador NÃO avança: o lote será reenviado.
            resumo.erros += 1
            logger().error("lote de notas nao confirmado: %s", erro_seguro(e))
            break

        # O marcador só avança depois da confirmação do lote.
        estado.avancar("ultimo_id_nota", maior_id)
        resumo.lotes += 1
        resumo.ultimoIdNota = maior_id
        if len(linhas) < tamanho:
            break

    if resumo.ultimoIdNota == 0:
        resumo.ultimoIdNota = int(estado.ler()["ultimo_id_nota"])
    return resumo


def enviar_situacoes(bloco: int | None = None) -> ResumoSituacoes:
    """Revisa a faixa já enviada e comunica as notas canceladas.

    O marcador de revisão recicla ao chegar ao fim da faixa, então uma nota já
    sincronizada nunca fica invisível a um cancelamento posterior.
    """
    cfg = config()
    tamanho = min(bloco or cfg.revisao_bloco, 2000)

    sorteio = sorteio_ativo()
    inicio, fim = _periodo(sorteio)
    resumo = ResumoSituacoes(sorteioId=sorteio.id)

    dados = estado.ler()
    ate_id = int(dados["ultimo_id_nota"])
    desde_id = int(dados["ultimo_id_revisado"])
    if ate_id == 0:
        return resumo
    if desde_id >= ate_id:
        desde_id = 0  # recicla a faixa

    linhas = notas_repo.situacoes_alteradas(tamanho, inicio, fim, desde_id, ate_id)
    resumo.analisadas = len(linhas)

    if linhas:
        maior_id = max(int(l["id_nota_fiscal"]) for l in linhas)
        lote_id = lote_deterministico("situacao", desde_id + 1, maior_id)
        try:
            r = sistema.chamar(
                sistema.NOTAS_SITUACAO,
                {
                    "loteId": lote_id,
                    "sorteioId": sorteio.id,
                    "notas": [
                        {
                            "numero": str(l["numero_documento_fiscal"]).strip(),
                            "origemId": str(l["id_nota_fiscal"]),
                            "situacao": int(l.get("id_situacao_documento_fiscal") or 3),
                            "canceladaEm": data_iso(l.get("data_hora_cancelamento")),
                        }
                        for l in linhas
                    ],
                },
            )
            resumo.enviadas = len(linhas)
            resumo.atualizadas = int(r.get("baseAtualizadas") or 0)
            resumo.canceladas = int(r.get("notasCanceladas") or 0)
        except sistema.ErroSistema as e:
            resumo.erros += 1
            logger().error("situacoes nao aplicadas: %s", erro_seguro(e))
            resumo.ultimoIdRevisado = desde_id
            return resumo

        estado.avancar("ultimo_id_revisado", maior_id)
        resumo.ultimoIdRevisado = maior_id
        return resumo

    # Faixa inteira revisada: marca o fim para reciclar na próxima execução.
    estado.avancar("ultimo_id_revisado", ate_id)
    resumo.ultimoIdRevisado = ate_id
    return resumo

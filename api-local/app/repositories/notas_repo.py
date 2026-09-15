"""Consultas de notas fiscais no Lojamix (SQL parametrizado).

Regras absolutas:
- a nota é uma entidade independente do cliente;
- identidade lógica no sorteio: sorteio + numero_documento_fiscal;
- CPF e CNPJ nunca identificam nem validam a nota;
- data_hora_emissao serve SOMENTE para o período do sorteio;
- cursor incremental: id_nota_fiscal (nunca a data).

Somente notas de PESSOA FÍSICA entram na base do sorteio
(nota_fiscal -> entidade -> pessoa_fisica). Pessoa jurídica fica de fora.
"""

from typing import Any

from app.database import consultar

_SELECT = """
SELECT TOP (?)
       nf.id_nota_fiscal,
       nf.id_filial,
       nf.id_entidade,
       nf.id_situacao_documento_fiscal,
       nf.numero_documento_fiscal,
       nf.data_hora_emissao,
       nf.valor_total,
       nf.data_hora_cancelamento
  FROM dbo.nota_fiscal AS nf
  INNER JOIN dbo.entidade AS e
          ON e.id_entidade = nf.id_entidade
  INNER JOIN dbo.pessoa_fisica AS pf
          ON pf.id_entidade = e.id_entidade
 WHERE ISNULL(nf.registro_excluido, 0) = 0
   AND nf.data_hora_emissao >= ?
   AND nf.data_hora_emissao < ?
"""


def novas(limite: int, inicio: str, fim: str, ultimo_id: int) -> list[dict[str, Any]]:
    """Leitura incremental: id_nota_fiscal > último processado, em ordem crescente."""
    sql = _SELECT + """
   AND nf.id_nota_fiscal > ?
   AND nf.id_situacao_documento_fiscal IN (1, 3)
 ORDER BY nf.id_nota_fiscal ASC
"""
    return consultar(sql, (limite, inicio, fim, ultimo_id))


def situacoes_alteradas(
    limite: int, inicio: str, fim: str, desde_id: int, ate_id: int
) -> list[dict[str, Any]]:
    """Revisão da faixa já enviada: notas que passaram a cancelada.

    Uma nota já sincronizada nunca fica permanentemente invisível a alterações
    posteriores de situação — esta varredura recicla a faixa já processada.
    """
    sql = _SELECT + """
   AND nf.id_nota_fiscal > ?
   AND nf.id_nota_fiscal <= ?
   AND (nf.id_situacao_documento_fiscal = 3 OR nf.data_hora_cancelamento IS NOT NULL)
 ORDER BY nf.id_nota_fiscal ASC
"""
    return consultar(sql, (limite, inicio, fim, desde_id, ate_id))

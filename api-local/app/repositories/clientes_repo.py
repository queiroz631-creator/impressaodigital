"""Consultas e gravações de clientes (pessoa física) no Lojamix.

Somente pessoa física. CNPJ nunca é usado. Nada é excluído: a sincronização
apenas cria/atualiza no sistema e atualiza no Lojamix.

Regra de elegibilidade (loja -> sistema): o cliente só é enviado quando é
PESSOA FÍSICA, tem CPF preenchido, tem telefone preenchido (celular ou fone1)
e possui PELO MENOS UMA nota fiscal dentro do período do sorteio ativo. A
existência da nota usa EXISTS (nunca JOIN) para não multiplicar linhas.

Os nomes das colunas do Lojamix ficam concentrados aqui de propósito.
"""

from typing import Any

from app.database import consultar, executar

_COLUNAS = """
       e.id_entidade,
       e.nome,
       e.email_principal AS email,
       CASE
           WHEN NULLIF(LTRIM(RTRIM(e.celular_ddd)), '') IS NOT NULL
            AND NULLIF(LTRIM(RTRIM(e.celular_numero)), '') IS NOT NULL
             THEN CONCAT(LTRIM(RTRIM(e.celular_ddd)), LTRIM(RTRIM(e.celular_numero)))
           WHEN NULLIF(LTRIM(RTRIM(e.fone1_ddd)), '') IS NOT NULL
            AND NULLIF(LTRIM(RTRIM(e.fone1_numero)), '') IS NOT NULL
             THEN CONCAT(LTRIM(RTRIM(e.fone1_ddd)), LTRIM(RTRIM(e.fone1_numero)))
           WHEN NULLIF(LTRIM(RTRIM(e.celular_numero)), '') IS NOT NULL
             THEN LTRIM(RTRIM(e.celular_numero))
           WHEN NULLIF(LTRIM(RTRIM(e.fone1_numero)), '') IS NOT NULL
             THEN LTRIM(RTRIM(e.fone1_numero))
           ELSE NULL
       END AS telefone,
       pf.cpf,
       pf.data_nascimento
"""

_BASE = """
  FROM dbo.entidade AS e
  INNER JOIN dbo.pessoa_fisica AS pf
          ON pf.id_entidade = e.id_entidade
"""

# CPF e telefone preenchidos; existência de nota elegível no período.
# Parâmetros nesta ordem: inicio, fim (ambos do EXISTS).
_ELEGIBILIDADE = """
  WHERE NULLIF(LTRIM(RTRIM(pf.cpf)), '') IS NOT NULL
    AND LEN(
        COALESCE(
            CASE
                WHEN NULLIF(LTRIM(RTRIM(e.celular_ddd)), '') IS NOT NULL
                 AND NULLIF(LTRIM(RTRIM(e.celular_numero)), '') IS NOT NULL
                  THEN CONCAT(LTRIM(RTRIM(e.celular_ddd)), LTRIM(RTRIM(e.celular_numero)))
                WHEN NULLIF(LTRIM(RTRIM(e.fone1_ddd)), '') IS NOT NULL
                 AND NULLIF(LTRIM(RTRIM(e.fone1_numero)), '') IS NOT NULL
                  THEN CONCAT(LTRIM(RTRIM(e.fone1_ddd)), LTRIM(RTRIM(e.fone1_numero)))
                WHEN NULLIF(LTRIM(RTRIM(e.celular_numero)), '') IS NOT NULL
                  THEN LTRIM(RTRIM(e.celular_numero))
                WHEN NULLIF(LTRIM(RTRIM(e.fone1_numero)), '') IS NOT NULL
                  THEN LTRIM(RTRIM(e.fone1_numero))
                ELSE NULL
            END, '')) >= 8
    AND EXISTS (
        SELECT 1
          FROM dbo.nota_fiscal AS nf
         WHERE nf.id_entidade = e.id_entidade
           AND ISNULL(nf.registro_excluido, 0) = 0
           AND nf.data_hora_emissao >= ?
           AND nf.data_hora_emissao < ?
           AND nf.id_situacao_documento_fiscal IN (1, 3))
"""


def alterados(limite: int, ultimo_id: int, inicio: str, fim: str) -> list[dict[str, Any]]:
    """Primeira passagem: cadastros novos elegíveis (id_entidade > marcador)."""
    sql = (
        "SELECT TOP (?)"
        + _COLUNAS
        + _BASE
        + _ELEGIBILIDADE
        + "   AND e.id_entidade > ? ORDER BY e.id_entidade ASC"
    )
    return consultar(sql, (limite, inicio, fim, ultimo_id))


def elegiveis_por_nota(
    limite: int, inicio: str, fim: str, desde_id_nota: int, ate_id_nota: int
) -> list[dict[str, Any]]:
    """Segunda passagem: clientes (mesmo antigos) que compraram agora.

    Percorre as notas do período na faixa congelada de `id_nota_fiscal`,
    sem depender de cadastro novo. Cliente sem nota no período, sem CPF,
    sem telefone ou pessoa jurídica não aparece.
    """
    sql = (
        "SELECT TOP (?)"
        + _COLUNAS
        + _BASE
        + """
  WHERE NULLIF(LTRIM(RTRIM(pf.cpf)), '') IS NOT NULL
    AND LEN(
        COALESCE(
            CASE
                WHEN NULLIF(LTRIM(RTRIM(e.celular_ddd)), '') IS NOT NULL
                 AND NULLIF(LTRIM(RTRIM(e.celular_numero)), '') IS NOT NULL
                  THEN CONCAT(LTRIM(RTRIM(e.celular_ddd)), LTRIM(RTRIM(e.celular_numero)))
                WHEN NULLIF(LTRIM(RTRIM(e.fone1_ddd)), '') IS NOT NULL
                 AND NULLIF(LTRIM(RTRIM(e.fone1_numero)), '') IS NOT NULL
                  THEN CONCAT(LTRIM(RTRIM(e.fone1_ddd)), LTRIM(RTRIM(e.fone1_numero)))
                WHEN NULLIF(LTRIM(RTRIM(e.celular_numero)), '') IS NOT NULL
                  THEN LTRIM(RTRIM(e.celular_numero))
                WHEN NULLIF(LTRIM(RTRIM(e.fone1_numero)), '') IS NOT NULL
                  THEN LTRIM(RTRIM(e.fone1_numero))
                ELSE NULL
            END, '')) >= 8
    AND EXISTS (
        SELECT 1
          FROM dbo.nota_fiscal AS nf
         WHERE nf.id_entidade = e.id_entidade
           AND ISNULL(nf.registro_excluido, 0) = 0
           AND nf.data_hora_emissao >= ?
           AND nf.data_hora_emissao < ?
           AND nf.id_situacao_documento_fiscal IN (1, 3)
           AND nf.id_nota_fiscal > ?
           AND nf.id_nota_fiscal <= ?)
  ORDER BY e.id_entidade ASC
"""
    )
    return consultar(sql, (limite, inicio, fim, desde_id_nota, ate_id_nota))


def elegiveis_por_entidade(
    limite: int, inicio: str, fim: str, desde_id: int, ate_id: int
) -> list[dict[str, Any]]:
    """Reconciliação: revê a faixa de cadastros com os mesmos critérios.

    Cobre o caso do cliente que já tinha nota no período e só depois ganhou
    CPF/telefone válido. Não reenvia indiscriminadamente: apenas elegíveis.
    """
    sql = (
        "SELECT TOP (?)"
        + _COLUNAS
        + _BASE
        + _ELEGIBILIDADE
        + "   AND e.id_entidade > ? AND e.id_entidade <= ? ORDER BY e.id_entidade ASC"
    )
    return consultar(sql, (limite, inicio, fim, desde_id, ate_id))


def maior_id_nota() -> int:
    """Maior `id_nota_fiscal` existente — capturado uma vez por ciclo.

    Serve como limite superior da segunda passagem de clientes; nunca é o
    cursor das notas.
    """
    linhas = consultar("SELECT MAX(nf.id_nota_fiscal) AS maior FROM dbo.nota_fiscal AS nf")
    valor = linhas[0]["maior"] if linhas else None
    return int(valor or 0)


def maior_id_entidade() -> int:
    """Maior `id_entidade` existente — limite superior da reconciliação."""
    linhas = consultar("SELECT MAX(e.id_entidade) AS maior FROM dbo.entidade AS e")
    valor = linhas[0]["maior"] if linhas else None
    return int(valor or 0)


def por_origem_id(origem_id: str) -> dict[str, Any] | None:
    linhas = consultar(
        "SELECT" + _COLUNAS + _BASE + " WHERE e.id_entidade = ?",
        (origem_id,),
    )
    return linhas[0] if linhas else None


def _telefone_partes(telefone: str | None) -> tuple[str | None, str | None]:
    """Converte telefone somente-dígitos em DDD + número do Lojamix."""
    if not telefone:
        return None, None
    digitos = "".join(c for c in telefone if c.isdigit())
    if len(digitos) >= 10:
        return digitos[:2], digitos[2:]
    return None, digitos or None


def aplicar_alteracao(origem_id: str, nome: str | None, email: str | None,
                      telefone: str | None) -> int:
    """Aplica no Lojamix uma alteração originada no sistema.

    O Lojamix não possui colunas genéricas ``email``/``telefone`` na entidade:
    usa ``email_principal`` e DDD/número de celular. Sem DELETE.
    """
    ddd, numero = _telefone_partes(telefone)
    return executar(
        """
        UPDATE dbo.entidade
           SET nome = COALESCE(?, nome),
               email_principal = COALESCE(?, email_principal),
               celular_ddd = COALESCE(?, celular_ddd),
               celular_numero = COALESCE(?, celular_numero)
         WHERE id_entidade = ?
        """,
        (nome, email, ddd, numero, origem_id),
    )

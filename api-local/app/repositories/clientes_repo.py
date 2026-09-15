"""Consultas e gravações de clientes (pessoa física) no Lojamix.

Somente pessoa física. CNPJ nunca é usado. Nada é excluído: a sincronização
apenas cria/atualiza no sistema e atualiza no Lojamix.

Os nomes das colunas do Lojamix ficam concentrados aqui de propósito.
"""

from typing import Any

from app.database import consultar, executar

_SELECT = """
SELECT TOP (?)
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
  FROM dbo.entidade AS e
  INNER JOIN dbo.pessoa_fisica AS pf
          ON pf.id_entidade = e.id_entidade
 WHERE e.id_entidade > ?
 ORDER BY e.id_entidade ASC
"""


def alterados(limite: int, ultimo_id: int) -> list[dict[str, Any]]:
    """Leitura incremental por id_entidade (identificador permanente da loja)."""
    return consultar(_SELECT, (limite, ultimo_id))


def por_origem_id(origem_id: str) -> dict[str, Any] | None:
    linhas = consultar(
        """
        SELECT e.id_entidade,
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
          FROM dbo.entidade AS e
          INNER JOIN dbo.pessoa_fisica AS pf
                  ON pf.id_entidade = e.id_entidade
         WHERE e.id_entidade = ?
        """,
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

"""Consultas e gravações de clientes (pessoa física) no Lojamix.

Somente pessoa física. CNPJ nunca é usado. Nada é excluído: a sincronização
apenas cria/atualiza no sistema e atualiza no Lojamix.

Os nomes de coluna abaixo estão concentrados aqui de propósito: se o schema do
Lojamix usar outra nomenclatura para nome/telefone/e-mail da entidade, ajuste
somente este arquivo.
"""

from typing import Any

from app.database import consultar, executar

_SELECT = """
SELECT TOP (?)
       e.id_entidade,
       e.nome,
       e.email,
       e.telefone,
       pf.cpf,
       pf.data_nascimento
  FROM dbo.entidade AS e
  INNER JOIN dbo.pessoa_fisica AS pf
          ON pf.id_entidade = e.id_entidade
 WHERE ISNULL(e.registro_excluido, 0) = 0
   AND e.id_entidade > ?
 ORDER BY e.id_entidade ASC
"""


def alterados(limite: int, ultimo_id: int) -> list[dict[str, Any]]:
    """Leitura incremental por id_entidade (identificador permanente da loja)."""
    return consultar(_SELECT, (limite, ultimo_id))


def por_origem_id(origem_id: str) -> dict[str, Any] | None:
    linhas = consultar(
        """
        SELECT e.id_entidade, e.nome, pf.cpf
          FROM dbo.entidade AS e
          INNER JOIN dbo.pessoa_fisica AS pf ON pf.id_entidade = e.id_entidade
         WHERE e.id_entidade = ?
        """,
        (origem_id,),
    )
    return linhas[0] if linhas else None


def aplicar_alteracao(origem_id: str, nome: str | None, email: str | None,
                      telefone: str | None) -> int:
    """Aplica no Lojamix uma alteração originada no sistema.

    Sem DELETE. Só executa quando a escrita está habilitada por ambiente.
    """
    return executar(
        """
        UPDATE dbo.entidade
           SET nome = COALESCE(?, nome),
               email = COALESCE(?, email),
               telefone = COALESCE(?, telefone)
         WHERE id_entidade = ?
        """,
        (nome, email, telefone, origem_id),
    )

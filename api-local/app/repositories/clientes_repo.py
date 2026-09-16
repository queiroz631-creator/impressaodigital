"""Consultas e gravações de clientes configuráveis pelo usuário."""
from typing import Any
from app.database import consultar, executar
from app.sql_store import render

def alterados(limite: int, ultimo_id: int, inicio: Any, fim: Any) -> list[dict[str, Any]]:
    sql, params = render("clientes_loja_sistema", {
        "limite": limite, "ultimo_id": ultimo_id, "inicio": inicio, "fim": fim
    })
    return consultar(sql, params)

def elegiveis_por_nota(limite: int, desde_id: int, ate_id: int, inicio: Any, fim: Any) -> list[dict[str, Any]]:
    sql, params = render("clientes_por_nota", {
        "limite": limite,
        "desde_id": desde_id,
        "ate_id": ate_id,
        "inicio": inicio,
        "fim": fim,
    })
    return consultar(sql, params)


def revisar_elegiveis(limite: int, desde_id: int, inicio: Any, fim: Any) -> list[dict[str, Any]]:
    """Varredura de recuperação: elegíveis por id_entidade, sem depender de nota nova."""
    sql, params = render("clientes_revisao", {
        "limite": limite,
        "desde_id": desde_id,
        "inicio": inicio,
        "fim": fim,
    })
    return consultar(sql, params)


def maior_id_nota() -> int:
    sql, params = render("maior_id_nota", {})
    linhas = consultar(sql, params)
    return int(linhas[0]["maior_id_nota"] or 0) if linhas else 0


def por_origem_id(origem_id: str) -> dict[str, Any] | None:
    # Mantido como consulta oficial fixa de diagnóstico/compatibilidade.
    linhas = consultar(
        """SELECT e.id_entidade, e.nome, e.email_principal AS email,
                  CASE
                    WHEN NULLIF(LTRIM(RTRIM(e.celular_ddd)), '') IS NOT NULL
                     AND NULLIF(LTRIM(RTRIM(e.celular_numero)), '') IS NOT NULL
                    THEN CONCAT(LTRIM(RTRIM(e.celular_ddd)), LTRIM(RTRIM(e.celular_numero)))
                    WHEN NULLIF(LTRIM(RTRIM(e.fone1_ddd)), '') IS NOT NULL
                     AND NULLIF(LTRIM(RTRIM(e.fone1_numero)), '') IS NOT NULL
                    THEN CONCAT(LTRIM(RTRIM(e.fone1_ddd)), LTRIM(RTRIM(e.fone1_numero)))
                    ELSE NULL
                  END AS telefone,
                  pf.cpf, pf.data_nascimento
             FROM dbo.entidade AS e
             INNER JOIN dbo.pessoa_fisica AS pf ON pf.id_entidade=e.id_entidade
            WHERE e.id_entidade = ?""",
        (origem_id,),
    )
    return linhas[0] if linhas else None

def _telefone_partes(telefone: str | None) -> tuple[str | None, str | None]:
    if not telefone: return None, None
    digitos="".join(c for c in telefone if c.isdigit())
    if len(digitos)>=10: return digitos[:2],digitos[2:]
    return None,digitos or None

def aplicar_alteracao(origem_id: str, nome: str | None, email: str | None, telefone: str | None) -> int:
    ddd, numero = _telefone_partes(telefone)
    sql, params = render("cliente_aplicar_alteracao", {
        "nome": nome, "email": email, "ddd": ddd,
        "numero": numero, "origem_id": origem_id
    })
    return executar(sql, params)

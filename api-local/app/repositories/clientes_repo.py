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


def por_cpf(cpf: str) -> dict[str, Any] | None:
    """Localiza no Lojamix a Pessoa Física com o CPF informado (somente dígitos)."""
    sql, params = render("cliente_por_cpf", {"cpf": cpf})
    linhas = consultar(sql, params)
    return linhas[0] if linhas else None


def criar(nome: str, cpf: str, telefone: str | None, email: str | None, nascimento: Any) -> int:
    """Cria entidade + pessoa física em UMA transação lógica.

    Em qualquer falha: rollback completo e nada é considerado criado. Sem um
    id_entidade válido de retorno, a criação é tratada como erro.
    """
    ddd, numero = _telefone_partes(telefone)
    sql_entidade, params_entidade = render("cliente_criar_entidade", {
        "nome": nome, "email": email, "ddd": ddd, "numero": numero,
    })
    # A pessoa física depende do id gerado na entidade. O segundo passo usa um
    # marcador interno resolvido dentro da transação (abaixo).
    sql_pf, params_pf = render("cliente_criar_pessoa_fisica", {
        "id_entidade": None, "cpf": cpf, "nascimento": nascimento,
    })

    from app.database import conexao
    from app.config import config
    import pyodbc

    if not config().escrita_sqlserver_habilitada:
        raise ErroBanco("Escrita no banco da loja está desabilitada.")

    try:
        with conexao() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(sql_entidade, *params_entidade)
                id_entidade = None
                if cursor.description:
                    linha = cursor.fetchone()
                    if linha is not None:
                        id_entidade = linha[0]
                if id_entidade is None:
                    cursor.execute("SELECT CONVERT(int, SCOPE_IDENTITY())")
                    linha = cursor.fetchone()
                    id_entidade = linha[0] if linha else None
                try:
                    id_entidade = int(id_entidade)
                except (TypeError, ValueError):
                    id_entidade = 0
                if id_entidade <= 0:
                    raise ErroBanco("A criação da entidade não devolveu um identificador válido.")

                params_pf_resolvidos = tuple(id_entidade if v is None else v for v in params_pf)
                cursor.execute(sql_pf, *params_pf_resolvidos)
                conn.commit()
                return id_entidade
            except Exception:
                conn.rollback()
                raise
    except ErroBanco:
        raise
    except pyodbc.Error as e:
        from app.database import _diagnostico_sql
        detalhe = _diagnostico_sql(e)
        raise ErroBanco("Falha ao criar o cliente no banco da loja. Nada foi registrado.", detalhe) from None

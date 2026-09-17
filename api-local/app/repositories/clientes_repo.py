"""Consultas e gravações de clientes configuráveis pelo usuário."""
from datetime import date, datetime
from typing import Any
from app.database import ErroBanco, consultar, executar
from app.sql_store import render

# Padrão confirmado no cadastro feito pela própria tela do Lojamix.
_NASCIMENTO_PADRAO = date(1900, 1, 1)


def _data_nascimento(valor: Any) -> date:
    """Converte a data de nascimento em um valor de data tipado.

    A coluna do Lojamix é `datetime`: texto como '1988-01-22' seria interpretado
    conforme o idioma do SQL Server (dia/mês/ano) e estouraria o intervalo. Com
    um objeto de data o driver envia o valor tipado, sem ambiguidade.
    """
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    if isinstance(valor, str):
        texto = valor.strip()
        if texto:
            try:
                return date.fromisoformat(texto[:10])
            except ValueError:
                return _NASCIMENTO_PADRAO
    return _NASCIMENTO_PADRAO


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
    # E-mail é opcional: ausente vira '' (padrão da coluna no Lojamix), nunca
    # bloqueia a criação nem a vinculação.
    # Limites das colunas do Lojamix (evita erro de truncamento no INSERT).
    sql_entidade, params_entidade = render("cliente_criar_entidade", {
        "nome": (nome or "")[:80],
        "email": (email or "")[:100],
        "ddd": (ddd or "")[:2],
        "numero": (numero or "")[:18],
    })

    # A pessoa física depende do id gerado na entidade. O segundo passo usa um
    # marcador interno resolvido dentro da transação (abaixo).
    # Data real do sistema quando informada; quando ausente, usa o padrão
    # confirmado no cadastro feito pela própria tela do Lojamix (1900-01-01).
    nascimento_final = nascimento if nascimento else "1900-01-01"
    sql_pf, params_pf = render("cliente_criar_pessoa_fisica", {
        "id_entidade": None, "cpf": cpf, "nascimento": nascimento_final,
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

                # Confirmação determinística antes do COMMIT: exatamente UMA
                # pessoa física ligada ao id recém-criado. Não depende de
                # rowcount, que pode ser enganoso em alguns drivers.
                cursor.execute(
                    "SELECT COUNT(*) FROM dbo.pessoa_fisica WHERE id_entidade = ?",
                    id_entidade,
                )
                total_pf = int((cursor.fetchone() or [0])[0] or 0)
                if total_pf != 1:
                    raise ErroBanco(
                        "A pessoa física não foi confirmada no banco da loja. "
                        "A criação foi desfeita e nada ficou registrado."
                    )

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

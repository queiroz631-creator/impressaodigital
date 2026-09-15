"""Conexão com o SQL Server (Lojamix) via pyodbc."""
from contextlib import contextmanager
from typing import Any, Iterator, Sequence
import pyodbc
from app.config import config
from app.utils.logging import erro_seguro, logger

class ErroBanco(Exception):
    """Falha de banco com diagnóstico sanitizado para a interface."""
    def __init__(self, mensagem: str, detalhe: str | None = None):
        self.mensagem = mensagem
        self.detalhe = detalhe or mensagem
        super().__init__(self.detalhe)

@contextmanager
def conexao() -> Iterator[pyodbc.Connection]:
    cfg = config()
    if not cfg.sqlserver_host or not cfg.sqlserver_user:
        raise ErroBanco("Conexão com o SQL Server não configurada.")
    try:
        conn = pyodbc.connect(cfg.connection_string(), timeout=cfg.sqlserver_timeout)
    except pyodbc.Error as e:
        detalhe = erro_seguro(e)
        logger().error("falha ao conectar no SQL Server: %s", detalhe)
        raise ErroBanco("Não foi possível conectar ao banco da loja.", detalhe) from None
    try:
        yield conn
    finally:
        try:
            conn.close()
        except pyodbc.Error:
            pass

def _diagnostico_sql(excecao: BaseException) -> str:
    """Retorna a exceção do driver sem credenciais, para diagnóstico local."""
    detalhe = erro_seguro(excecao).strip()
    return detalhe[:1500] if detalhe else excecao.__class__.__name__

def consultar(sql: str, parametros: Sequence[Any] = ()) -> list[dict[str, Any]]:
    try:
        with conexao() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, *parametros) if parametros else cursor.execute(sql)
            colunas = [c[0] for c in cursor.description]
            return [dict(zip(colunas, linha)) for linha in cursor.fetchall()]
    except ErroBanco:
        raise
    except pyodbc.Error as e:
        detalhe = _diagnostico_sql(e)
        logger().error("falha na consulta ao SQL Server: %s", detalhe)
        raise ErroBanco(
            "Falha ao consultar o banco da loja.",
            f"Falha ao consultar o banco da loja.\n\nExceção do SQL Server/ODBC:\n{detalhe}",
        ) from None
    except Exception as e:
        detalhe = _diagnostico_sql(e)
        logger().error("erro inesperado na consulta ao SQL Server: %s", detalhe)
        raise ErroBanco(
            "Falha ao consultar o banco da loja.",
            f"Falha ao consultar o banco da loja.\n\nExceção:\n{detalhe}",
        ) from None

def executar(sql: str, parametros: Sequence[Any] = ()) -> int:
    if not config().escrita_sqlserver_habilitada:
        raise ErroBanco("Escrita no banco da loja está desabilitada.")
    try:
        with conexao() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, *parametros) if parametros else cursor.execute(sql)
            afetadas = cursor.rowcount
            conn.commit()
            return max(afetadas, 0)
    except ErroBanco:
        raise
    except pyodbc.Error as e:
        detalhe = _diagnostico_sql(e)
        logger().error("falha ao gravar no SQL Server: %s", detalhe)
        raise ErroBanco("Falha ao gravar no banco da loja.", detalhe) from None

def disponivel() -> bool:
    try:
        consultar("SELECT 1 AS ok")
        return True
    except ErroBanco:
        return False

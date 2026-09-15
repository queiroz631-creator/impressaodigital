"""Conexão com o SQL Server (Lojamix) via pyodbc.

Toda consulta é parametrizada. Nenhum erro devolvido expõe senha, usuário ou
string de conexão.
"""

from contextlib import contextmanager
from typing import Any, Iterator, Sequence

import pyodbc

from app.config import config
from app.utils.logging import erro_seguro, logger


class ErroBanco(Exception):
    """Falha de banco já sanitizada para resposta/log."""


@contextmanager
def conexao() -> Iterator[pyodbc.Connection]:
    cfg = config()
    if not cfg.sqlserver_host or not cfg.sqlserver_user:
        raise ErroBanco("Conexao com o SQL Server nao configurada.")
    try:
        conn = pyodbc.connect(cfg.connection_string(), timeout=cfg.sqlserver_timeout)
    except pyodbc.Error as e:
        logger().error("falha ao conectar no SQL Server: %s", erro_seguro(e))
        raise ErroBanco("Nao foi possivel conectar ao banco da loja.") from None
    try:
        yield conn
    finally:
        try:
            conn.close()
        except pyodbc.Error:
            pass


def consultar(sql: str, parametros: Sequence[Any] = ()) -> list[dict[str, Any]]:
    """SELECT parametrizado -> lista de dicionários."""
    try:
        with conexao() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, *parametros) if parametros else cursor.execute(sql)
            colunas = [c[0] for c in cursor.description]
            return [dict(zip(colunas, linha)) for linha in cursor.fetchall()]
    except ErroBanco:
        raise
    except pyodbc.Error as e:
        logger().error("falha na consulta ao SQL Server: %s", erro_seguro(e))
        raise ErroBanco("Falha ao consultar o banco da loja.") from None


def executar(sql: str, parametros: Sequence[Any] = ()) -> int:
    """UPDATE/INSERT parametrizado -> linhas afetadas. Nunca DELETE de cadastro."""
    if not config().escrita_sqlserver_habilitada:
        raise ErroBanco("Escrita no banco da loja esta desabilitada.")
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
        logger().error("falha ao gravar no SQL Server: %s", erro_seguro(e))
        raise ErroBanco("Falha ao gravar no banco da loja.") from None


def disponivel() -> bool:
    """Checagem leve, usada só internamente. Nunca exposta com detalhes."""
    try:
        consultar("SELECT 1 AS ok")
        return True
    except ErroBanco:
        return False

"""Log operacional seguro.

Nunca registrar: senha do SQL Server, string de conexão, tokens, CPF completo,
telefone completo ou dados pessoais desnecessários.
"""

import logging

from app.config import config

_CONFIGURADO = False


def logger(nome: str = "api-local") -> logging.Logger:
    global _CONFIGURADO
    if not _CONFIGURADO:
        logging.basicConfig(
            level=getattr(logging, config().log_nivel.upper(), logging.INFO),
            format="%(asctime)s %(levelname)s %(name)s %(message)s",
        )
        _CONFIGURADO = True
    return logging.getLogger(nome)


def mascarar_documento(valor: str | None) -> str:
    """CPF/CNPJ só pelos últimos dígitos — nunca completo em log."""
    digitos = "".join(c for c in (valor or "") if c.isdigit())
    if not digitos:
        return "***"
    return f"***{digitos[-3:]}"


def erro_seguro(excecao: BaseException) -> str:
    """Resumo do erro sem credenciais nem string de conexão."""
    texto = str(excecao)
    cfg = config()
    for segredo in (cfg.sqlserver_password, cfg.sistema_token, cfg.api_local_token):
        if segredo:
            texto = texto.replace(segredo, "***")
    return texto[:500]

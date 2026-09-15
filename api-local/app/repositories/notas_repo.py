"""Consultas de notas fiscais configuráveis pelo usuário."""
from typing import Any
from app.database import consultar
from app.sql_store import render

def novas(limite: int, inicio: Any, fim: Any, ultimo_id: int) -> list[dict[str, Any]]:
    sql, params = render("notas_novas", {
        "limite": limite, "inicio": inicio, "fim": fim, "ultimo_id": ultimo_id
    })
    return consultar(sql, params)

def situacoes_alteradas(limite: int, inicio: Any, fim: Any, desde_id: int, ate_id: int) -> list[dict[str, Any]]:
    sql, params = render("notas_situacoes", {
        "limite": limite, "inicio": inicio, "fim": fim,
        "desde_id": desde_id, "ate_id": ate_id
    })
    return consultar(sql, params)

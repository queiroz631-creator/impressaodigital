"""Armazenamento das consultas SQL oficiais/personalizadas do Lojamix Sync.

As consultas ficam em %PROGRAMDATA%\\LojamixSync\\sql.json.
Os segredos continuam separados em secrets.dat.

Placeholders obrigatórios são substituídos por parâmetros ODBC (?) em ordem,
portanto valores nunca são interpolados diretamente no SQL.
"""
from __future__ import annotations
import json, os, re
from pathlib import Path
from typing import Any

from app.settings_store import BASE_DIR
from app.utils.logging import logger

SQL_FILE = BASE_DIR / "sql.json"

DEFAULTS: dict[str, dict[str, Any]] = {
    "notas_novas": {
        "nome": "Notas novas",
        "tipo": "select",
        "descricao": "Notas fiscais novas do período do sorteio. Somente Pessoa Física.",
        "placeholders": ["limite", "inicio", "fim", "ultimo_id"],
        "sql": """SELECT TOP ({{limite}})
       nf.id_nota_fiscal,
       nf.id_filial,
       nf.id_entidade,
       nf.id_situacao_documento_fiscal,
       nf.numero_documento_fiscal,
       nf.data_hora_emissao,
       nf.valor_total,
       nf.data_hora_cancelamento
  FROM dbo.nota_fiscal AS nf
  INNER JOIN dbo.entidade AS e
          ON e.id_entidade = nf.id_entidade
  INNER JOIN dbo.pessoa_fisica AS pf
          ON pf.id_entidade = e.id_entidade
 WHERE ISNULL(nf.registro_excluido, 0) = 0
   AND nf.data_hora_emissao >= {{inicio}}
   AND nf.data_hora_emissao < {{fim}}
   AND nf.id_nota_fiscal > {{ultimo_id}}
   AND nf.id_situacao_documento_fiscal IN (1, 3)
 ORDER BY nf.id_nota_fiscal ASC""",
    },
    "notas_situacoes": {
        "nome": "Revisão de cancelamentos",
        "tipo": "select",
        "descricao": "Revisa notas já enviadas para detectar cancelamentos posteriores.",
        "placeholders": ["limite", "inicio", "fim", "desde_id", "ate_id"],
        "sql": """SELECT TOP ({{limite}})
       nf.id_nota_fiscal,
       nf.id_filial,
       nf.id_entidade,
       nf.id_situacao_documento_fiscal,
       nf.numero_documento_fiscal,
       nf.data_hora_emissao,
       nf.valor_total,
       nf.data_hora_cancelamento
  FROM dbo.nota_fiscal AS nf
  INNER JOIN dbo.entidade AS e
          ON e.id_entidade = nf.id_entidade
  INNER JOIN dbo.pessoa_fisica AS pf
          ON pf.id_entidade = e.id_entidade
 WHERE ISNULL(nf.registro_excluido, 0) = 0
   AND nf.data_hora_emissao >= {{inicio}}
   AND nf.data_hora_emissao < {{fim}}
   AND nf.id_nota_fiscal > {{desde_id}}
   AND nf.id_nota_fiscal <= {{ate_id}}
   AND (nf.id_situacao_documento_fiscal = 3 OR nf.data_hora_cancelamento IS NOT NULL)
 ORDER BY nf.id_nota_fiscal ASC""",
    },
    "clientes_loja_sistema": {
        "nome": "Clientes Lojamix → Sistema",
        "tipo": "select",
        "descricao": "Clientes Pessoa Física enviados do Lojamix para o sistema.",
        "placeholders": ["limite", "ultimo_id", "inicio", "fim"],
        "sql": """SELECT TOP ({{limite}})
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
 WHERE e.id_entidade > {{ultimo_id}}
   AND NULLIF(LTRIM(RTRIM(pf.cpf)), '') IS NOT NULL
   AND LEN(REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(pf.cpf)), '.', ''), '-', ''), '/', ''), ' ', '')) = 11
   AND EXISTS (
       SELECT 1
         FROM dbo.nota_fiscal AS nf
        WHERE nf.id_entidade = e.id_entidade
          AND ISNULL(nf.registro_excluido, 0) = 0
          AND nf.data_hora_emissao >= {{inicio}}
          AND nf.data_hora_emissao < {{fim}}
   )
   AND (
       (
           NULLIF(LTRIM(RTRIM(e.celular_ddd)), '') IS NOT NULL
           AND NULLIF(LTRIM(RTRIM(e.celular_numero)), '') IS NOT NULL
           AND LEN(REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(LTRIM(RTRIM(e.celular_ddd)), LTRIM(RTRIM(e.celular_numero))), '(', ''), ')', ''), '-', ''), ' ', '')) >= 10
       )
       OR
       (
           NULLIF(LTRIM(RTRIM(e.fone1_ddd)), '') IS NOT NULL
           AND NULLIF(LTRIM(RTRIM(e.fone1_numero)), '') IS NOT NULL
           AND LEN(REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(LTRIM(RTRIM(e.fone1_ddd)), LTRIM(RTRIM(e.fone1_numero))), '(', ''), ')', ''), '-', ''), ' ', '')) >= 10
       )
       OR LEN(REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(e.celular_numero)), '(', ''), ')', ''), '-', ''), ' ', '')) >= 10
       OR LEN(REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(e.fone1_numero)), '(', ''), ')', ''), '-', ''), ' ', '')) >= 10
   )
 ORDER BY e.id_entidade ASC""",
    },
    "clientes_por_nota": {
        "nome": "Clientes por novas notas",
        "tipo": "select",
        "descricao": "Clientes Pessoa Física elegíveis por novas notas do período do sorteio. Captura clientes antigos que fizeram nova compra.",
        "placeholders": ["inicio", "fim", "desde_id", "ate_id", "limite"],
        "sql": """WITH Elegiveis AS (
    SELECT
       nf.id_nota_fiscal,
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
       pf.data_nascimento,
       ROW_NUMBER() OVER (PARTITION BY e.id_entidade ORDER BY nf.id_nota_fiscal DESC) AS rn
  FROM dbo.nota_fiscal AS nf
  INNER JOIN dbo.entidade AS e
          ON e.id_entidade = nf.id_entidade
  INNER JOIN dbo.pessoa_fisica AS pf
          ON pf.id_entidade = e.id_entidade
 WHERE ISNULL(nf.registro_excluido, 0) = 0
   AND nf.data_hora_emissao >= {{inicio}}
   AND nf.data_hora_emissao < {{fim}}
   AND nf.id_nota_fiscal > {{desde_id}}
   AND nf.id_nota_fiscal <= {{ate_id}}
   AND nf.id_situacao_documento_fiscal IN (1, 3)
   AND NULLIF(LTRIM(RTRIM(pf.cpf)), '') IS NOT NULL
   AND LEN(REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(pf.cpf)), '.', ''), '-', ''), '/', ''), ' ', '')) = 11
   AND (
       (NULLIF(LTRIM(RTRIM(e.celular_ddd)), '') IS NOT NULL
        AND NULLIF(LTRIM(RTRIM(e.celular_numero)), '') IS NOT NULL
        AND LEN(REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(LTRIM(RTRIM(e.celular_ddd)), LTRIM(RTRIM(e.celular_numero))), '(', ''), ')', ''), '-', ''), ' ', '')) >= 10)
       OR
       (NULLIF(LTRIM(RTRIM(e.fone1_ddd)), '') IS NOT NULL
        AND NULLIF(LTRIM(RTRIM(e.fone1_numero)), '') IS NOT NULL
        AND LEN(REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(LTRIM(RTRIM(e.fone1_ddd)), LTRIM(RTRIM(e.fone1_numero))), '(', ''), ')', ''), '-', ''), ' ', '')) >= 10)
       OR LEN(REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(e.celular_numero)), '(', ''), ')', ''), '-', ''), ' ', '')) >= 10
       OR LEN(REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(e.fone1_numero)), '(', ''), ')', ''), '-', ''), ' ', '')) >= 10
   )
)
SELECT TOP ({{limite}})
       id_nota_fiscal,
       id_entidade,
       nome,
       email,
       telefone,
       cpf,
       data_nascimento
  FROM Elegiveis
 WHERE rn = 1
 ORDER BY id_nota_fiscal ASC""",
    },
    "clientes_revisao": {
        "nome": "Revisão de clientes elegíveis",
        "tipo": "select",
        "descricao": "Varredura de recuperação: clientes Pessoa Física elegíveis (CPF válido, telefone e nota no período), paginada por id_entidade.",
        "placeholders": ["limite", "desde_id", "inicio", "fim"],
        "sql": """SELECT TOP ({{limite}})
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
 WHERE e.id_entidade > {{desde_id}}
   AND NULLIF(LTRIM(RTRIM(pf.cpf)), '') IS NOT NULL
   AND LEN(REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(pf.cpf)), '.', ''), '-', ''), '/', ''), ' ', '')) = 11
   AND EXISTS (
       SELECT 1
         FROM dbo.nota_fiscal AS nf
        WHERE nf.id_entidade = e.id_entidade
          AND ISNULL(nf.registro_excluido, 0) = 0
          AND nf.data_hora_emissao >= {{inicio}}
          AND nf.data_hora_emissao < {{fim}}
          AND nf.id_situacao_documento_fiscal IN (1, 3)
   )
   AND (
       (NULLIF(LTRIM(RTRIM(e.celular_ddd)), '') IS NOT NULL
        AND NULLIF(LTRIM(RTRIM(e.celular_numero)), '') IS NOT NULL
        AND LEN(REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(LTRIM(RTRIM(e.celular_ddd)), LTRIM(RTRIM(e.celular_numero))), '(', ''), ')', ''), '-', ''), ' ', '')) >= 10)
       OR
       (NULLIF(LTRIM(RTRIM(e.fone1_ddd)), '') IS NOT NULL
        AND NULLIF(LTRIM(RTRIM(e.fone1_numero)), '') IS NOT NULL
        AND LEN(REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(LTRIM(RTRIM(e.fone1_ddd)), LTRIM(RTRIM(e.fone1_numero))), '(', ''), ')', ''), '-', ''), ' ', '')) >= 10)
       OR LEN(REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(e.celular_numero)), '(', ''), ')', ''), '-', ''), ' ', '')) >= 10
       OR LEN(REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(e.fone1_numero)), '(', ''), ')', ''), '-', ''), ' ', '')) >= 10
   )
 ORDER BY e.id_entidade ASC""",
    },
    "maior_id_nota": {
        "nome": "Maior ID de nota",
        "tipo": "select",
        "descricao": "Obtém uma fotografia do maior id_nota_fiscal para fixar o limite do ciclo de clientes.",
        "placeholders": [],
        "sql": """SELECT ISNULL(MAX(id_nota_fiscal), 0) AS maior_id_nota
  FROM dbo.nota_fiscal""",
    },
    "cliente_aplicar_alteracao": {
        "nome": "Cliente Sistema → Lojamix",
        "tipo": "update",
        "descricao": "Aplica alteração de cliente no Lojamix pelo id_entidade de origem.",
        "placeholders": ["nome", "email", "ddd", "numero", "origem_id"],
        "sql": """UPDATE dbo.entidade
   SET nome = COALESCE({{nome}}, nome),
       email_principal = COALESCE({{email}}, email_principal),
       celular_ddd = COALESCE({{ddd}}, celular_ddd),
       celular_numero = COALESCE({{numero}}, celular_numero)
 WHERE id_entidade = {{origem_id}}""",
    },
}

READ_KEYS = {"notas_novas", "notas_situacoes", "clientes_loja_sistema", "clientes_por_nota", "clientes_revisao", "maior_id_nota"}
WRITE_KEYS = {"cliente_aplicar_alteracao"}

def _ensure() -> None:
    BASE_DIR.mkdir(parents=True, exist_ok=True)

def load_all() -> dict[str, dict[str, Any]]:
    _ensure()
    data: dict[str, dict[str, Any]] = {}
    if SQL_FILE.exists():
        try:
            raw=json.loads(SQL_FILE.read_text(encoding="utf-8"))
            if isinstance(raw,dict):
                data=raw
        except Exception:
            logger().warning("arquivo de SQL personalizado ilegível; usando padrões")
    result={}
    for key, default in DEFAULTS.items():
        item=dict(default)
        custom=data.get(key)
        if isinstance(custom,dict) and isinstance(custom.get("sql"),str):
            item["sql"]=custom["sql"]
            item["personalizado"]=True
        else:
            item["personalizado"]=False
        result[key]=item
    return result

def get(key: str) -> dict[str, Any]:
    data=load_all()
    if key not in data:
        raise KeyError(key)
    return data[key]

def save(key: str, sql: str) -> None:
    if key not in DEFAULTS:
        raise KeyError(key)
    validate(key, sql)
    _ensure()
    current={}
    if SQL_FILE.exists():
        try:
            raw=json.loads(SQL_FILE.read_text(encoding="utf-8"))
            if isinstance(raw,dict): current=raw
        except Exception:
            current={}
    current[key]={"sql":sql}
    tmp=SQL_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(current,ensure_ascii=False,indent=2),encoding="utf-8")
    os.replace(tmp,SQL_FILE)

def reset(key: str) -> None:
    if key not in DEFAULTS: raise KeyError(key)
    _ensure()
    current={}
    if SQL_FILE.exists():
        try:
            raw=json.loads(SQL_FILE.read_text(encoding="utf-8"))
            if isinstance(raw,dict): current=raw
        except Exception: current={}
    current.pop(key,None)
    tmp=SQL_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(current,ensure_ascii=False,indent=2),encoding="utf-8")
    os.replace(tmp,SQL_FILE)

def validate(key: str, sql: str) -> None:
    if not isinstance(sql,str) or not sql.strip():
        raise ValueError("A consulta SQL não pode ficar vazia.")
    item=DEFAULTS[key]
    for ph in item["placeholders"]:
        if "{{"+ph+"}}" not in sql:
            raise ValueError(f"Falta o marcador obrigatório: {{{{{ph}}}}}")
    # Prevent accidental mixing of unknown template variables.
    encontrados=re.findall(r"\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}",sql)
    permitidos=set(item["placeholders"])
    desconhecidos=[x for x in encontrados if x not in permitidos]
    if desconhecidos:
        raise ValueError("Marcador(es) desconhecido(s): "+", ".join(sorted(set(desconhecidos))))
    if key in READ_KEYS:
        inicio=sql.lstrip().upper()
        if not (inicio.startswith("SELECT") or inicio.startswith("WITH")):
            raise ValueError("Esta consulta é de leitura e deve começar com SELECT ou WITH.")
        proibidos=("INSERT ","UPDATE ","DELETE ","DROP ","ALTER ","TRUNCATE ","MERGE ")
        if any(x in inicio for x in proibidos):
            raise ValueError("Consulta de leitura não pode conter comandos de alteração.")
    if key in WRITE_KEYS:
        if not sql.lstrip().upper().startswith(("UPDATE","INSERT","MERGE")):
            raise ValueError("Esta consulta de gravação deve começar com UPDATE, INSERT ou MERGE.")
    if len(sql)>50000:
        raise ValueError("Consulta SQL excede o limite de 50.000 caracteres.")

def render(key: str, values: dict[str, Any]) -> tuple[str, tuple[Any,...]]:
    item=get(key)
    sql=item["sql"]
    params=[]
    for ph in item["placeholders"]:
        marker="{{"+ph+"}}"
        if marker not in sql:
            raise ValueError(f"Falta o marcador obrigatório: {marker}")
        sql=sql.replace(marker,"?",1)
        params.append(values.get(ph))
    validate(key, item["sql"])
    return sql, tuple(params)

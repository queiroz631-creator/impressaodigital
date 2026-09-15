"""Normalização dos dados de clientes vindos do Lojamix.

Texto de cadastro (nome, logradouro, bairro, complemento, cidade, observação,
contato): CAIXA ALTA, SEM ACENTOS, SEM CARACTERES ESPECIAIS.

Campos estruturados (CPF, telefone, CEP, e-mail, datas, IDs, valores) NÃO
seguem essa regra: cada um tem tratamento próprio.
"""

import re
import unicodedata
from datetime import date, datetime
from decimal import Decimal

_PERMITIDOS = re.compile(r"[^A-Z0-9 ]")
_ESPACOS = re.compile(r"\s+")


def texto(valor: str | None) -> str | None:
    """JOAO DA SILVA, MARIA DAVILA, SAO JOSE."""
    if valor is None:
        return None
    sem_acento = unicodedata.normalize("NFKD", valor)
    sem_acento = "".join(c for c in sem_acento if not unicodedata.combining(c))
    limpo = _PERMITIDOS.sub("", sem_acento.upper())
    limpo = _ESPACOS.sub(" ", limpo).strip()
    return limpo or None


def digitos(valor: str | None) -> str | None:
    """CPF, telefone e CEP: somente dígitos (123.456.789-00 -> 12345678900)."""
    if valor is None:
        return None
    d = "".join(c for c in valor if c.isdigit())
    return d or None


def cpf(valor: str | None) -> str | None:
    d = digitos(valor)
    return d if d and len(d) == 11 else None


def email(valor: str | None) -> str | None:
    """E-mail: apenas minúsculas e espaços removidos — nunca a regra de texto."""
    if valor is None:
        return None
    limpo = valor.strip().lower()
    return limpo if "@" in limpo and len(limpo) <= 320 else None


def centavos(valor: Decimal | float | int | None) -> int:
    """R$ 20,00 -> 2000. Arredondamento em dinheiro sempre em centavos."""
    if valor is None:
        return 0
    return int((Decimal(str(valor)) * 100).quantize(Decimal("1")))


def data_iso(valor: datetime | date | None) -> str | None:
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return valor.isoformat()
    return valor.isoformat()

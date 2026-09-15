"""Modelos de entrada/saída da API local (validação Pydantic)."""

from pydantic import BaseModel, Field


class CicloNotas(BaseModel):
    """Ciclo de envio de notas novas."""

    lote: int | None = Field(default=None, ge=1, le=500)
    ciclos: int | None = Field(default=None, ge=1, le=100)


class CicloSituacoes(BaseModel):
    """Revisão de situação (cancelamentos) da faixa já enviada."""

    bloco: int | None = Field(default=None, ge=1, le=2000)


class CicloClientes(BaseModel):
    lote: int | None = Field(default=None, ge=1, le=500)


class LeituraClientes(BaseModel):
    limite: int | None = Field(default=None, ge=1, le=500)


class ConfirmacaoClientes(BaseModel):
    sequencia: int = Field(ge=0)
    erro: str | None = Field(default=None, max_length=500)


class SorteioAtivo(BaseModel):
    id: str
    numeroSorteio: int
    dataInicio: str | None = None
    dataFim: str | None = None


class ResumoNotas(BaseModel):
    sorteioId: str | None = None
    lidas: int = 0
    enviadas: int = 0
    confirmadas: int = 0
    lotes: int = 0
    ultimoIdNota: int = 0
    erros: int = 0
    erroDetalhe: str | None = None


class ResumoSituacoes(BaseModel):
    sorteioId: str | None = None
    analisadas: int = 0
    enviadas: int = 0
    atualizadas: int = 0
    canceladas: int = 0
    ultimoIdRevisado: int = 0
    erros: int = 0
    erroDetalhe: str | None = None


class ResumoClientes(BaseModel):
    lidos: int = 0
    enviados: int = 0
    criados: int = 0
    atualizados: int = 0
    ignorados: int = 0
    ultimoIdEntidade: int = 0
    ultimoIdNotaCliente: int = 0
    erros: int = 0
    erroDetalhe: str | None = None

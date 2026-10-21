import type { ErroProvedor, ProvedorId, Resultado } from "./tipos";

/** Erro padronizado para operações que o provedor não oferece. Nunca finge sucesso. */
export function erroNaoSuportado(provedor: ProvedorId | string, operacao: string, detalhe?: string): ErroProvedor {
  return {
    codigo: "nao_suportado",
    mensagem: detalhe ?? `Operação "${operacao}" não é suportada pelo provedor ${provedor}.`,
    httpStatus: null,
    retentavel: false,
  };
}

export function falhaNaoSuportada(provedor: ProvedorId | string, operacao: string, detalhe?: string): Resultado<never> {
  return { ok: false, erro: erroNaoSuportado(provedor, operacao, detalhe) };
}

/**
 * Classifica uma falha HTTP/rede em um código padronizado.
 * `status` 0 = sem resposta (rede, timeout ou credenciais ausentes).
 */
export function classificarFalha(status: number, mensagem: string | null | undefined): ErroProvedor {
  const texto = (mensagem ?? "").trim() || "Falha na comunicação com o provedor.";

  if (status === 0) {
    if (/credenciais?.*n[aã]o configurad/i.test(texto) || /n[aã]o configurad/i.test(texto)) {
      return { codigo: "nao_configurado", mensagem: texto, httpStatus: null, retentavel: false };
    }
    if (/timeout|timed out|aborted|abort|esgotad/i.test(texto)) {
      return { codigo: "timeout", mensagem: texto, httpStatus: null, retentavel: true };
    }
    return { codigo: "rede", mensagem: texto, httpStatus: null, retentavel: true };
  }
  if (status === 401 || status === 403) {
    return { codigo: "nao_autenticado", mensagem: texto, httpStatus: status, retentavel: false };
  }
  if (status === 404) {
    return { codigo: "nao_encontrado", mensagem: texto, httpStatus: status, retentavel: false };
  }
  if (status === 408) {
    return { codigo: "timeout", mensagem: texto, httpStatus: status, retentavel: true };
  }
  if (status === 429) {
    return { codigo: "rate_limit", mensagem: texto, httpStatus: status, retentavel: true };
  }
  if (status >= 500) {
    return { codigo: "servidor", mensagem: texto, httpStatus: status, retentavel: true };
  }
  if (status >= 400) {
    return { codigo: "invalido", mensagem: texto, httpStatus: status, retentavel: false };
  }
  return { codigo: "desconhecido", mensagem: texto, httpStatus: status, retentavel: false };
}

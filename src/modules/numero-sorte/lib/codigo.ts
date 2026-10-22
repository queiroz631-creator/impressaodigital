/**
 * Formato do número da sorte: [número da campanha] + [5 dígitos de sufixo].
 * A geração acontece só no banco; aqui ficam montagem/leitura para exibição e validação.
 */
export const DIGITOS_SUFIXO = 5;
export const CAPACIDADE_CAMPANHA = 100_000;

export function montarCodigo(numeroCampanha: number, sufixo: number): string {
  if (!Number.isInteger(numeroCampanha) || numeroCampanha < 1) throw new Error("Campanha inválida");
  if (!Number.isInteger(sufixo) || sufixo < 0 || sufixo >= CAPACIDADE_CAMPANHA)
    throw new Error("Sufixo inválido");
  return `${numeroCampanha}${String(sufixo).padStart(DIGITOS_SUFIXO, "0")}`;
}

/** Separa campanha e sufixo; null se o texto não for um código válido. */
export function decomporCodigo(codigo: string): { campanha: number; sufixo: string } | null {
  const limpo = codigo.trim();
  if (!/^[1-9]\d{5,}$/.test(limpo)) return null;
  return {
    campanha: Number(limpo.slice(0, -DIGITOS_SUFIXO)),
    sufixo: limpo.slice(-DIGITOS_SUFIXO),
  };
}

export type SituacaoCampanha = "rascunho" | "programada" | "ativa" | "suspensa" | "encerrada";

export const ROTULO_SITUACAO: Record<SituacaoCampanha, string> = {
  rascunho: "Rascunho",
  programada: "Programada",
  ativa: "Ativa",
  suspensa: "Suspensa",
  encerrada: "Encerrada",
};

/** Transições permitidas da campanha (encerrada é definitiva). */
const TRANSICOES: Record<SituacaoCampanha, SituacaoCampanha[]> = {
  rascunho: ["programada", "ativa", "encerrada"],
  programada: ["rascunho", "ativa", "suspensa", "encerrada"],
  ativa: ["suspensa", "encerrada"],
  suspensa: ["ativa", "encerrada"],
  encerrada: [],
};

export function proximasSituacoes(atual: SituacaoCampanha): SituacaoCampanha[] {
  return TRANSICOES[atual];
}

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

/** Limite padrão de consultas por cliente quando a campanha não define um. */
export const LIMITE_PADRAO_CONSULTAS = 10;

/** Só dígitos; verdadeiro quando o código tem o prefixo da campanha + 5 dígitos. */
export function codigoPertenceCampanha(codigo: string, numeroCampanha: number): boolean {
  const d = decomporCodigo(codigo);
  return !!d && d.campanha === numeroCampanha;
}

/** Lê um número completo do intervalo ("1200000") e devolve o sufixo, validando o prefixo. */
export function sufixoDoLimite(texto: string, numeroCampanha: number): number {
  const limpo = texto.trim();
  const prefixo = String(numeroCampanha);
  if (!/^\d+$/.test(limpo) || limpo.length !== prefixo.length + DIGITOS_SUFIXO || !limpo.startsWith(prefixo))
    throw new Error(`O número deve começar com ${prefixo} e ter exatamente 5 dígitos depois dele.`);
  return Number(limpo.slice(-DIGITOS_SUFIXO));
}

export function capacidadeIntervalo(inicial: number, final: number): number {
  return final - inicial + 1;
}

/** Valida um intervalo de sufixos; com números gerados, só aceita ampliação do final. */
export function validarIntervalo(
  atual: { inicial: number; final: number },
  novo: { inicial: number; final: number },
  temNumeros: boolean,
): string | null {
  if (novo.inicial < 0 || novo.final > CAPACIDADE_CAMPANHA - 1) return "Intervalo fora do limite do prefixo.";
  if (novo.inicial > novo.final) return "O número inicial deve ser menor ou igual ao final.";
  if (temNumeros) {
    if (novo.inicial !== atual.inicial) return "Com números gerados, o número inicial não pode mudar.";
    if (novo.final < atual.final) return "Com números gerados, o intervalo só pode ser ampliado.";
  }
  return null;
}

/** Verdadeiro quando cabem `quantidade` novos números no intervalo. */
export function cabeNoIntervalo(inicial: number, final: number, usados: number, quantidade: number): boolean {
  return usados + quantidade <= capacidadeIntervalo(inicial, final);
}

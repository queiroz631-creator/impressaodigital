import type { Qualidade } from "../types";

export interface EntradaQualidade {
  larguraPx: number;
  alturaPx: number;
  larguraCm?: number | null;
  alturaCm?: number | null;
  orientacao?: string;
  zoom?: number;
  crop?: { largura: number; altura: number } | null;
}

export function calcularQualidadeFoto(entrada: EntradaQualidade): { qualidade: Qualidade; dpi: number | null } {
  if (!entrada.larguraCm || !entrada.alturaCm) return { qualidade: "SEM_FORMATO", dpi: null };
  const paisagem = entrada.orientacao === "PAISAGEM";
  const larguraCm = paisagem ? entrada.alturaCm : entrada.larguraCm;
  const alturaCm = paisagem ? entrada.larguraCm : entrada.alturaCm;
  // zoom e crop serão incorporados aqui na etapa do editor não destrutivo.
  const dpi = Math.floor(Math.min(entrada.larguraPx / (larguraCm / 2.54), entrada.alturaPx / (alturaCm / 2.54)));
  if (dpi >= 300) return { qualidade: "EXCELENTE", dpi };
  if (dpi >= 220) return { qualidade: "BOA", dpi };
  if (dpi >= 150) return { qualidade: "BAIXA", dpi };
  return { qualidade: "MUITO_BAIXA", dpi };
}

export const ROTULO_QUALIDADE: Record<Qualidade, string> = {
  EXCELENTE: "Qualidade excelente",
  BOA: "Qualidade boa",
  BAIXA: "Qualidade baixa",
  MUITO_BAIXA: "Qualidade muito baixa",
  SEM_FORMATO: "Escolha um formato",
};

import type { Qualidade } from "../types";

export interface EntradaQualidade {
  larguraPx: number;
  alturaPx: number;
  larguraCm?: number | null;
  alturaCm?: number | null;
  orientacao?: string;
  zoom?: number;
  crop?: { largura: number; altura: number } | null;
  rotacao?: number;
}

export type ResultadoQualidade = { qualidade: Qualidade; dpi: number | null };

export function calcularQualidadeFoto(entrada: EntradaQualidade): ResultadoQualidade {
  if (!entrada.larguraCm || !entrada.alturaCm) return { qualidade: "SEM_FORMATO", dpi: null };
  const paisagem = entrada.orientacao === "PAISAGEM";
  const larguraCm = paisagem ? entrada.alturaCm : entrada.larguraCm;
  const alturaCm = paisagem ? entrada.larguraCm : entrada.alturaCm;
  const crop = entrada.crop ?? { largura: 1, altura: 1 };
  const pixelsOriginalLargura = entrada.larguraPx * crop.largura;
  const pixelsOriginalAltura = entrada.alturaPx * crop.altura;
  const giroLateral = (((entrada.rotacao ?? 0) % 360) + 360) % 360 % 180 !== 0;
  const pixelsVisuaisLargura = giroLateral ? pixelsOriginalAltura : pixelsOriginalLargura;
  const pixelsVisuaisAltura = giroLateral ? pixelsOriginalLargura : pixelsOriginalAltura;
  const dpi = Math.floor(Math.min(pixelsVisuaisLargura / (larguraCm / 2.54), pixelsVisuaisAltura / (alturaCm / 2.54)));
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

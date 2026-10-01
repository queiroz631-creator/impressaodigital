import type { TextoFoto } from "../types";

export type FonteTextoId = "SANS" | "SERIF" | "MONO" | "DECORATIVA";
export type AlinhamentoTexto = "ESQUERDA" | "CENTRO" | "DIREITA";
export type RotacaoTexto = 0 | 90 | 180 | 270;

export const FONTES_TEXTO: ReadonlyArray<{ id: FonteTextoId; nome: string; familia: string }> = [
  { id: "SANS", nome: "Sem serifa", familia: "Arial, Helvetica, sans-serif" },
  { id: "SERIF", nome: "Serifada", familia: "Georgia, 'Times New Roman', serif" },
  { id: "MONO", nome: "Monoespaçada", familia: "'Courier New', Courier, monospace" },
  { id: "DECORATIVA", nome: "Decorativa", familia: "cursive" },
];

export const CORES_TEXTO = ["#FFFFFF", "#000000", "#FF0000", "#2563EB", "#FACC15", "#16A34A"] as const;

export function familiaFonte(id: string) {
  return FONTES_TEXTO.find((fonte) => fonte.id === id)?.familia ?? FONTES_TEXTO[0]?.familia ?? "sans-serif";
}

export function estiloCaixaTexto(texto: TextoFoto, larguraArea: number, alturaArea: number) {
  return {
    centroX: Number(texto.posicao_x) * larguraArea,
    centroY: Number(texto.posicao_y) * alturaArea,
    largura: Number(texto.largura_normalizada) * larguraArea,
    tamanho: Number(texto.tamanho_normalizado) * alturaArea,
  };
}

export function limitarCentroTexto(valor: number) {
  return Math.min(1, Math.max(0, valor));
}
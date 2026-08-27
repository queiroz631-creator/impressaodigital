/**
 * Perfis de impressão: conjunto de opções (papel, qualidade, bandeja,
 * tamanho, cor, frente e verso) reutilizado por material.
 */

export type QualidadeImpressao = "rascunho" | "normal" | "alta";
export type CorImpressao = "color" | "grayscale" | "blackwhite";
export type DuplexPerfil = "nao" | "longa" | "curta";
export type OrientacaoPerfil = "retrato" | "paisagem";

export interface PerfilImpressao {
  id: string;
  nome: string;
  /** Impressora do perfil. Vazio = usa a impressora padrão configurada. */
  impressora: string | null;
  /** Tipo de papel/mídia conforme o driver (Comum, Couché, Etiqueta...). */
  midia: string;
  qualidade: QualidadeImpressao;
  /** Origem do documento (bandeja). */
  bandeja: string | null;
  /** A3, A4, A5 ou "personalizado". */
  tamanho: string;
  largura_mm: number;
  altura_mm: number;
  cor: CorImpressao;
  duplex: DuplexPerfil;
  copias: number;
  orientacao: OrientacaoPerfil;
  ativo: boolean;
  ordem: number;
}

export const TAMANHOS_PERFIL: Record<string, { largura: number; altura: number }> = {
  A3: { largura: 297, altura: 420 },
  A4: { largura: 210, altura: 297 },
  A5: { largura: 148, altura: 210 },
};

export const rotuloQualidade: Record<QualidadeImpressao, string> = {
  rascunho: "Rascunho",
  normal: "Normal",
  alta: "Alta",
};

export const rotuloCor: Record<CorImpressao, string> = {
  color: "Colorido",
  grayscale: "Escala de cinza",
  blackwhite: "Preto e branco",
};

export const rotuloDuplex: Record<DuplexPerfil, string> = {
  nao: "Só frente",
  longa: "Frente e verso (borda longa)",
  curta: "Frente e verso (borda curta)",
};

export const rotuloOrientacao: Record<OrientacaoPerfil, string> = {
  retrato: "Retrato",
  paisagem: "Paisagem",
};

/** Densidade (DPI) usada na impressão conforme a qualidade escolhida. */
export const densidadeQualidade: Record<QualidadeImpressao, number> = {
  rascunho: 150,
  normal: 300,
  alta: 600,
};

export const PERFIL_VAZIO: Omit<PerfilImpressao, "id"> = {
  nome: "",
  impressora: null,
  midia: "",
  qualidade: "normal",
  bandeja: null,
  tamanho: "A4",
  largura_mm: 210,
  altura_mm: 297,
  cor: "color",
  duplex: "nao",
  copias: 1,
  orientacao: "retrato",
  ativo: true,
  ordem: 1,
};

/** Resumo curto do perfil, exibido nas listagens. */
export function resumoPerfil(p: PerfilImpressao) {
  return [
    p.midia || "Papel padrão",
    `${p.tamanho}`,
    rotuloCor[p.cor],
    rotuloDuplex[p.duplex],
    rotuloQualidade[p.qualidade],
  ].join(" · ");
}

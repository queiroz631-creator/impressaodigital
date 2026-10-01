import type { FonteTextoId } from "../lib/texto";

export type MetricaFonte = { familia: string; lineHeight: number };

const ARQUIVOS = {
  SANS: {
    normal: new URL("../../../assets/fonts/DejaVuSans.ttf", import.meta.url).href,
    bold: new URL("../../../assets/fonts/DejaVuSans-Bold.ttf", import.meta.url).href,
    italic: new URL("../../../assets/fonts/DejaVuSans-Oblique.ttf", import.meta.url).href,
    boldItalic: new URL("../../../assets/fonts/DejaVuSans-BoldOblique.ttf", import.meta.url).href,
  },
  SERIF: {
    normal: new URL("../../../assets/fonts/DejaVuSerif.ttf", import.meta.url).href,
    bold: new URL("../../../assets/fonts/DejaVuSerif-Bold.ttf", import.meta.url).href,
    italic: new URL("../../../assets/fonts/DejaVuSerif-Italic.ttf", import.meta.url).href,
    boldItalic: new URL("../../../assets/fonts/DejaVuSerif-BoldItalic.ttf", import.meta.url).href,
  },
  MONO: {
    normal: new URL("../../../assets/fonts/DejaVuSansMono.ttf", import.meta.url).href,
    bold: new URL("../../../assets/fonts/DejaVuSansMono-Bold.ttf", import.meta.url).href,
    italic: new URL("../../../assets/fonts/DejaVuSansMono-Oblique.ttf", import.meta.url).href,
    boldItalic: new URL("../../../assets/fonts/DejaVuSansMono-BoldOblique.ttf", import.meta.url).href,
  },
  DECORATIVA: {
    normal: new URL("../../../assets/fonts/DejaVuSerif-Italic.ttf", import.meta.url).href,
    bold: new URL("../../../assets/fonts/DejaVuSerif-BoldItalic.ttf", import.meta.url).href,
    italic: new URL("../../../assets/fonts/DejaVuSerif-Italic.ttf", import.meta.url).href,
    boldItalic: new URL("../../../assets/fonts/DejaVuSerif-BoldItalic.ttf", import.meta.url).href,
  },
} as const;

export const METRICAS_FONTES: Record<FonteTextoId, MetricaFonte> = {
  SANS: { familia: "FotoExpressSans", lineHeight: 1.2 },
  SERIF: { familia: "FotoExpressSerif", lineHeight: 1.22 },
  MONO: { familia: "FotoExpressMono", lineHeight: 1.2 },
  DECORATIVA: { familia: "FotoExpressDecorativa", lineHeight: 1.24 },
};

let carregamento: Promise<void> | null = null;

export function carregarFontesRenderizacao() {
  if (carregamento) return carregamento;
  carregamento = Promise.all((Object.keys(ARQUIVOS) as FonteTextoId[]).flatMap((id) => {
    const familia = METRICAS_FONTES[id].familia;
    const arquivos = ARQUIVOS[id];
    return [
      new FontFace(familia, `url(${arquivos.normal})`, { weight: "400", style: "normal" }),
      new FontFace(familia, `url(${arquivos.bold})`, { weight: "700", style: "normal" }),
      new FontFace(familia, `url(${arquivos.italic})`, { weight: "400", style: "italic" }),
      new FontFace(familia, `url(${arquivos.boldItalic})`, { weight: "700", style: "italic" }),
    ];
  }).map(async (fonte) => {
    const carregada = await fonte.load();
    document.fonts.add(carregada);
  })).then(() => undefined).catch((erro) => {
    carregamento = null;
    throw new Error(`Não foi possível carregar as fontes de impressão: ${erro instanceof Error ? erro.message : "erro desconhecido"}`);
  });
  return carregamento;
}
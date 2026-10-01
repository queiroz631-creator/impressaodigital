import type { ItemGaleria, TextoFoto } from "../types";

export type PapelId = "A4" | "A3";
export type OrientacaoPapel = "AUTOMATICA" | "RETRATO" | "PAISAGEM";
export type ConfiguracaoMontagem = {
  papel: PapelId; orientacao: OrientacaoPapel;
  margemSuperiorMm: number; margemInferiorMm: number; margemEsquerdaMm: number; margemDireitaMm: number;
  espacamentoMm: number; permitirRotacao: boolean;
};
export type OcorrenciaMontagem = { itemId: string; indiceCopia: number; xMm: number; yMm: number; larguraMm: number; alturaMm: number; rotacaoFolha: 0 | 90 };
export type FolhaMontagem = { numero: number; larguraMm: number; alturaMm: number; ocorrencias: OcorrenciaMontagem[] };
export type PlanoMontagem = { folhas: FolhaMontagem[]; orientacaoEscolhida: Exclude<OrientacaoPapel, "AUTOMATICA">; areaUtilMm2: number; areaOcupadaMm2: number; aproveitamento: number };

export const PAPEIS: Record<PapelId, { nome: string; larguraMm: number; alturaMm: number }> = {
  A4: { nome: "A4", larguraMm: 210, alturaMm: 297 },
  A3: { nome: "A3", larguraMm: 297, alturaMm: 420 },
};
export const cmParaMm = (cm: number) => cm * 10;
export const mmParaPixels = (mm: number, dpi: number) => mm / 25.4 * dpi;

type Peca = { itemId: string; indiceCopia: number; largura: number; altura: number };
function pecasDosItens(itens: ItemGaleria[]): Peca[] {
  return itens.flatMap((item) => {
    const largura = cmParaMm(Number(item.largura_personalizada_cm ?? item.formato?.largura_cm ?? 0));
    const altura = cmParaMm(Number(item.altura_personalizada_cm ?? item.formato?.altura_cm ?? 0));
    const paisagem = item.orientacao === "PAISAGEM" || (item.orientacao === "AUTOMATICA" && item.arquivo.largura_px >= item.arquivo.altura_px);
    const dimensoes = paisagem ? { largura: Math.max(largura, altura), altura: Math.min(largura, altura) } : { largura: Math.min(largura, altura), altura: Math.max(largura, altura) };
    return Array.from({ length: Math.max(0, item.quantidade) }, (_, i) => ({ itemId: item.id, indiceCopia: i + 1, ...dimensoes }));
  }).sort((a, b) => b.largura * b.altura - a.largura * a.altura || b.altura - a.altura || a.itemId.localeCompare(b.itemId) || a.indiceCopia - b.indiceCopia);
}

function montarOrientacao(itens: ItemGaleria[], config: ConfiguracaoMontagem, orientacao: "RETRATO" | "PAISAGEM"): PlanoMontagem {
  const base = PAPEIS[config.papel];
  const larguraFolha = orientacao === "PAISAGEM" ? Math.max(base.larguraMm, base.alturaMm) : Math.min(base.larguraMm, base.alturaMm);
  const alturaFolha = orientacao === "PAISAGEM" ? Math.min(base.larguraMm, base.alturaMm) : Math.max(base.larguraMm, base.alturaMm);
  const utilW = larguraFolha - config.margemEsquerdaMm - config.margemDireitaMm;
  const utilH = alturaFolha - config.margemSuperiorMm - config.margemInferiorMm;
  if (utilW <= 0 || utilH <= 0) throw new Error("As margens eliminam a área útil do papel.");
  const folhas: FolhaMontagem[] = [];
  let atual: FolhaMontagem | null = null; let x = 0; let y = 0; let alturaLinha = 0;
  for (const peca of pecasDosItens(itens)) {
    const opcoes = [{ w: peca.largura, h: peca.altura, r: 0 as const }, ...(config.permitirRotacao ? [{ w: peca.altura, h: peca.largura, r: 90 as const }] : [])];
    if (!opcoes.some((o) => o.w <= utilW + 1e-6 && o.h <= utilH + 1e-6)) throw new Error(`Uma peça de ${peca.largura} × ${peca.altura} mm não cabe na área útil de ${utilW} × ${utilH} mm.`);
    if (!atual) { atual = { numero: folhas.length + 1, larguraMm: larguraFolha, alturaMm: alturaFolha, ocorrencias: [] }; x = 0; y = 0; alturaLinha = 0; }
    let opcao = opcoes.find((o) => x + o.w <= utilW + 1e-6 && y + o.h <= utilH + 1e-6);
    if (!opcao) { x = 0; y += alturaLinha + config.espacamentoMm; alturaLinha = 0; opcao = opcoes.find((o) => o.w <= utilW + 1e-6 && y + o.h <= utilH + 1e-6); }
    if (!opcao) { folhas.push(atual); atual = { numero: folhas.length + 1, larguraMm: larguraFolha, alturaMm: alturaFolha, ocorrencias: [] }; x = 0; y = 0; alturaLinha = 0; opcao = opcoes.find((o) => o.w <= utilW + 1e-6 && o.h <= utilH + 1e-6); }
    if (!opcao) throw new Error("Esta foto não cabe na área útil do papel selecionado.");
    atual.ocorrencias.push({ itemId: peca.itemId, indiceCopia: peca.indiceCopia, xMm: round(config.margemEsquerdaMm + x), yMm: round(config.margemSuperiorMm + y), larguraMm: round(opcao.w), alturaMm: round(opcao.h), rotacaoFolha: opcao.r });
    x += opcao.w + config.espacamentoMm; alturaLinha = Math.max(alturaLinha, opcao.h);
  }
  if (atual) folhas.push(atual);
  const areaOcupadaMm2 = pecasDosItens(itens).reduce((s, p) => s + p.largura * p.altura, 0);
  const areaUtilMm2 = utilW * utilH * folhas.length;
  return { folhas, orientacaoEscolhida: orientacao, areaUtilMm2: round(areaUtilMm2), areaOcupadaMm2: round(areaOcupadaMm2), aproveitamento: areaUtilMm2 ? round(areaOcupadaMm2 / areaUtilMm2 * 100) : 0 };
}
const round = (n: number) => Number(n.toFixed(3));

export function montarFolhas(itens: ItemGaleria[], config: ConfiguracaoMontagem): PlanoMontagem {
  if (!itens.length) return { folhas: [], orientacaoEscolhida: "RETRATO", areaUtilMm2: 0, areaOcupadaMm2: 0, aproveitamento: 0 };
  if (config.orientacao !== "AUTOMATICA") return montarOrientacao(itens, config, config.orientacao);
  const resultados: PlanoMontagem[] = [];
  let ultimoErro: unknown;
  for (const orientacao of ["RETRATO", "PAISAGEM"] as const) {
    try { resultados.push(montarOrientacao(itens, config, orientacao)); } catch (erro) { ultimoErro = erro; }
  }
  const melhor = resultados.sort((a, b) => a.folhas.length - b.folhas.length || b.aproveitamento - a.aproveitamento || a.orientacaoEscolhida.localeCompare(b.orientacaoEscolhida))[0];
  if (!melhor) throw ultimoErro instanceof Error ? ultimoErro : new Error("Esta foto não cabe na área útil do papel selecionado.");
  return melhor;
}

export async function assinaturaMontagem(itens: ItemGaleria[], textos: TextoFoto[], config: ConfiguracaoMontagem) {
  const dados = JSON.stringify({ config, itens: itens.map((i) => ({ id: i.id, formato: i.formato_id, largura: i.largura_personalizada_cm, altura: i.altura_personalizada_cm, quantidade: i.quantidade, orientacao: i.orientacao, atualizado: i.atualizado_em, configuracao: i.configuracao, formatoDados: i.formato })), textos: textos.map((t) => ({ id: t.id, item: t.item_id, versao: t.versao, atualizado: t.atualizado_em })) });
  const bytes = new TextEncoder().encode(dados); const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
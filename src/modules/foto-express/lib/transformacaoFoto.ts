export type ModoAjuste = "PREENCHER" | "AJUSTAR";

export interface EdicaoFoto {
  zoom: number;
  posicaoX: number;
  posicaoY: number;
  rotacao: number;
  espelharHorizontal: boolean;
  espelharVertical: boolean;
  modoAjuste: ModoAjuste;
}

export interface GeometriaFoto {
  escalaBase: number;
  escala: number;
  larguraVisual: number;
  alturaVisual: number;
  larguraImagem: number;
  alturaImagem: number;
  overflowX: number;
  overflowY: number;
  deslocamentoX: number;
  deslocamentoY: number;
}

export interface CropNormalizado {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

const limitar = (valor: number, minimo: number, maximo: number) => Math.min(maximo, Math.max(minimo, valor));
const arredondar = (valor: number) => Number(valor.toFixed(6));

export function normalizarRotacao(rotacao: number) {
  return ((Math.round(rotacao / 90) * 90) % 360 + 360) % 360;
}

export function calcularGeometria(
  original: { largura: number; altura: number },
  moldura: { largura: number; altura: number },
  edicao: Pick<EdicaoFoto, "zoom" | "posicaoX" | "posicaoY" | "rotacao" | "modoAjuste">,
): GeometriaFoto {
  const giroLateral = normalizarRotacao(edicao.rotacao) % 180 !== 0;
  const larguraVisualOriginal = giroLateral ? original.altura : original.largura;
  const alturaVisualOriginal = giroLateral ? original.largura : original.altura;
  const escalaPreencher = Math.max(moldura.largura / larguraVisualOriginal, moldura.altura / alturaVisualOriginal);
  const escalaAjustar = Math.min(moldura.largura / larguraVisualOriginal, moldura.altura / alturaVisualOriginal);
  const escalaBase = edicao.modoAjuste === "AJUSTAR" ? escalaAjustar : escalaPreencher;
  const escala = escalaBase * limitar(edicao.zoom, 1, 5);
  const larguraVisual = larguraVisualOriginal * escala;
  const alturaVisual = alturaVisualOriginal * escala;
  const overflowX = Math.max(0, (larguraVisual - moldura.largura) / 2);
  const overflowY = Math.max(0, (alturaVisual - moldura.altura) / 2);
  const posicaoX = overflowX === 0 ? 0 : limitar(edicao.posicaoX, -1, 1);
  const posicaoY = overflowY === 0 ? 0 : limitar(edicao.posicaoY, -1, 1);
  return {
    escalaBase,
    escala,
    larguraVisual,
    alturaVisual,
    larguraImagem: original.largura * escala,
    alturaImagem: original.altura * escala,
    overflowX,
    overflowY,
    deslocamentoX: posicaoX * overflowX,
    deslocamentoY: posicaoY * overflowY,
  };
}

export function limitarPosicao(geometria: GeometriaFoto, x: number, y: number) {
  return {
    x: geometria.overflowX === 0 ? 0 : limitar(x, -1, 1),
    y: geometria.overflowY === 0 ? 0 : limitar(y, -1, 1),
  };
}

function visualParaOriginal(u: number, v: number, rotacao: number) {
  switch (normalizarRotacao(rotacao)) {
    case 90: return { x: v, y: 1 - u };
    case 180: return { x: 1 - u, y: 1 - v };
    case 270: return { x: 1 - v, y: u };
    default: return { x: u, y: v };
  }
}

/**
 * O crop é derivado da transformação canônica e sempre gravado no espaço do
 * arquivo original: origem no canto superior esquerdo e valores entre 0 e 1.
 * Para 90°/270°, os cantos visíveis são transformados de volta ao original.
 */
export function derivarCrop(
  original: { largura: number; altura: number },
  moldura: { largura: number; altura: number },
  edicao: EdicaoFoto,
): CropNormalizado {
  const g = calcularGeometria(original, moldura, edicao);
  const esquerdaPx = limitar((g.larguraVisual - moldura.largura) / 2 - g.deslocamentoX, 0, g.larguraVisual);
  const topoPx = limitar((g.alturaVisual - moldura.altura) / 2 - g.deslocamentoY, 0, g.alturaVisual);
  const direitaPx = limitar(esquerdaPx + Math.min(moldura.largura, g.larguraVisual), 0, g.larguraVisual);
  const basePx = limitar(topoPx + Math.min(moldura.altura, g.alturaVisual), 0, g.alturaVisual);
  const limitesVisuais = {
    esquerda: esquerdaPx / g.larguraVisual,
    topo: topoPx / g.alturaVisual,
    direita: direitaPx / g.larguraVisual,
    base: basePx / g.alturaVisual,
  };
  const cantos = [
    visualParaOriginal(limitesVisuais.esquerda, limitesVisuais.topo, edicao.rotacao),
    visualParaOriginal(limitesVisuais.direita, limitesVisuais.topo, edicao.rotacao),
    visualParaOriginal(limitesVisuais.esquerda, limitesVisuais.base, edicao.rotacao),
    visualParaOriginal(limitesVisuais.direita, limitesVisuais.base, edicao.rotacao),
  ];
  const xs = cantos.map((p) => limitar(p.x, 0, 1));
  const ys = cantos.map((p) => limitar(p.y, 0, 1));
  const x = Math.min(...xs); const y = Math.min(...ys);
  return { x: arredondar(x), y: arredondar(y), largura: arredondar(Math.max(0.000001, Math.max(...xs) - x)), altura: arredondar(Math.max(0.000001, Math.max(...ys) - y)) };
}

export function dimensoesMoldura(
  larguraCm: number,
  alturaCm: number,
  orientacao: string,
  original: { largura: number; altura: number },
  rotacao: number,
) {
  const giroLateral = normalizarRotacao(rotacao) % 180 !== 0;
  const imagemPaisagem = (giroLateral ? original.altura : original.largura) >= (giroLateral ? original.largura : original.altura);
  const paisagem = orientacao === "PAISAGEM" || (orientacao === "AUTOMATICA" && imagemPaisagem);
  const menor = Math.min(larguraCm, alturaCm); const maior = Math.max(larguraCm, alturaCm);
  return paisagem ? { largura: maior, altura: menor } : { largura: menor, altura: maior };
}
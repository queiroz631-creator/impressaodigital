import { calcularGeometria, type EdicaoFoto } from "../lib/transformacaoFoto";
import { linhasEntrePecas, mmParaPixels } from "../lib/montagem";
import { desenharTexto } from "./textoCanvas";
import type { ManifestoFolha, ManifestoGeracao, ManifestoItem } from "./types";

export const DPI_IMPRESSAO = 300;
export const MAX_PIXELS_FOLHA = 36_000_000;

export function pixelsDaFolha(larguraMm: number, alturaMm: number) {
  const largura = Math.round(mmParaPixels(larguraMm, DPI_IMPRESSAO));
  const altura = Math.round(mmParaPixels(alturaMm, DPI_IMPRESSAO));
  if (largura * altura > MAX_PIXELS_FOLHA) throw new Error("A folha excede o limite seguro de memória para geração neste navegador.");
  return { largura, altura };
}

async function decodificarOriginal(url: string) {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error("Não foi possível carregar um arquivo original.");
  const blob = await resposta.blob();
  return createImageBitmap(blob, { imageOrientation: "from-image" });
}

function criarCanvas(largura: number, altura: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, largura); canvas.height = Math.max(1, altura);
  return canvas;
}

export function renderizarPeca(item: ManifestoItem, bitmap: ImageBitmap, larguraPx: number, alturaPx: number) {
  const canvas = criarCanvas(larguraPx, alturaPx);
  const contexto = canvas.getContext("2d", { alpha: false });
  if (!contexto) throw new Error("Não foi possível preparar a peça para impressão.");
  contexto.fillStyle = item.formato.cor_fundo;
  contexto.fillRect(0, 0, larguraPx, alturaPx);
  const area = item.formato;
  const areaX = Number(area.area_foto_x) * larguraPx;
  const areaY = Number(area.area_foto_y) * alturaPx;
  const areaW = Number(area.area_foto_largura) * larguraPx;
  const areaH = Number(area.area_foto_altura) * alturaPx;
  const configuracao = item.configuracao;
  const edicao: EdicaoFoto = {
    zoom: Number(configuracao.zoom), posicaoX: Number(configuracao.posicao_x), posicaoY: Number(configuracao.posicao_y),
    rotacao: Number(configuracao.rotacao), espelharHorizontal: configuracao.espelhar_horizontal,
    espelharVertical: configuracao.espelhar_vertical, modoAjuste: configuracao.modo_ajuste === "AJUSTAR" ? "AJUSTAR" : "PREENCHER",
  };
  const geometria = calcularGeometria({ largura: bitmap.width, altura: bitmap.height }, { largura: areaW, altura: areaH }, edicao);
  contexto.save();
  contexto.beginPath(); contexto.rect(areaX, areaY, areaW, areaH); contexto.clip();
  contexto.translate(areaX + areaW / 2 + geometria.deslocamentoX, areaY + areaH / 2 + geometria.deslocamentoY);
  contexto.rotate(edicao.rotacao * Math.PI / 180);
  contexto.scale(edicao.espelharHorizontal ? -1 : 1, edicao.espelharVertical ? -1 : 1);
  contexto.drawImage(bitmap, -geometria.larguraImagem / 2, -geometria.alturaImagem / 2, geometria.larguraImagem, geometria.alturaImagem);
  contexto.restore();
  [...item.textos].sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id)).forEach((texto) => desenharTexto(contexto, texto, larguraPx, alturaPx));
  return canvas;
}

export async function renderizarFolha(manifesto: ManifestoGeracao, folha: ManifestoFolha, originais: Record<string, string>) {
  const pixels = pixelsDaFolha(Number(folha.largura_mm), Number(folha.altura_mm));
  const folhaCanvas = criarCanvas(pixels.largura, pixels.altura);
  const contexto = folhaCanvas.getContext("2d", { alpha: false });
  if (!contexto) throw new Error("Não foi possível preparar a folha de impressão.");
  contexto.fillStyle = "#FFFFFF"; contexto.fillRect(0, 0, pixels.largura, pixels.altura);
  const cache = new Map<string, ImageBitmap>();
  try {
    for (const ocorrencia of folha.ocorrencias) {
      const item = manifesto.itens.find((entrada) => entrada.item.id === ocorrencia.item_id);
      if (!item) throw new Error("A montagem contém uma foto que não está no manifesto.");
      let bitmap = cache.get(item.arquivo.id);
      if (!bitmap) {
        const url = originais[item.arquivo.id];
        if (!url) throw new Error(`Original indisponível: ${item.arquivo.nome_original}.`);
        bitmap = await decodificarOriginal(url); cache.set(item.arquivo.id, bitmap);
      }
      const largura = Math.round(mmParaPixels(Number(ocorrencia.largura_mm), DPI_IMPRESSAO));
      const altura = Math.round(mmParaPixels(Number(ocorrencia.altura_mm), DPI_IMPRESSAO));
      const girada = Number(ocorrencia.rotacao_folha) === 90;
      const peca = renderizarPeca(item, bitmap, girada ? altura : largura, girada ? largura : altura);
      const x = Math.round(mmParaPixels(Number(ocorrencia.x_mm), DPI_IMPRESSAO));
      const y = Math.round(mmParaPixels(Number(ocorrencia.y_mm), DPI_IMPRESSAO));
      if (girada) {
        contexto.save();
        contexto.translate(x + largura / 2, y + altura / 2);
        contexto.rotate(Math.PI / 2);
        contexto.drawImage(peca, -peca.width / 2, -peca.height / 2);
        contexto.restore();
      } else contexto.drawImage(peca, x, y, largura, altura);
      peca.width = 1; peca.height = 1;
    }
    if (folha.linha_espacamento_ativa) {
      const ocorrencias = folha.ocorrencias.map((o) => ({ itemId: o.item_id, indiceCopia: o.indice_copia, xMm: Number(o.x_mm), yMm: Number(o.y_mm), larguraMm: Number(o.largura_mm), alturaMm: Number(o.altura_mm), rotacaoFolha: Number(o.rotacao_folha) === 90 ? 90 as const : 0 as const }));
      contexto.save(); contexto.strokeStyle = folha.linha_cor ?? "#000000"; contexto.lineWidth = Math.max(1, mmParaPixels(Number(folha.linha_espessura_mm ?? .2), DPI_IMPRESSAO));
      for (const linha of linhasEntrePecas({ ocorrencias })) { contexto.beginPath(); contexto.moveTo(mmParaPixels(linha.x1, DPI_IMPRESSAO), mmParaPixels(linha.y1, DPI_IMPRESSAO)); contexto.lineTo(mmParaPixels(linha.x2, DPI_IMPRESSAO), mmParaPixels(linha.y2, DPI_IMPRESSAO)); contexto.stroke(); }
      contexto.restore();
    }
    return folhaCanvas;
  } finally {
    cache.forEach((bitmap) => bitmap.close());
  }
}

export function canvasParaJpeg(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Não foi possível codificar a folha em JPG.")), "image/jpeg", 0.96));
}
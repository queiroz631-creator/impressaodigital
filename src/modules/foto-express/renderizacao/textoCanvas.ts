import { METRICAS_FONTES } from "./fontes";
import type { ManifestoTexto } from "./types";
import type { FonteTextoId } from "../lib/texto";

export function quebrarTexto(contexto: CanvasRenderingContext2D, conteudo: string, larguraMaxima: number) {
  const linhas: string[] = [];
  for (const linhaExplicita of conteudo.split("\n")) {
    if (linhaExplicita === "") { linhas.push(""); continue; }
    const palavras = linhaExplicita.split(/(\s+)/).filter(Boolean);
    let atual = "";
    for (const palavra of palavras) {
      const tentativa = atual + palavra;
      if (atual && contexto.measureText(tentativa).width > larguraMaxima) {
        linhas.push(atual.trimEnd());
        atual = palavra.trimStart();
      } else atual = tentativa;
    }
    linhas.push(atual.trimEnd());
  }
  return linhas;
}

export function desenharTexto(contexto: CanvasRenderingContext2D, texto: ManifestoTexto, largura: number, altura: number) {
  const id = (texto.fonte_id in METRICAS_FONTES ? texto.fonte_id : "SANS") as FonteTextoId;
  const metrica = METRICAS_FONTES[id];
  const tamanho = Number(texto.tamanho_normalizado) * altura;
  const larguraCaixa = Number(texto.largura_normalizada) * largura;
  contexto.save();
  contexto.translate(Number(texto.posicao_x) * largura, Number(texto.posicao_y) * altura);
  contexto.rotate(Number(texto.rotacao) * Math.PI / 180);
  contexto.fillStyle = texto.cor;
  contexto.textBaseline = "middle";
  contexto.textAlign = texto.alinhamento === "ESQUERDA" ? "left" : texto.alinhamento === "DIREITA" ? "right" : "center";
  contexto.font = `${texto.italico ? "italic " : ""}${texto.negrito ? "700" : "400"} ${tamanho}px "${metrica.familia}"`;
  const linhas = quebrarTexto(contexto, texto.conteudo, larguraCaixa);
  const passo = tamanho * metrica.lineHeight;
  const inicioY = -((linhas.length - 1) * passo) / 2;
  const x = texto.alinhamento === "ESQUERDA" ? -larguraCaixa / 2 : texto.alinhamento === "DIREITA" ? larguraCaixa / 2 : 0;
  linhas.forEach((linha, indice) => contexto.fillText(linha, x, inicioY + indice * passo, larguraCaixa));
  contexto.restore();
}
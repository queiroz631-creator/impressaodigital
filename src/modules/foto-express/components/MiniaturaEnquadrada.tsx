import { Images } from "lucide-react";
import { calcularGeometria, dimensoesMoldura, type EdicaoFoto } from "../lib/transformacaoFoto";
import type { ItemGaleria } from "../types";

const EDICAO_PADRAO: EdicaoFoto = {
  zoom: 1,
  posicaoX: 0,
  posicaoY: 0,
  rotacao: 0,
  espelharHorizontal: false,
  espelharVertical: false,
  modoAjuste: "PREENCHER",
};

export function MiniaturaEnquadrada({ item }: { item: ItemGaleria }) {
  const larguraCm = item.largura_personalizada_cm ?? item.formato?.largura_cm;
  const alturaCm = item.altura_personalizada_cm ?? item.formato?.altura_cm;
  const configuracao = item.configuracao;

  if (!item.formato || !larguraCm || !alturaCm) {
    return <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-muted">
      {item.thumbnailUrl
        ? <img src={item.thumbnailUrl} alt={item.arquivo.nome_original} className="h-full w-full object-cover" />
        : <ImagemAusente />}
    </div>;
  }

  const edicao: EdicaoFoto = configuracao ? {
    zoom: Number(configuracao.zoom),
    posicaoX: Number(configuracao.posicao_x),
    posicaoY: Number(configuracao.posicao_y),
    rotacao: Number(configuracao.rotacao),
    espelharHorizontal: configuracao.espelhar_horizontal,
    espelharVertical: configuracao.espelhar_vertical,
    modoAjuste: configuracao.modo_ajuste === "AJUSTAR" ? "AJUSTAR" : "PREENCHER",
  } : EDICAO_PADRAO;
  const original = { largura: item.arquivo.largura_px, altura: item.arquivo.altura_px };
  const formato = dimensoesMoldura(Number(larguraCm), Number(alturaCm), item.orientacao, original, edicao.rotacao);
  const tamanho = 1000;
  const moldura = formato.largura >= formato.altura
    ? { largura: tamanho, altura: tamanho * formato.altura / formato.largura }
    : { largura: tamanho * formato.largura / formato.altura, altura: tamanho };
  const geometria = calcularGeometria(original, moldura, edicao);

  return <div className="relative flex min-h-40 w-full items-center justify-center overflow-hidden rounded-md bg-muted p-3">
    <div className="relative max-h-56 max-w-full overflow-hidden border border-border bg-background shadow-sm" style={{ aspectRatio: formato.largura / formato.altura, width: formato.largura >= formato.altura ? "100%" : "auto", height: formato.largura < formato.altura ? "14rem" : "auto" }}>
      {item.thumbnailUrl ? <img
        src={item.thumbnailUrl}
        alt={item.arquivo.nome_original}
        draggable={false}
        className="pointer-events-none absolute max-w-none select-none"
        style={{
          left: `${50 + geometria.deslocamentoX / moldura.largura * 100}%`,
          top: `${50 + geometria.deslocamentoY / moldura.altura * 100}%`,
          width: `${geometria.larguraImagem / moldura.largura * 100}%`,
          height: `${geometria.alturaImagem / moldura.altura * 100}%`,
          transform: `translate(-50%, -50%) rotate(${edicao.rotacao}deg) scaleX(${edicao.espelharHorizontal ? -1 : 1}) scaleY(${edicao.espelharVertical ? -1 : 1})`,
        }}
      /> : <ImagemAusente />}
    </div>
  </div>;
}

function ImagemAusente() {
  return <Images className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />;
}
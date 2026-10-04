import { Images } from "lucide-react";
import type { ItemGaleria, TextoFoto } from "../types";
import { dimensoesMoldura } from "../lib/transformacaoFoto";
import { PecaFoto } from "./PecaFoto";

export function MiniaturaEnquadrada({ item, textos = [] }: { item: ItemGaleria; textos?: TextoFoto[] }) {
  const larguraCm = item.largura_personalizada_cm ?? item.formato?.largura_cm;
  const alturaCm = item.altura_personalizada_cm ?? item.formato?.altura_cm;

  if (!item.formato || !larguraCm || !alturaCm) {
    return <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-muted">
      {item.thumbnailUrl
        ? <img src={item.thumbnailUrl} alt={item.arquivo.nome_original} className="h-full w-full object-cover" />
        : <ImagemAusente />}
    </div>;
  }

  const formato = dimensoesMoldura(
    Number(larguraCm),
    Number(alturaCm),
    item.orientacao,
    { largura: item.arquivo.largura_px, altura: item.arquivo.altura_px },
    Number(item.configuracao?.rotacao ?? 0),
  );

  return <div className="relative flex min-h-40 w-full items-center justify-center overflow-hidden rounded-md bg-muted p-3">
    <div className="relative max-h-56 max-w-full overflow-hidden border border-border bg-background shadow-sm" style={{ aspectRatio: formato.largura / formato.altura, width: formato.largura >= formato.altura ? "100%" : "auto", height: formato.largura < formato.altura ? "14rem" : "auto" }}>
      {item.thumbnailUrl ? <PecaFoto item={item} textos={textos} /> : <ImagemAusente />}
    </div>
  </div>;
}

function ImagemAusente() {
  return <Images className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />;
}
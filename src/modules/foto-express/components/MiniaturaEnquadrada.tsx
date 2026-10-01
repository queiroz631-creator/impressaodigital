import { Images } from "lucide-react";
import type { ItemGaleria } from "../types";
import { PecaFoto } from "./PecaFoto";

export function MiniaturaEnquadrada({ item }: { item: ItemGaleria }) {
  const larguraCm = item.largura_personalizada_cm ?? item.formato?.largura_cm;
  const alturaCm = item.altura_personalizada_cm ?? item.formato?.altura_cm;

  if (!item.formato || !larguraCm || !alturaCm) {
    return <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-muted">
      {item.thumbnailUrl
        ? <img src={item.thumbnailUrl} alt={item.arquivo.nome_original} className="h-full w-full object-cover" />
        : <ImagemAusente />}
    </div>;
  }

  const original = { largura: item.arquivo.largura_px, altura: item.arquivo.altura_px };
  const paisagem = item.orientacao === "PAISAGEM" || (item.orientacao === "AUTOMATICA" && original.largura >= original.altura);
  const menor = Math.min(Number(larguraCm), Number(alturaCm)); const maior = Math.max(Number(larguraCm), Number(alturaCm));
  const formato = paisagem ? { largura: maior, altura: menor } : { largura: menor, altura: maior };

  return <div className="relative flex min-h-40 w-full items-center justify-center overflow-hidden rounded-md bg-muted p-3">
    <div className="relative max-h-56 max-w-full overflow-hidden border border-border bg-background shadow-sm" style={{ aspectRatio: formato.largura / formato.altura, width: formato.largura >= formato.altura ? "100%" : "auto", height: formato.largura < formato.altura ? "14rem" : "auto" }}>
      {item.thumbnailUrl ? <PecaFoto item={item} /> : <ImagemAusente />}
    </div>
  </div>;
}

function ImagemAusente() {
  return <Images className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />;
}
import { ChevronLeft, ChevronRight, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ItemGaleria, TextoFoto } from "../types";
import type { PlanoMontagem } from "../lib/montagem";
import { PecaFoto } from "../components/PecaFoto";

export function PreviewFolha({ plano, indice, onIndice, itens, textos }: { plano: PlanoMontagem; indice: number; onIndice: (i: number) => void; itens: ItemGaleria[]; textos: TextoFoto[] }) {
  const folha = plano.folhas[indice];
  if (!folha) return <div className="flex min-h-80 flex-col items-center justify-center text-muted-foreground"><FileImage className="mb-2 h-10 w-10" /><p>Nenhuma folha montada.</p></div>;
  return <div className="space-y-3"><div className="flex items-center justify-between"><Button size="icon" variant="outline" disabled={indice === 0} onClick={() => onIndice(indice - 1)} aria-label="Folha anterior"><ChevronLeft /></Button><span className="text-center text-sm font-medium">Folha {indice + 1} de {plano.folhas.length}{folha.papelNome ? <span className="block text-xs text-muted-foreground">{folha.papelNome} · {folha.larguraMm} × {folha.alturaMm} mm</span> : null}</span><Button size="icon" variant="outline" disabled={indice >= plano.folhas.length - 1} onClick={() => onIndice(indice + 1)} aria-label="Próxima folha"><ChevronRight /></Button></div>
    <div className="mx-auto w-full max-w-3xl overflow-hidden border bg-background shadow" style={{ aspectRatio: folha.larguraMm / folha.alturaMm }}>
      <div className="relative h-full w-full">{folha.ocorrencias.map((o) => { const item = itens.find((i) => i.id === o.itemId); if (!item) return null; return <div key={`${o.itemId}-${o.indiceCopia}`} className="absolute overflow-hidden border border-border" style={{ left: `${o.xMm / folha.larguraMm * 100}%`, top: `${o.yMm / folha.alturaMm * 100}%`, width: `${o.larguraMm / folha.larguraMm * 100}%`, height: `${o.alturaMm / folha.alturaMm * 100}%` }}><div className="h-full w-full" style={{ transform: o.rotacaoFolha === 90 ? "rotate(90deg) scaleX(calc(1 / var(--peca-proporcao))) scaleY(var(--peca-proporcao))" : undefined, ["--peca-proporcao" as string]: o.larguraMm / o.alturaMm }}><PecaFoto item={item} textos={textos.filter((t) => t.item_id === item.id)} identificacao={`#${item.ordem + 1} · ${o.indiceCopia}`} /></div></div>; })}</div>
    </div>
  </div>;
}
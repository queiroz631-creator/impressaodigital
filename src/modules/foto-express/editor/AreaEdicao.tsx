import { useMemo, useRef, type PointerEvent } from "react";
import { ImageOff } from "lucide-react";
import { calcularGeometria, limitarPosicao, type EdicaoFoto } from "../lib/transformacaoFoto";
import type { TextoFoto } from "../types";
import { CamadasTexto } from "./textos/CamadasTexto";
import { cn } from "@/lib/utils";

export function AreaEdicao({ url, nome, original, proporcao, proporcaoCanonica = proporcao, girarPeca = false, areaFoto = { x: 0, y: 0, largura: 1, altura: 1 }, corFundo, edicao, textos = [], textoSelecionadoId = null, somenteLeitura, compactaNoCelular = false, onChange, onCommit, onImageError, onSelecionarTexto, onChangeTexto, onCommitTexto }: {
  url: string; nome: string; original: { largura: number; altura: number }; proporcao: number; edicao: EdicaoFoto; somenteLeitura: boolean;
  areaFoto?: { x: number; y: number; largura: number; altura: number }; corFundo?: string;
  compactaNoCelular?: boolean; proporcaoCanonica?: number; girarPeca?: boolean;
  onChange: (edicao: EdicaoFoto) => void; onCommit: () => void; onImageError: () => void;
  textos?: TextoFoto[]; textoSelecionadoId?: string | null; onSelecionarTexto?: (id: string | null) => void;
  onChangeTexto?: (texto: TextoFoto) => void; onCommitTexto?: (texto: TextoFoto) => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const arraste = useRef<{ x: number; y: number; posicaoX: number; posicaoY: number } | null>(null);
  const tamanho = 1000;
  const peca = useMemo(() => proporcaoCanonica >= 1 ? { largura: tamanho, altura: tamanho / proporcaoCanonica } : { largura: tamanho * proporcaoCanonica, altura: tamanho }, [proporcaoCanonica]);
  const moldura = useMemo(() => ({ largura: peca.largura * areaFoto.largura, altura: peca.altura * areaFoto.altura }), [peca, areaFoto]);
  const geometria = calcularGeometria(original, moldura, edicao);
  function iniciar(e: PointerEvent<HTMLDivElement>) {
    if (somenteLeitura) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    arraste.current = { x: e.clientX, y: e.clientY, posicaoX: edicao.posicaoX, posicaoY: edicao.posicaoY };
  }
  function mover(e: PointerEvent<HTMLDivElement>) {
    if (!arraste.current || !areaRef.current) return;
    const escalaTela = areaRef.current.clientWidth * areaFoto.largura / moldura.largura;
    const deltaX = girarPeca ? e.clientY - arraste.current.y : e.clientX - arraste.current.x;
    const deltaY = girarPeca ? arraste.current.x - e.clientX : e.clientY - arraste.current.y;
    const x = geometria.overflowX ? arraste.current.posicaoX + deltaX / (geometria.overflowX * escalaTela) : 0;
    const y = geometria.overflowY ? arraste.current.posicaoY + deltaY / (geometria.overflowY * escalaTela) : 0;
    const limitada = limitarPosicao(geometria, x, y);
    onChange({ ...edicao, posicaoX: limitada.x, posicaoY: limitada.y });
  }
  function terminar() { if (arraste.current) { arraste.current = null; onCommit(); } }
  return <div className={cn("flex min-h-0 w-full items-center justify-center overflow-hidden rounded-md bg-muted p-2 sm:min-h-[420px] sm:p-5 xl:h-[calc(100dvh-250px)] xl:min-h-[420px]", compactaNoCelular && "max-h-[42dvh] sm:max-h-none")}>
    <div className={cn("relative w-full max-w-full overflow-hidden border border-border bg-background shadow-card sm:max-h-none", compactaNoCelular ? "max-h-[40dvh]" : "max-h-[65dvh]")} style={{ aspectRatio: proporcao, backgroundColor: corFundo, maxWidth: `min(48rem, calc((100dvh - 290px) * ${proporcao}))` }} onClick={() => onSelecionarTexto?.(null)}>
      <div ref={areaRef} className="absolute left-1/2 top-1/2 touch-none overflow-hidden [container-type:size]" style={{ width: girarPeca ? `${100 / proporcao}%` : "100%", height: girarPeca ? `${proporcao * 100}%` : "100%", transform: `translate(-50%, -50%) rotate(${girarPeca ? 90 : 0}deg)`, backgroundColor: corFundo }}>
      <div className="absolute overflow-hidden" style={{ left: `${areaFoto.x * 100}%`, top: `${areaFoto.y * 100}%`, width: `${areaFoto.largura * 100}%`, height: `${areaFoto.altura * 100}%` }} onPointerDown={iniciar} onPointerMove={mover} onPointerUp={terminar} onPointerCancel={terminar}>
        {url ? <img draggable={false} src={url} alt={nome} onError={onImageError} className="pointer-events-none absolute max-w-none select-none" style={{ left: `${50 + geometria.deslocamentoX / moldura.largura * 100}%`, top: `${50 + geometria.deslocamentoY / moldura.altura * 100}%`, width: `${geometria.larguraImagem / moldura.largura * 100}%`, height: `${geometria.alturaImagem / moldura.altura * 100}%`, transform: `translate(-50%, -50%) rotate(${edicao.rotacao}deg) scaleX(${edicao.espelharHorizontal ? -1 : 1}) scaleY(${edicao.espelharVertical ? -1 : 1})` }} /> : <div className="absolute inset-0 flex items-center justify-center"><ImageOff className="h-10 w-10 text-muted-foreground" /></div>}
      </div>
      <CamadasTexto textos={textos} selecionadoId={textoSelecionadoId} somenteLeitura={somenteLeitura} onSelecionar={(id) => onSelecionarTexto?.(id)} onChange={(texto) => onChangeTexto?.(texto)} onCommit={(texto) => onCommitTexto?.(texto)} />
      </div>
      <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-primary/70" />
    </div>
  </div>;
}
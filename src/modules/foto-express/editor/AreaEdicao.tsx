import { useMemo, useRef, type PointerEvent } from "react";
import { ImageOff } from "lucide-react";
import { calcularGeometria, limitarPosicao, type EdicaoFoto } from "../lib/transformacaoFoto";
import type { TextoFoto } from "../types";
import { CamadasTexto } from "./textos/CamadasTexto";
import { cn } from "@/lib/utils";

export function AreaEdicao({ url, nome, original, proporcao, areaFoto = { x: 0, y: 0, largura: 1, altura: 1 }, corFundo, edicao, textos = [], textoSelecionadoId = null, somenteLeitura, compactaNoCelular = false, onChange, onCommit, onImageError, onSelecionarTexto, onChangeTexto, onCommitTexto }: {
  url: string; nome: string; original: { largura: number; altura: number }; proporcao: number; edicao: EdicaoFoto; somenteLeitura: boolean;
  areaFoto?: { x: number; y: number; largura: number; altura: number }; corFundo?: string;
  compactaNoCelular?: boolean;
  onChange: (edicao: EdicaoFoto) => void; onCommit: () => void; onImageError: () => void;
  textos?: TextoFoto[]; textoSelecionadoId?: string | null; onSelecionarTexto?: (id: string | null) => void;
  onChangeTexto?: (texto: TextoFoto) => void; onCommitTexto?: (texto: TextoFoto) => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const arraste = useRef<{ x: number; y: number; posicaoX: number; posicaoY: number } | null>(null);
  const pontos = useRef(new Map<number, { x: number; y: number }>());
  const pinca = useRef<{ distancia: number; zoom: number } | null>(null);
  const tamanho = 1000;
  const peca = useMemo(() => proporcao >= 1 ? { largura: tamanho, altura: tamanho / proporcao } : { largura: tamanho * proporcao, altura: tamanho }, [proporcao]);
  const moldura = useMemo(() => ({ largura: peca.largura * areaFoto.largura, altura: peca.altura * areaFoto.altura }), [peca, areaFoto]);
  const geometria = calcularGeometria(original, moldura, edicao);
  function iniciar(e: PointerEvent<HTMLDivElement>) {
    if (somenteLeitura) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pontos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pontos.current.size === 2) {
      const [a, b] = [...pontos.current.values()];
      if (a && b) pinca.current = { distancia: Math.hypot(b.x - a.x, b.y - a.y), zoom: edicao.zoom };
      arraste.current = null;
      return;
    }
    arraste.current = { x: e.clientX, y: e.clientY, posicaoX: edicao.posicaoX, posicaoY: edicao.posicaoY };
  }
  function mover(e: PointerEvent<HTMLDivElement>) {
    if (pontos.current.has(e.pointerId)) pontos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pontos.current.size >= 2 && pinca.current) {
      const [a, b] = [...pontos.current.values()];
      if (a && b && pinca.current.distancia > 0) onChange({ ...edicao, zoom: Math.min(5, Math.max(1, pinca.current.zoom * Math.hypot(b.x - a.x, b.y - a.y) / pinca.current.distancia)) });
      return;
    }
    if (!arraste.current || !areaRef.current) return;
    const escalaTela = areaRef.current.clientWidth * areaFoto.largura / moldura.largura;
    const x = geometria.overflowX ? arraste.current.posicaoX + (e.clientX - arraste.current.x) / (geometria.overflowX * escalaTela) : 0;
    const y = geometria.overflowY ? arraste.current.posicaoY + (e.clientY - arraste.current.y) / (geometria.overflowY * escalaTela) : 0;
    const limitada = limitarPosicao(geometria, x, y);
    onChange({ ...edicao, posicaoX: limitada.x, posicaoY: limitada.y });
  }
  function terminar(e: PointerEvent<HTMLDivElement>) {
    const haviaInteracao = pontos.current.size > 0 || !!arraste.current;
    pontos.current.delete(e.pointerId);
    if (pontos.current.size < 2) pinca.current = null;
    arraste.current = null;
    if (haviaInteracao) onCommit();
  }
  return <div className={cn("flex min-h-0 w-full items-center justify-center overflow-hidden rounded-md bg-muted p-2 sm:min-h-[420px] sm:p-5 xl:h-[calc(100dvh-250px)] xl:min-h-[420px]", compactaNoCelular && "max-h-[42dvh] sm:max-h-none")}>
    <div ref={areaRef} className={cn("relative w-full max-w-full touch-none overflow-hidden border border-border bg-background shadow-card [container-type:size] sm:max-h-none", compactaNoCelular ? "max-h-[40dvh]" : "max-h-[65dvh]")} style={{ aspectRatio: proporcao, backgroundColor: corFundo, maxWidth: compactaNoCelular ? `min(48rem, calc(40dvh * ${proporcao}))` : `min(48rem, calc((100dvh - 290px) * ${proporcao}))` }} onClick={() => onSelecionarTexto?.(null)}>
      <div className="absolute overflow-hidden" style={{ left: `${areaFoto.x * 100}%`, top: `${areaFoto.y * 100}%`, width: `${areaFoto.largura * 100}%`, height: `${areaFoto.altura * 100}%` }} onPointerDown={iniciar} onPointerMove={mover} onPointerUp={terminar} onPointerCancel={terminar}>
        {url ? <img draggable={false} src={url} alt={nome} onError={onImageError} className="pointer-events-none absolute max-w-none select-none" style={{ left: `${50 + geometria.deslocamentoX / moldura.largura * 100}%`, top: `${50 + geometria.deslocamentoY / moldura.altura * 100}%`, width: `${geometria.larguraImagem / moldura.largura * 100}%`, height: `${geometria.alturaImagem / moldura.altura * 100}%`, transform: `translate(-50%, -50%) rotate(${edicao.rotacao}deg) scaleX(${edicao.espelharHorizontal ? -1 : 1}) scaleY(${edicao.espelharVertical ? -1 : 1})` }} /> : <div className="absolute inset-0 flex items-center justify-center"><ImageOff className="h-10 w-10 text-muted-foreground" /></div>}
      </div>
      <CamadasTexto textos={textos} selecionadoId={textoSelecionadoId} somenteLeitura={somenteLeitura} onSelecionar={(id) => onSelecionarTexto?.(id)} onChange={(texto) => onChangeTexto?.(texto)} onCommit={(texto) => onCommitTexto?.(texto)} />
      <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-primary/70" />
    </div>
  </div>;
}
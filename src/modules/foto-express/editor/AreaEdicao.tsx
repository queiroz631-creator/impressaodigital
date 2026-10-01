import { useMemo, useRef, type PointerEvent } from "react";
import { ImageOff } from "lucide-react";
import { calcularGeometria, limitarPosicao, type EdicaoFoto } from "../lib/transformacaoFoto";
import type { TextoFoto } from "../types";
import { CamadasTexto } from "./textos/CamadasTexto";

export function AreaEdicao({ url, nome, original, proporcao, edicao, textos = [], textoSelecionadoId = null, somenteLeitura, onChange, onCommit, onImageError, onSelecionarTexto, onChangeTexto, onCommitTexto }: {
  url: string; nome: string; original: { largura: number; altura: number }; proporcao: number; edicao: EdicaoFoto; somenteLeitura: boolean;
  onChange: (edicao: EdicaoFoto) => void; onCommit: () => void; onImageError: () => void;
  textos?: TextoFoto[]; textoSelecionadoId?: string | null; onSelecionarTexto?: (id: string | null) => void;
  onChangeTexto?: (texto: TextoFoto) => void; onCommitTexto?: (texto: TextoFoto) => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const arraste = useRef<{ x: number; y: number; posicaoX: number; posicaoY: number } | null>(null);
  const tamanho = 1000;
  const moldura = useMemo(() => proporcao >= 1 ? { largura: tamanho, altura: tamanho / proporcao } : { largura: tamanho * proporcao, altura: tamanho }, [proporcao]);
  const geometria = calcularGeometria(original, moldura, edicao);
  function iniciar(e: PointerEvent<HTMLDivElement>) {
    if (somenteLeitura) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    arraste.current = { x: e.clientX, y: e.clientY, posicaoX: edicao.posicaoX, posicaoY: edicao.posicaoY };
  }
  function mover(e: PointerEvent<HTMLDivElement>) {
    if (!arraste.current || !areaRef.current) return;
    const escalaTela = areaRef.current.clientWidth / moldura.largura;
    const x = geometria.overflowX ? arraste.current.posicaoX + (e.clientX - arraste.current.x) / (geometria.overflowX * escalaTela) : 0;
    const y = geometria.overflowY ? arraste.current.posicaoY + (e.clientY - arraste.current.y) / (geometria.overflowY * escalaTela) : 0;
    const limitada = limitarPosicao(geometria, x, y);
    onChange({ ...edicao, posicaoX: limitada.x, posicaoY: limitada.y });
  }
  function terminar() { if (arraste.current) { arraste.current = null; onCommit(); } }
  return <div className="flex min-h-[360px] items-center justify-center rounded-md bg-muted p-3 sm:min-h-[520px] sm:p-6">
    <div ref={areaRef} className="relative w-full max-w-3xl touch-none overflow-hidden border border-border bg-background shadow-card [container-type:size]" style={{ aspectRatio: proporcao }} onPointerDown={iniciar} onPointerMove={mover} onPointerUp={terminar} onPointerCancel={terminar} onClick={() => onSelecionarTexto?.(null)}>
      {url ? <img draggable={false} src={url} alt={nome} onError={onImageError} className="pointer-events-none absolute max-w-none select-none" style={{ left: `${50 + geometria.deslocamentoX / moldura.largura * 100}%`, top: `${50 + geometria.deslocamentoY / moldura.altura * 100}%`, width: `${geometria.larguraImagem / moldura.largura * 100}%`, height: `${geometria.alturaImagem / moldura.altura * 100}%`, transform: `translate(-50%, -50%) rotate(${edicao.rotacao}deg) scaleX(${edicao.espelharHorizontal ? -1 : 1}) scaleY(${edicao.espelharVertical ? -1 : 1})` }} /> : <div className="absolute inset-0 flex items-center justify-center"><ImageOff className="h-10 w-10 text-muted-foreground" /></div>}
      <CamadasTexto textos={textos} selecionadoId={textoSelecionadoId} somenteLeitura={somenteLeitura} onSelecionar={(id) => onSelecionarTexto?.(id)} onChange={(texto) => onChangeTexto?.(texto)} onCommit={(texto) => onCommitTexto?.(texto)} />
      <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-primary/70" />
    </div>
  </div>;
}
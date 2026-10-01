import { useRef, type PointerEvent } from "react";
import { cn } from "@/lib/utils";
import type { TextoFoto } from "../../types";
import { familiaFonte, limitarCentroTexto } from "../../lib/texto";

export function CamadasTexto({ textos, selecionadoId, somenteLeitura, onSelecionar, onChange, onCommit }: {
  textos: TextoFoto[];
  selecionadoId: string | null;
  somenteLeitura: boolean;
  onSelecionar: (id: string) => void;
  onChange: (texto: TextoFoto) => void;
  onCommit: (texto: TextoFoto) => void;
}) {
  const arraste = useRef<{ id: string; x: number; y: number; posicaoX: number; posicaoY: number } | null>(null);
  const ultimoTexto = useRef<TextoFoto | null>(null);

  function iniciar(e: PointerEvent<HTMLDivElement>, texto: TextoFoto) {
    e.stopPropagation();
    onSelecionar(texto.id);
    if (somenteLeitura) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    arraste.current = { id: texto.id, x: e.clientX, y: e.clientY, posicaoX: Number(texto.posicao_x), posicaoY: Number(texto.posicao_y) };
  }

  function mover(e: PointerEvent<HTMLDivElement>, texto: TextoFoto) {
    const inicio = arraste.current;
    const area = e.currentTarget.parentElement;
    if (!inicio || inicio.id !== texto.id || !area) return;
    e.stopPropagation();
    const atualizado = {
      ...texto,
      posicao_x: limitarCentroTexto(inicio.posicaoX + (e.clientX - inicio.x) / area.clientWidth),
      posicao_y: limitarCentroTexto(inicio.posicaoY + (e.clientY - inicio.y) / area.clientHeight),
    };
    ultimoTexto.current = atualizado;
    onChange(atualizado);
  }

  function terminar(e: PointerEvent<HTMLDivElement>, texto: TextoFoto) {
    if (!arraste.current || arraste.current.id !== texto.id) return;
    e.stopPropagation();
    arraste.current = null;
    onCommit(ultimoTexto.current?.id === texto.id ? ultimoTexto.current : texto);
    ultimoTexto.current = null;
  }

  return <>{textos.map((texto) => <div
    key={texto.id}
    role="button"
    tabIndex={0}
    aria-label={`Texto: ${texto.conteudo || "sem conteúdo"}`}
    className={cn("absolute z-10 cursor-move touch-none whitespace-pre-wrap break-words px-1 py-0.5 leading-tight", selecionadoId === texto.id && "outline outline-2 outline-primary outline-offset-2")}
    style={{
      left: `${Number(texto.posicao_x) * 100}%`,
      top: `${Number(texto.posicao_y) * 100}%`,
      width: `${Number(texto.largura_normalizada) * 100}%`,
      fontSize: `calc(${Number(texto.tamanho_normalizado) * 100} * 1cqh)`,
      fontFamily: familiaFonte(texto.fonte_id),
      color: texto.cor,
      fontWeight: texto.negrito ? 700 : 400,
      fontStyle: texto.italico ? "italic" : "normal",
      textAlign: texto.alinhamento === "ESQUERDA" ? "left" : texto.alinhamento === "DIREITA" ? "right" : "center",
      transform: `translate(-50%, -50%) rotate(${Number(texto.rotacao)}deg)`,
      transformOrigin: "center",
    }}
    onPointerDown={(e) => iniciar(e, texto)}
    onPointerMove={(e) => mover(e, texto)}
    onPointerUp={(e) => terminar(e, texto)}
    onPointerCancel={(e) => terminar(e, texto)}
    onClick={(e) => { e.stopPropagation(); onSelecionar(texto.id); }}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelecionar(texto.id); }}
  >{texto.conteudo || " "}</div>)}</>;
}
import { useRef, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Bold, Copy, Images, Italic, Loader2, Plus, SmilePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import type { TextoFoto } from "../../types";
import { CORES_TEXTO, FONTES_TEXTO, type AlinhamentoTexto, type FonteTextoId, type RotacaoTexto } from "../../lib/texto";

const GRUPOS_EMOJI = [
  { nome: "Rostos", emojis: ["😀", "😃", "😄", "😁", "😊", "😍", "🥰", "😘", "😎", "🤩", "🥳", "😂", "😉", "😋", "🤗", "🤭", "😇", "🤠"] },
  { nome: "Gestos", emojis: ["👍", "👎", "👏", "🙌", "🤝", "🙏", "💪", "👌", "✌️", "🤞", "👋", "🤟", "💅", "🫶", "❤️", "💖", "💝", "💯"] },
  { nome: "Festa e presentes", emojis: ["🎉", "🎊", "🎈", "🎁", "🎂", "🍰", "🥂", "🍾", "✨", "⭐", "🌟", "💫", "🔥", "👑", "🏆", "🎀", "🌹", "🌸"] },
  { nome: "Família e ocasiões", emojis: ["👶", "🍼", "🧸", "🎓", "💍", "👰", "🤵", "🏠", "🐾", "🐶", "🐱", "🎄", "🎅", "🐰", "☀️", "🌈", "⚽", "📸"] },
] as const;

export function ControlesTexto({ textos, selecionado, somenteLeitura, salvando, quantidadeOutrasFotos, onAdicionar, onSelecionar, onChange, onCommit, onDuplicar, onAplicarTodas, onExcluir, onMover }: {
  textos: TextoFoto[];
  selecionado: TextoFoto | null;
  somenteLeitura: boolean;
  salvando: boolean;
  quantidadeOutrasFotos: number;
  onAdicionar: () => void;
  onSelecionar: (id: string) => void;
  onChange: (texto: TextoFoto) => void;
  onCommit: (texto: TextoFoto) => void;
  onDuplicar: (texto: TextoFoto) => void;
  onAplicarTodas: (texto: TextoFoto) => void | Promise<void>;
  onExcluir: (texto: TextoFoto) => void;
  onMover: (texto: TextoFoto, direcao: -1 | 1) => void;
}) {
  const campoTextoRef = useRef<HTMLTextAreaElement>(null);
  const [aplicandoTodas, setAplicandoTodas] = useState(false);
  const mudar = (patch: Partial<TextoFoto>) => selecionado && onChange({ ...selecionado, ...patch });
  const mudarEConfirmar = (patch: Partial<TextoFoto>) => {
    if (!selecionado) return;
    const atualizado = { ...selecionado, ...patch };
    onChange(atualizado);
    onCommit(atualizado);
  };
  const confirmar = () => selecionado && onCommit(selecionado);
  const inserirEmoji = (emoji: string) => {
    if (!selecionado || somenteLeitura) return;
    const campo = campoTextoRef.current;
    const inicio = campo?.selectionStart ?? selecionado.conteudo.length;
    const fim = campo?.selectionEnd ?? inicio;
    const conteudo = `${selecionado.conteudo.slice(0, inicio)}${emoji}${selecionado.conteudo.slice(fim)}`;
    if (conteudo.length > 500) return;
    const atualizado = { ...selecionado, conteudo };
    const novaPosicao = inicio + emoji.length;
    onChange(atualizado);
    onCommit(atualizado);
    window.requestAnimationFrame(() => {
      campo?.focus();
      campo?.setSelectionRange(novaPosicao, novaPosicao);
    });
  };
  const aplicarEmTodas = async () => {
    if (!selecionado || aplicandoTodas) return;
    setAplicandoTodas(true);
    try {
      await onAplicarTodas(selecionado);
    } finally {
      setAplicandoTodas(false);
    }
  };
  return <div className="space-y-5">
    <Button type="button" className="w-full" disabled={somenteLeitura || salvando} onClick={onAdicionar}><Plus className="mr-2 h-4 w-4" />Adicionar texto</Button>
    {textos.length > 0 && <div className="space-y-2"><Label>Camadas</Label><div className="space-y-1">{textos.map((texto, indice) => <Button key={texto.id} type="button" variant={texto.id === selecionado?.id ? "secondary" : "ghost"} className="h-auto w-full justify-start py-2 text-left" onClick={() => onSelecionar(texto.id)}><span className="mr-2 text-xs text-muted-foreground">{indice + 1}</span><span className="truncate">{texto.conteudo || "Texto vazio"}</span></Button>)}</div></div>}
    {!selecionado && <p className="text-sm text-muted-foreground">Adicione ou selecione um texto sobre a foto.</p>}
    {selecionado && <>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="conteudo-texto">Conteúdo</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{selecionado.conteudo.length}/500</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" size="icon" variant="outline" className="h-8 w-8" disabled={somenteLeitura} aria-label="Adicionar emoji" title="Adicionar emoji">
                  <SmilePlus className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="max-h-[min(28rem,70dvh)] w-80 overflow-y-auto p-3">
                <div className="space-y-4">
                  {GRUPOS_EMOJI.map((grupo) => <div key={grupo.nome} className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">{grupo.nome}</p>
                    <div className="grid grid-cols-6 gap-1">
                      {grupo.emojis.map((emoji) => <Button key={emoji} type="button" variant="ghost" size="icon" className="h-9 w-9 text-xl" aria-label={`Inserir ${emoji}`} onClick={() => inserirEmoji(emoji)}>{emoji}</Button>)}
                    </div>
                  </div>)}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <Textarea ref={campoTextoRef} id="conteudo-texto" maxLength={500} value={selecionado.conteudo} disabled={somenteLeitura} onChange={(e) => mudar({ conteudo: e.target.value })} onBlur={confirmar} />
      </div>
      <div className="space-y-2"><Label>Fonte</Label><Select value={selecionado.fonte_id} disabled={somenteLeitura} onValueChange={(v: FonteTextoId) => mudarEConfirmar({ fonte_id: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FONTES_TEXTO.map((fonte) => <SelectItem key={fonte.id} value={fonte.id}>{fonte.nome}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><div className="flex justify-between"><Label>Tamanho</Label><span className="text-sm text-muted-foreground">{Math.round(Number(selecionado.tamanho_normalizado) * 100)}%</span></div><Slider min={0.02} max={0.3} step={0.005} value={[Number(selecionado.tamanho_normalizado)]} disabled={somenteLeitura} onValueChange={([v]) => mudar({ tamanho_normalizado: v ?? 0.08 })} onValueCommit={confirmar} /></div>
      <div className="space-y-2"><div className="flex justify-between"><Label>Largura da caixa</Label><span className="text-sm text-muted-foreground">{Math.round(Number(selecionado.largura_normalizada) * 100)}%</span></div><Slider min={0.1} max={1} step={0.01} value={[Number(selecionado.largura_normalizada)]} disabled={somenteLeitura} onValueChange={([v]) => mudar({ largura_normalizada: v ?? 0.6 })} onValueCommit={confirmar} /></div>
      <div className="space-y-2"><Label>Cor</Label><div className="flex items-center gap-2"><Input className="h-10 w-14 p-1" type="color" value={selecionado.cor} disabled={somenteLeitura} onChange={(e) => mudar({ cor: e.target.value.toUpperCase() })} onBlur={confirmar} /><div className="flex flex-wrap gap-1">{CORES_TEXTO.map((cor) => <Button key={cor} type="button" size="icon" variant="outline" className="h-8 w-8" style={{ backgroundColor: cor }} aria-label={`Cor ${cor}`} disabled={somenteLeitura} onClick={() => mudarEConfirmar({ cor })} />)}</div></div></div>
      <div className="grid grid-cols-2 gap-2"><Toggle variant="outline" pressed={selecionado.negrito} disabled={somenteLeitura} onPressedChange={(v) => mudarEConfirmar({ negrito: v })}><Bold />Negrito</Toggle><Toggle variant="outline" pressed={selecionado.italico} disabled={somenteLeitura} onPressedChange={(v) => mudarEConfirmar({ italico: v })}><Italic />Itálico</Toggle></div>
      <div className="space-y-2"><Label>Alinhamento</Label><div className="grid grid-cols-3 gap-2">{([['ESQUERDA', AlignLeft], ['CENTRO', AlignCenter], ['DIREITA', AlignRight]] as const).map(([valor, Icone]) => <Button key={valor} type="button" size="icon" variant={selecionado.alinhamento === valor ? "secondary" : "outline"} disabled={somenteLeitura} aria-label={valor.toLowerCase()} onClick={() => mudarEConfirmar({ alinhamento: valor as AlinhamentoTexto })}><Icone className="h-4 w-4" /></Button>)}</div></div>
      <div className="space-y-2"><Label>Rotação</Label><Select value={String(selecionado.rotacao)} disabled={somenteLeitura} onValueChange={(v) => mudarEConfirmar({ rotacao: Number(v) as RotacaoTexto })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[0, 90, 180, 270].map((graus) => <SelectItem key={graus} value={String(graus)}>{graus}°</SelectItem>)}</SelectContent></Select></div>
      <div className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" disabled={somenteLeitura} onClick={() => onMover(selecionado, -1)}><ArrowDown className="mr-2 h-4 w-4" />Abaixo</Button><Button type="button" variant="outline" disabled={somenteLeitura} onClick={() => onMover(selecionado, 1)}><ArrowUp className="mr-2 h-4 w-4" />Acima</Button></div>
      <div className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" disabled={somenteLeitura} onClick={() => onDuplicar(selecionado)}><Copy className="mr-2 h-4 w-4" />Duplicar</Button><Button type="button" variant="destructive" disabled={somenteLeitura} onClick={() => onExcluir(selecionado)}><Trash2 className="mr-2 h-4 w-4" />Excluir</Button></div>
      <Button type="button" variant="outline" className="w-full" disabled={somenteLeitura || aplicandoTodas || quantidadeOutrasFotos === 0} onClick={aplicarEmTodas}>{aplicandoTodas ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Images className="mr-2 h-4 w-4" />}{aplicandoTodas ? "Aplicando..." : "Aplicar em todas as fotos"}</Button>
    </>}
  </div>;
}
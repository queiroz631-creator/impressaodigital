import { useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Plus, Ruler } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissoes } from "@/hooks/usePermissoes";
import { useFormatos, usePapeis } from "../hooks/useFotoExpress";
import { capacidadeEstimadaFormato } from "../lib/montagem";
import type { Formato, PapelFoto } from "../types";

type CategoriaFormato = "FORMATO_PADRAO" | "DOCUMENTO" | "POLAROID" | "PADRAO_POLAROID";
type FiltroCategoria = "TODOS" | CategoriaFormato;

const CATEGORIAS: Array<{ valor: CategoriaFormato; nome: string }> = [
  { valor: "FORMATO_PADRAO", nome: "Formato padrão" },
  { valor: "DOCUMENTO", nome: "Documento" },
  { valor: "POLAROID", nome: "Polaroid" },
  { valor: "PADRAO_POLAROID", nome: "Padrão Polaroid" },
];

function nomeCategoria(categoria: string) {
  return CATEGORIAS.find((item) => item.valor === categoria)?.nome ?? "Formato padrão";
}

export function FormatosPagina() {
  const { data = [], isLoading } = useFormatos(true); const { data: papeis = [] } = usePapeis(); const qc = useQueryClient(); const [edicao, setEdicao] = useState<Partial<Formato> | null>(null); const [filtro, setFiltro] = useState<FiltroCategoria>("TODOS");
  const { user } = useAuth(); const { pode, carregando } = usePermissoes(user?.id); const podeGerenciar = pode("foto_express.formatos.gerenciar");
  const alternar = useMutation({ mutationFn: async (f: Formato) => { const { error } = await supabase.from("foto_express_formatos").update({ ativo: !f.ativo }).eq("id", f.id); if (error) throw error; }, onSuccess: () => void qc.invalidateQueries({ queryKey: ["foto-express", "formatos"] }), onError: (e: Error) => toast.error(e.message) });
  const formatosFiltrados = filtro === "TODOS" ? data : data.filter((formato) => formato.categoria === filtro);
  return <><PageHeader titulo="Formatos" subtitulo="Tamanhos disponíveis no FOTO EXPRESS" /><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div className="w-full space-y-2 sm:max-w-64"><Label htmlFor="filtro-categoria">Categoria</Label><Select value={filtro} onValueChange={(valor: FiltroCategoria) => setFiltro(valor)}><SelectTrigger id="filtro-categoria"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos</SelectItem>{CATEGORIAS.map((categoria) => <SelectItem key={categoria.valor} value={categoria.valor}>{categoria.nome}</SelectItem>)}</SelectContent></Select></div>{!carregando && podeGerenciar && <Button onClick={() => setEdicao({ ativo: true, visivel_portal: true, ordem: data.length * 10 + 10, categoria: "FORMATO_PADRAO", papel_padrao_id: papeis[0]?.id ?? null, cor_card: "#0EA5E9" })}><Plus className="mr-2 h-4 w-4" />Novo formato</Button>}</div>{isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}{!isLoading && formatosFiltrados.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum formato nesta categoria.</p>}<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{formatosFiltrados.map((f) => { const papel = papeis.find((p) => p.id === f.papel_padrao_id); const estilo = { "--formato-cor": f.cor_card } as CSSProperties; return <Card key={f.id} style={estilo} className="border-l-[6px] border-l-[var(--formato-cor)] bg-[color-mix(in_oklab,var(--formato-cor)_8%,var(--color-card))]"><CardContent className="flex items-center gap-4 p-4"><div className="flex h-12 w-12 items-center justify-center rounded-md border border-[var(--formato-cor)] bg-[color-mix(in_oklab,var(--formato-cor)_18%,var(--color-card))]"><Ruler className="h-6 w-6 text-foreground" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{f.nome}</p>{f.padrao && <Badge variant="secondary">Padrão</Badge>}{!f.visivel_portal && <Badge variant="outline">Oculto no portal</Badge>}</div><p className="text-sm text-muted-foreground">{Number(f.largura_cm)} × {Number(f.altura_cm)} cm</p><p className="mt-1 text-xs text-muted-foreground">{nomeCategoria(f.categoria)} · {papel?.nome ?? "Sem papel padrão"}</p></div>{podeGerenciar && <div className="flex items-center gap-2"><Switch checked={f.ativo} onCheckedChange={() => alternar.mutate(f)} aria-label={`Ativar ${f.nome}`} /><Button variant="outline" size="sm" onClick={() => setEdicao(f)}>Editar</Button></div>}</CardContent></Card>; })}</div>{edicao && podeGerenciar && <DialogFormato formato={edicao} papeis={papeis} onClose={() => setEdicao(null)} onSaved={() => { setEdicao(null); void qc.invalidateQueries({ queryKey: ["foto-express", "formatos"] }); }} />}</>;
}
function DialogFormato({ formato, papeis, onClose, onSaved }: { formato: Partial<Formato>; papeis: PapelFoto[]; onClose: () => void; onSaved: () => void }) {
  const percentual = (valor: number) => String(Math.round(valor * 1000) / 10);
  const [nome, setNome] = useState(formato.nome ?? "");
  const [nomePortal, setNomePortal] = useState(formato.nome_portal ?? "");
  const [largura, setLargura] = useState(String(formato.largura_cm ?? ""));
  const [altura, setAltura] = useState(String(formato.altura_cm ?? ""));
  const [categoria, setCategoria] = useState<CategoriaFormato>((formato.categoria as CategoriaFormato | undefined) ?? "FORMATO_PADRAO");
  const [papelId, setPapelId] = useState(formato.papel_padrao_id ?? papeis[0]?.id ?? "");
  const [bordaEsquerda, setBordaEsquerda] = useState(percentual(Number(formato.area_foto_x ?? 0)));
  const [bordaSuperior, setBordaSuperior] = useState(percentual(Number(formato.area_foto_y ?? 0)));
  const [bordaDireita, setBordaDireita] = useState(percentual(1 - Number(formato.area_foto_x ?? 0) - Number(formato.area_foto_largura ?? 1)));
  const [bordaInferior, setBordaInferior] = useState(percentual(1 - Number(formato.area_foto_y ?? 0) - Number(formato.area_foto_altura ?? 1)));
  const [corFundo, setCorFundo] = useState(formato.cor_fundo ?? "#FFFFFF");
  const [corCard, setCorCard] = useState(formato.cor_card ?? "#0EA5E9");
  const [visivelPortal, setVisivelPortal] = useState(formato.visivel_portal ?? true);

  const numero = (valor: string) => Number(valor.replace(",", "."));
  const l = numero(largura);
  const a = numero(altura);
  const esquerda = numero(bordaEsquerda);
  const direita = numero(bordaDireita);
  const superior = numero(bordaSuperior);
  const inferior = numero(bordaInferior);
  const bordasValidas = [esquerda, direita, superior, inferior].every((valor) => Number.isFinite(valor) && valor >= 0 && valor < 100);
  const horizontalValida = bordasValidas && esquerda + direita < 100;
  const verticalValida = bordasValidas && superior + inferior < 100;
  const papel = papeis.find((item) => item.id === papelId);
  const capacidade = papel && Number.isFinite(l) && Number.isFinite(a) && l > 0 && a > 0 ? capacidadeEstimadaFormato({ largura_cm: l, altura_cm: a }, papel) : 0;

  const salvar = useMutation({
    mutationFn: async () => {
      if (!nome.trim() || !Number.isFinite(l) || !Number.isFinite(a) || l <= 0 || a <= 0) throw new Error("Informe nome, largura e altura válidos.");
      if (!papelId) throw new Error("Escolha o papel padrão deste formato.");
      if (!bordasValidas) throw new Error("Informe bordas entre 0% e 99,9%.");
      if (!horizontalValida) throw new Error("As bordas esquerda e direita precisam deixar espaço para a foto.");
      if (!verticalValida) throw new Error("As bordas superior e inferior precisam deixar espaço para a foto.");
      const campos = {
        nome: nome.trim(),
        nome_portal: nomePortal.trim() || null,
        largura_cm: l,
        altura_cm: a,
        codigo: formato.codigo ?? `PERSONALIZADO-${crypto.randomUUID()}`,
        ordem: formato.ordem ?? 100,
        categoria,
        papel_padrao_id: papelId,
        area_foto_x: esquerda / 100,
        area_foto_y: superior / 100,
        area_foto_largura: (100 - esquerda - direita) / 100,
        area_foto_altura: (100 - superior - inferior) / 100,
        cor_fundo: corFundo.toUpperCase(),
        cor_card: corCard.toUpperCase(),
        visivel_portal: visivelPortal,
      };
      const { error } = formato.id
        ? await supabase.from("foto_express_formatos").update(campos).eq("id", formato.id)
        : await supabase.from("foto_express_formatos").insert(campos);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Formato salvo."); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return <Dialog open onOpenChange={(v) => !v && onClose()}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{formato.id ? "Editar formato" : "Novo formato"}</DialogTitle></DialogHeader><div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_15rem]"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={100} /></div><div className="space-y-2 sm:col-span-2"><Label>Nome exibido no portal</Label><Input value={nomePortal} onChange={(e) => setNomePortal(e.target.value)} maxLength={100} placeholder={nome || "Nome para o cliente"} /></div><div className="flex items-center justify-between gap-4 rounded-md border p-3 sm:col-span-2"><div><Label htmlFor="visivel-portal-formato">Mostrar no portal</Label><p className="text-xs text-muted-foreground">Permite que clientes escolham este formato.</p></div><Switch id="visivel-portal-formato" checked={visivelPortal} onCheckedChange={setVisivelPortal} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="categoria-formato">Categoria</Label><Select value={categoria} onValueChange={(valor: CategoriaFormato) => setCategoria(valor)}><SelectTrigger id="categoria-formato"><SelectValue /></SelectTrigger><SelectContent>{CATEGORIAS.map((item) => <SelectItem key={item.valor} value={item.valor}>{item.nome}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Largura (cm)</Label><Input inputMode="decimal" value={largura} onChange={(e) => setLargura(e.target.value)} /></div><div className="space-y-2"><Label>Altura (cm)</Label><Input inputMode="decimal" value={altura} onChange={(e) => setAltura(e.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="papel-padrao-formato">Papel padrão para montagem</Label><Select value={papelId} onValueChange={setPapelId}><SelectTrigger id="papel-padrao-formato"><SelectValue placeholder="Escolha o papel" /></SelectTrigger><SelectContent>{papeis.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome} · {Number(item.largura_mm)} × {Number(item.altura_mm)} mm</SelectItem>)}</SelectContent></Select>{papel && <p className="text-sm font-medium text-primary">Cabem aproximadamente {capacidade} foto(s) por folha.</p>}</div><div className="space-y-2 sm:col-span-2"><Label htmlFor="cor-card-formato">Cor de identificação do card</Label><div className="flex items-center gap-3"><Input id="cor-card-formato" type="color" className="h-10 w-16 shrink-0 cursor-pointer p-1" value={corCard} onChange={(e) => setCorCard(e.target.value)} /><Input value={corCard.toUpperCase()} onChange={(e) => { const valor = e.target.value.toUpperCase(); if (/^#[0-9A-F]{0,6}$/.test(valor)) setCorCard(valor); }} maxLength={7} aria-label="Código da cor do card" /></div><p className="text-xs text-muted-foreground">Identifica este formato nos cards da Galeria e de Formatos.</p></div><div className="sm:col-span-2 border-t pt-4"><p className="font-medium">Bordas da foto</p><p className="text-xs text-muted-foreground">Percentuais relativos ao formato completo.</p></div><CampoArea label="Superior (%)" value={bordaSuperior} onChange={setBordaSuperior} /><CampoArea label="Direita (%)" value={bordaDireita} onChange={setBordaDireita} /><CampoArea label="Inferior (%)" value={bordaInferior} onChange={setBordaInferior} /><CampoArea label="Esquerda (%)" value={bordaEsquerda} onChange={setBordaEsquerda} /><div className="space-y-2 sm:col-span-2"><Label>Cor de fundo da impressão</Label><Input type="color" className="h-10" value={corFundo} onChange={(e) => setCorFundo(e.target.value)} /></div>{!horizontalValida && <p className="text-sm text-destructive sm:col-span-2">Diminua as bordas esquerda ou direita.</p>}{horizontalValida && !verticalValida && <p className="text-sm text-destructive sm:col-span-2">Diminua as bordas superior ou inferior.</p>}</div><MiniaturaFormato largura={l} altura={a} superior={superior} direita={direita} inferior={inferior} esquerda={esquerda} corFundo={corFundo} corCard={corCard} valida={horizontalValida && verticalValida} /></div><DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => salvar.mutate()} disabled={salvar.isPending || !papelId || !horizontalValida || !verticalValida || !/^#[0-9A-F]{6}$/i.test(corCard)}>Salvar</Button></DialogFooter></DialogContent></Dialog>;
}
function CampoArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) { const id = `borda-${label.toLowerCase().replace(/[^a-z]/g, "-")}`; return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} type="number" min={0} max={99.9} step={0.1} value={value} onChange={(e) => onChange(e.target.value)} /></div>; }

function MiniaturaFormato({ largura, altura, superior, direita, inferior, esquerda, corFundo, corCard, valida }: { largura: number; altura: number; superior: number; direita: number; inferior: number; esquerda: number; corFundo: string; corCard: string; valida: boolean }) {
  const proporcao = Number.isFinite(largura) && Number.isFinite(altura) && largura > 0 && altura > 0 ? largura / altura : 0.7;
  const limitar = (valor: number) => Number.isFinite(valor) ? Math.min(100, Math.max(0, valor)) : 0;
  const estilo = { "--formato-cor": /^#[0-9A-F]{6}$/i.test(corCard) ? corCard : "#0EA5E9" } as CSSProperties;
  return <div className="space-y-3 border-t pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0"><div><p className="font-medium">Miniatura de teste</p><p className="text-xs text-muted-foreground">Atualizada enquanto você ajusta.</p></div><div style={estilo} className="flex min-h-72 items-center justify-center rounded-md border-l-[6px] border-l-[var(--formato-cor)] bg-[color-mix(in_oklab,var(--formato-cor)_10%,var(--color-muted))] p-4"><div className="relative max-h-64 w-full max-w-52 overflow-hidden border shadow-sm" style={{ aspectRatio: proporcao, backgroundColor: corFundo }}><div className="absolute flex items-center justify-center overflow-hidden border border-dashed border-primary bg-accent text-accent-foreground" style={{ top: `${limitar(superior)}%`, right: `${limitar(direita)}%`, bottom: `${limitar(inferior)}%`, left: `${limitar(esquerda)}%` }}><div className="flex flex-col items-center gap-1 text-center"><ImageIcon className="h-7 w-7" /><span className="text-xs font-medium">Área da foto</span></div></div></div></div><div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>Foto: {valida ? `${Math.max(0, 100 - esquerda - direita).toFixed(1)}%` : "—"} larg.</span><span>Foto: {valida ? `${Math.max(0, 100 - superior - inferior).toFixed(1)}%` : "—"} alt.</span></div></div>;
}

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Ruler } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useFormatos } from "../hooks/useFotoExpress";
import type { Formato } from "../types";

export function FormatosPagina() {
  const { data = [], isLoading } = useFormatos(true); const qc = useQueryClient(); const [edicao, setEdicao] = useState<Partial<Formato> | null>(null);
  const alternar = useMutation({ mutationFn: async (f: Formato) => { const { error } = await supabase.from("foto_express_formatos").update({ ativo: !f.ativo }).eq("id", f.id); if (error) throw error; }, onSuccess: () => void qc.invalidateQueries({ queryKey: ["foto-express", "formatos"] }), onError: (e: Error) => toast.error(e.message) });
  return <><PageHeader titulo="Formatos" subtitulo="Tamanhos disponíveis no FOTO EXPRESS" /><div className="mb-4 flex justify-end"><Button onClick={() => setEdicao({ ativo: true, ordem: data.length * 10 + 10 })}><Plus className="mr-2 h-4 w-4" />Novo formato</Button></div>{isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.map((f) => <Card key={f.id}><CardContent className="flex items-center gap-4 p-4"><div className="flex h-12 w-12 items-center justify-center rounded-md bg-accent"><Ruler className="h-6 w-6 text-accent-foreground" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{f.nome}</p>{f.padrao && <Badge variant="secondary">Padrão</Badge>}</div><p className="text-sm text-muted-foreground">{Number(f.largura_cm)} × {Number(f.altura_cm)} cm</p></div><div className="flex items-center gap-2"><Switch checked={f.ativo} onCheckedChange={() => alternar.mutate(f)} aria-label={`Ativar ${f.nome}`} /><Button variant="outline" size="sm" onClick={() => setEdicao(f)}>Editar</Button></div></CardContent></Card>)}</div>{edicao && <DialogFormato formato={edicao} onClose={() => setEdicao(null)} onSaved={() => { setEdicao(null); void qc.invalidateQueries({ queryKey: ["foto-express", "formatos"] }); }} />}</>;
}
function DialogFormato({ formato, onClose, onSaved }: { formato: Partial<Formato>; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState(formato.nome ?? ""); const [largura, setLargura] = useState(String(formato.largura_cm ?? "")); const [altura, setAltura] = useState(String(formato.altura_cm ?? ""));
  const salvar = useMutation({ mutationFn: async () => { const l = Number(largura.replace(",", ".")); const a = Number(altura.replace(",", ".")); if (!nome.trim() || l <= 0 || a <= 0) throw new Error("Informe nome, largura e altura válidos."); const campos = { nome: nome.trim(), largura_cm: l, altura_cm: a, codigo: formato.codigo ?? `PERSONALIZADO-${crypto.randomUUID()}`, ordem: formato.ordem ?? 100 }; const { error } = formato.id ? await supabase.from("foto_express_formatos").update(campos).eq("id", formato.id) : await supabase.from("foto_express_formatos").insert(campos); if (error) throw error; }, onSuccess: () => { toast.success("Formato salvo."); onSaved(); }, onError: (e: Error) => toast.error(e.message) });
  return <Dialog open onOpenChange={(v) => !v && onClose()}><DialogContent><DialogHeader><DialogTitle>{formato.id ? "Editar formato" : "Novo formato"}</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div><div className="space-y-2"><Label>Largura (cm)</Label><Input inputMode="decimal" value={largura} onChange={(e) => setLargura(e.target.value)} /></div><div className="space-y-2"><Label>Altura (cm)</Label><Input inputMode="decimal" value={altura} onChange={(e) => setAltura(e.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar</Button></DialogFooter></DialogContent></Dialog>;
}

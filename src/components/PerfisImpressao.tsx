import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePerfisImpressao } from "@/hooks/useDados";
import { testarPerfil } from "@/lib/impressora";
import {
  PERFIL_VAZIO,
  TAMANHOS_PERFIL,
  resumoPerfil,
  rotuloCor,
  rotuloDuplex,
  rotuloOrientacao,
  rotuloQualidade,
  type CorImpressao,
  type DuplexPerfil,
  type OrientacaoPerfil,
  type PerfilImpressao,
  type QualidadeImpressao,
} from "@/lib/perfil-impressao";

interface Props {
  /** Impressoras detectadas pelo QZ Tray. */
  impressorasDetectadas: string[];
  /** Impressoras cadastradas nas configurações. */
  impressorasConfiguradas: string[];
}

type Rascunho = Omit<PerfilImpressao, "id"> & { id?: string };

export function PerfisImpressao({ impressorasDetectadas, impressorasConfiguradas }: Props) {
  const { data: perfis, isLoading } = usePerfisImpressao();
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState<Rascunho>({ ...PERFIL_VAZIO });
  const [salvando, setSalvando] = useState(false);

  const impressoras = Array.from(
    new Set([...impressorasConfiguradas, ...impressorasDetectadas].map((n) => n.trim()).filter(Boolean)),
  );

  function set<K extends keyof Rascunho>(campo: K, valor: Rascunho[K]) {
    setRascunho((r) => ({ ...r, [campo]: valor }));
  }

  useEffect(() => {
    if (!aberto) return;
    const medidas = TAMANHOS_PERFIL[rascunho.tamanho];
    if (medidas) {
      setRascunho((r) =>
        r.largura_mm === medidas.largura && r.altura_mm === medidas.altura
          ? r
          : { ...r, largura_mm: medidas.largura, altura_mm: medidas.altura },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rascunho.tamanho, aberto]);

  function novo() {
    const ordem = (perfis?.length ?? 0) + 1;
    setRascunho({ ...PERFIL_VAZIO, ordem });
    setAberto(true);
  }

  function editar(p: PerfilImpressao) {
    setRascunho({ ...p });
    setAberto(true);
  }

  function duplicar(p: PerfilImpressao) {
    const { id: _ignorado, ...resto } = p;
    setRascunho({ ...resto, nome: `${p.nome} (cópia)`, ordem: (perfis?.length ?? 0) + 1 });
    setAberto(true);
  }

  async function salvar() {
    if (!rascunho.nome.trim()) {
      toast.error("Informe o nome do perfil.");
      return;
    }
    setSalvando(true);
    const payload = {
      nome: rascunho.nome.trim(),
      impressora: rascunho.impressora?.trim() || null,
      midia: rascunho.midia ?? "",
      qualidade: rascunho.qualidade,
      bandeja: rascunho.bandeja?.trim() || null,
      tamanho: rascunho.tamanho,
      largura_mm: Number(rascunho.largura_mm) || 210,
      altura_mm: Number(rascunho.altura_mm) || 297,
      cor: rascunho.cor,
      duplex: rascunho.duplex,
      copias: Math.max(1, Number(rascunho.copias) || 1),
      orientacao: rascunho.orientacao,
      ativo: rascunho.ativo,
      ordem: Number(rascunho.ordem) || 1,
    };
    const { error } = rascunho.id
      ? await supabase.from("perfis_impressao").update(payload).eq("id", rascunho.id)
      : await supabase.from("perfis_impressao").insert(payload);
    setSalvando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["perfis-impressao"] });
    setAberto(false);
    toast.success("Perfil salvo.");
  }

  async function excluir(p: PerfilImpressao) {
    const { error } = await supabase.from("perfis_impressao").delete().eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["perfis-impressao"] });
    await queryClient.invalidateQueries({ queryKey: ["materiais"] });
    toast.success("Perfil excluído.");
  }

  async function mover(p: PerfilImpressao, direcao: -1 | 1) {
    const lista = [...(perfis ?? [])];
    const i = lista.findIndex((x) => x.id === p.id);
    const j = i + direcao;
    if (i < 0 || j < 0 || j >= lista.length) return;
    const outro = lista[j]!;
    await supabase.from("perfis_impressao").update({ ordem: outro.ordem }).eq("id", p.id);
    await supabase.from("perfis_impressao").update({ ordem: p.ordem }).eq("id", outro.id);
    await queryClient.invalidateQueries({ queryKey: ["perfis-impressao"] });
  }

  async function testar(p: PerfilImpressao) {
    const resultado = await testarPerfil(p, impressorasConfiguradas[0] ?? null);
    if (resultado.metodo === "qz") toast.success("Página de teste enviada.");
    else toast.error(resultado.mensagem ?? "Não foi possível imprimir.");
  }

  return (
    <Card className="max-w-3xl shadow-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base">Perfis de impressão</CardTitle>
          <p className="text-xs text-muted-foreground">
            Papel, qualidade, bandeja, tamanho, cor e frente e verso usados por cada material.
          </p>
        </div>
        <Button onClick={novo}>
          <Plus className="h-4 w-4" /> Novo perfil
        </Button>
      </CardHeader>
      <CardContent className="grid gap-2">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!isLoading && (perfis?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum perfil cadastrado.</p>
        )}
        {(perfis ?? []).map((p, i) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3"
          >
            <div className="min-w-48 flex-1">
              <p className="text-sm font-semibold">
                {p.nome} {!p.ativo && <span className="text-xs text-muted-foreground">(inativo)</span>}
              </p>
              <p className="text-xs text-muted-foreground">{resumoPerfil(p)}</p>
              <p className="text-xs text-muted-foreground">
                Impressora: {p.impressora || "padrão das configurações"}
                {p.bandeja ? ` · Bandeja: ${p.bandeja}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" title="Subir" onClick={() => void mover(p, -1)} disabled={i === 0}>
                ↑
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Descer"
                onClick={() => void mover(p, 1)}
                disabled={i === (perfis?.length ?? 0) - 1}
              >
                ↓
              </Button>
              <Button variant="ghost" size="icon" title="Imprimir teste" onClick={() => void testar(p)}>
                <Printer className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Duplicar" onClick={() => duplicar(p)}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Editar" onClick={() => editar(p)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Excluir" onClick={() => void excluir(p)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{rascunho.id ? "Editar perfil" : "Novo perfil"}</DialogTitle>
            <DialogDescription>
              Estas opções são enviadas à impressora quando o material usar este perfil.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nome do perfil</Label>
              <Input
                value={rascunho.nome}
                placeholder="Ex.: Couché 180g A4 Alta"
                onChange={(e) => set("nome", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Impressora</Label>
              <Select
                value={rascunho.impressora ?? "padrao"}
                onValueChange={(v) => set("impressora", v === "padrao" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Usar a padrão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="padrao">Usar a impressora padrão</SelectItem>
                  {impressoras.map((nome) => (
                    <SelectItem key={nome} value={nome}>
                      {nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de papel / mídia</Label>
              <Input
                value={rascunho.midia}
                placeholder="Ex.: Comum, Couché, Etiqueta"
                onChange={(e) => set("midia", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Qualidade</Label>
              <Select
                value={rascunho.qualidade}
                onValueChange={(v) => set("qualidade", v as QualidadeImpressao)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(rotuloQualidade).map(([valor, rotulo]) => (
                    <SelectItem key={valor} value={valor}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Origem do documento (bandeja)</Label>
              <Input
                value={rascunho.bandeja ?? ""}
                placeholder="Ex.: Bandeja 1, Manual"
                onChange={(e) => set("bandeja", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tamanho do documento</Label>
              <Select value={rascunho.tamanho} onValueChange={(v) => set("tamanho", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(TAMANHOS_PERFIL).map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Largura (mm)</Label>
                <Input
                  type="number"
                  value={rascunho.largura_mm}
                  disabled={rascunho.tamanho !== "personalizado"}
                  onChange={(e) => set("largura_mm", Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Altura (mm)</Label>
                <Input
                  type="number"
                  value={rascunho.altura_mm}
                  disabled={rascunho.tamanho !== "personalizado"}
                  onChange={(e) => set("altura_mm", Number(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <Select value={rascunho.cor} onValueChange={(v) => set("cor", v as CorImpressao)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(rotuloCor).map(([valor, rotulo]) => (
                    <SelectItem key={valor} value={valor}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Frente e verso</Label>
              <Select value={rascunho.duplex} onValueChange={(v) => set("duplex", v as DuplexPerfil)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(rotuloDuplex).map(([valor, rotulo]) => (
                    <SelectItem key={valor} value={valor}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Orientação</Label>
              <Select
                value={rascunho.orientacao}
                onValueChange={(v) => set("orientacao", v as OrientacaoPerfil)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(rotuloOrientacao).map(([valor, rotulo]) => (
                    <SelectItem key={valor} value={valor}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cópias padrão</Label>
              <Input
                type="number"
                min={1}
                value={rascunho.copias}
                onChange={(e) => set("copias", Math.max(1, Number(e.target.value) || 1))}
              />
            </div>

            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch checked={rascunho.ativo} onCheckedChange={(v) => set("ativo", v)} />
              <Label>Perfil ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void salvar()} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar perfil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

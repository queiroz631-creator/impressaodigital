import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Save, Trash2, ArrowUp, ArrowDown, ShieldAlert, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmarExclusao } from "@/components/ConfirmarExclusao";
import { AcabamentosTabela } from "@/components/AcabamentosTabela";
import { PrecosExcel } from "@/components/PrecosExcel";
import { useMateriais, useConfiguracao, usePerfisImpressao } from "@/hooks/useDados";
import { resumoPerfil } from "@/lib/perfil-impressao";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import {
  faixasParaTexto,
  textoParaFaixas,
  FORMATOS,
  CATEGORIAS_MATERIAL,
  normalizarAreasImpressao,
  type AreasImpressao,
  type Material,
  type TipoServico,
  type FormatoPapel,
  type CategoriaMaterial,
} from "@/lib/calc";


export const Route = createFileRoute("/precos")({
  component: () => (
    <AppLayout>
      <Precos />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Configurar Preços | Impressão Digital" },
      {
        name: "description",
        content: "Cadastre materiais e ajuste os preços por página de cada tipo de papel.",
      },
      { property: "og:title", content: "Configurar Preços | Impressão Digital" },
      { property: "og:description", content: "Gerencie materiais e preços de impressão." },
    ],
  }),
});

/** Converte texto digitado (aceita vírgula) em número. */
function parsePreco(valor: string) {
  const limpo = valor.replace(/[^\d,.-]/g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

function Precos() {
  const { user } = useAuth();
  const { data: isAdmin, isLoading: carregandoPapel } = useIsAdmin(user?.id);
  const { data: materiais, isLoading } = useMateriais();
  const { data: perfis } = usePerfisImpressao(true);
  const { data: configuracao } = useConfiguracao();
  const queryClient = useQueryClient();
  const [linhas, setLinhas] = useState<Material[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [faixasTexto, setFaixasTexto] = useState<Record<string, string>>({});
  const [faixasArquivosTexto, setFaixasArquivosTexto] = useState<Record<string, string>>({});
  const [faixasCopiasTexto, setFaixasCopiasTexto] = useState<Record<string, string>>({});
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [areas, setAreas] = useState<AreasImpressao | null>(null);
  const [salvandoAreas, setSalvandoAreas] = useState(false);

  useEffect(() => {
    if (!configuracao || areas) return;
    setAreas(normalizarAreasImpressao(configuracao.areas_impressao));
  }, [configuracao, areas]);

  async function salvarAreas() {
    if (!configuracao || !areas) return;
    setSalvandoAreas(true);
    try {
      const { error } = await supabase
        .from("configuracoes")
        .update({ areas_impressao: areas as unknown as never })
        .eq("id", configuracao.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["configuracoes"] });
      toast.success("Área de impressão salva.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvandoAreas(false);
    }
  }

  useEffect(() => {
    if (!materiais) return;

    setLinhas(
      materiais.map((m) => ({
        ...m,
        faixas_por_arquivo: m.faixas_por_arquivo ?? [],
        faixas_por_copia_adicional: m.faixas_por_copia_adicional ?? [],
        categoria: (m.categoria ?? "impressao") as CategoriaMaterial,

        quantidade_arquivos_fixo: m.quantidade_arquivos_fixo ?? 3,
        preco_arquivos_fixo: m.preco_arquivos_fixo ?? 0,
      })),
    );

    setFaixasTexto(Object.fromEntries(materiais.map((m) => [m.id, faixasParaTexto(m.faixas ?? [])])));

    setFaixasArquivosTexto(
      Object.fromEntries(materiais.map((m) => [m.id, faixasParaTexto(m.faixas_por_arquivo ?? [])])),
    );

    setFaixasCopiasTexto(
      Object.fromEntries(
        materiais.map((m) => [m.id, faixasParaTexto(m.faixas_por_copia_adicional ?? [])]),
      ),
    );
  }, [materiais]);


  function atualizar(id: string, campo: keyof Material, valor: unknown) {
    setLinhas((atual) => atual.map((m) => (m.id === id ? { ...m, [campo]: valor } : m)));
  }

  function mover(index: number, delta: number) {
    setLinhas((atual) => {
      const copia = [...atual];
      const destino = index + delta;
      if (destino < 0 || destino >= copia.length) return atual;
      const a = copia[index]!;
      const b = copia[destino]!;
      copia[index] = b;
      copia[destino] = a;
      return copia.map((m, i) => ({ ...m, ordem: i + 1 }));
    });
  }

  /** Persiste um material e devolve as faixas já normalizadas. */
  async function salvarMaterial(m: Material) {
    if (Number(m.preco_pb) < 0) {
      throw new Error("Preços não podem ser negativos.");
    }
    const faixas = textoParaFaixas(faixasTexto[m.id] ?? "");
    const faixasArquivos = textoParaFaixas(faixasArquivosTexto[m.id] ?? "");
    const faixasCopias = textoParaFaixas(faixasCopiasTexto[m.id] ?? "");
    const { error } = await supabase
      .from("materiais")
      .update({
        nome: m.nome,
        descricao: m.descricao,

        preco_pb: Number(m.preco_pb),

        preco_por_arquivo: Number(m.preco_por_arquivo) || 0,
        quantidade_arquivos_fixo: Math.max(0, Number(m.quantidade_arquivos_fixo) || 0),

        preco_arquivos_fixo: Math.max(0, Number(m.preco_arquivos_fixo) || 0),

        faixas: faixas as unknown as never,

        faixas_por_arquivo: faixasArquivos as unknown as never,

        faixas_por_copia_adicional: faixasCopias as unknown as never,

        tipo_impressao: m.tipo_impressao ?? "simples",

        categoria: m.categoria ?? "impressao",

        formato: m.formato ?? "A4",

        perfil_impressao_id: m.perfil_impressao_id ?? null,




        ativo: m.ativo,
        ordem: m.ordem,
      })
      .eq("id", m.id);
    if (error) throw error;
    return {
      faixas: faixasParaTexto(faixas),
      faixasArquivos: faixasParaTexto(faixasArquivos),
      faixasCopias: faixasParaTexto(faixasCopias),
    };
  }

  async function salvar() {
    setSalvando(true);
    try {
      const faixasNormalizadas: Record<string, string> = {};
      const faixasArquivosNormalizadas: Record<string, string> = {};
      const faixasCopiasNormalizadas: Record<string, string> = {};
      for (const m of linhas) {
        const normalizado = await salvarMaterial(m);
        faixasNormalizadas[m.id] = normalizado.faixas;
        faixasArquivosNormalizadas[m.id] = normalizado.faixasArquivos;
        faixasCopiasNormalizadas[m.id] = normalizado.faixasCopias;
      }
      setFaixasTexto(faixasNormalizadas);
      setFaixasArquivosTexto(faixasArquivosNormalizadas);
      setFaixasCopiasTexto(faixasCopiasNormalizadas);

      queryClient.invalidateQueries({ queryKey: ["materiais"] });
      toast.success("Preço atualizado com sucesso.");
    } catch (e) {
      console.error("ERRO AO SALVAR MATERIAL:", e);

      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  /** Salva apenas o material aberto no modal de valores/faixas. */
  async function salvarUm(m: Material) {
    setSalvando(true);
    try {
      const normalizado = await salvarMaterial(m);
      setFaixasTexto((f) => ({ ...f, [m.id]: normalizado.faixas }));
      setFaixasArquivosTexto((f) => ({ ...f, [m.id]: normalizado.faixasArquivos }));
      setFaixasCopiasTexto((f) => ({ ...f, [m.id]: normalizado.faixasCopias }));
      queryClient.invalidateQueries({ queryKey: ["materiais"] });
      toast.success("Valores do material atualizados.");
      setEditandoId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function adicionar() {
    try {
      // Desloca os materiais existentes para baixo para abrir espaço no início
      for (const m of linhas) {
        const { error } = await supabase
          .from("materiais")
          .update({ ordem: m.ordem + 1 })
          .eq("id", m.id);
        if (error) throw error;
      }
      const { error } = await supabase
        .from("materiais")
        .insert({ nome: "Novo material", descricao: "", ordem: 1, categoria: "impressao" });

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["materiais"] });
      toast.success("Material adicionado no início.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao adicionar.");
    }
  }

  async function excluir(id: string) {
    const { error } = await supabase.from("materiais").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["materiais"] });
    toast.success("Material excluído.");
  }

  if (carregandoPapel) return <Skeleton className="h-64 w-full" />;

  if (!isAdmin) {
    return (
      <>
        <PageHeader titulo="CONFIGURAR PREÇOS" />
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">Acesso restrito</p>
            <p className="text-sm text-muted-foreground">
              Somente administradores podem configurar materiais e preços.
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="CONFIGURAR PREÇOS"
        subtitulo="Valores por página, valor cobrado por arquivo e faixas de preço por quantidade."
      />
      <Tabs defaultValue="materiais">
        <TabsList className="mb-4">
          <TabsTrigger value="materiais">Materiais</TabsTrigger>
          <TabsTrigger value="acabamentos">Acabamentos</TabsTrigger>
          <TabsTrigger value="area-impressao">Área de impressão</TabsTrigger>
        </TabsList>
        <TabsContent value="materiais">
          <p className="mb-4 text-xs text-muted-foreground">
            Faixas: uma por linha no formato <span className="font-mono">quantidade = valor</span> (ex.:{" "}
            <span className="font-mono">500 = 0,08</span>). Pode colar vários valores de uma vez. A partir da quantidade
            informada, o preço unitário passa a ser o da faixa.
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={adicionar}>
              <Plus className="h-4 w-4" /> Adicionar material
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              <Save className="h-4 w-4" /> {salvando ? "Salvando..." : "Salvar Alterações"}
            </Button>
            <PrecosExcel
              tipo="materiais"
              dados={materiais}
              aoImportar={() => queryClient.invalidateQueries({ queryKey: ["materiais"] })}
            />
          </div>

          <Card className="shadow-card">
            <CardContent className="overflow-x-auto py-4">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <table className="w-full min-w-[960px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-bold tracking-wider text-muted-foreground">
                      <th className="px-2 py-3">TIPO</th>
                      <th className="px-2 py-3">DESCRIÇÃO</th>
                      <th className="px-2 py-3 w-40">IMPRESSÃO / CÓPIA</th>
                      <th className="px-2 py-3 w-44">TIPO DE IMPRESSÃO</th>
                      <th className="px-2 py-3 w-44">FORMATO</th>
                      <th className="px-2 py-3 w-20">ATIVO</th>
                      <th className="px-2 py-3 w-28">ORDEM</th>
                      <th className="px-2 py-3 w-28">EDITAR</th>
                      <th className="px-2 py-3 w-16" />
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((m, i) => (
                      <tr key={m.id} className="border-b border-border">
                        <td className="px-2 py-2">
                          <Input value={m.nome} onChange={(e) => atualizar(m.id, "nome", e.target.value)} />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            value={m.descricao ?? ""}
                            onChange={(e) => atualizar(m.id, "descricao", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Select
                            value={m.categoria ?? "impressao"}
                            onValueChange={(v) =>
                              atualizar(m.id, "categoria", v as CategoriaMaterial)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIAS_MATERIAL.map((c) => (
                                <SelectItem key={c.valor} value={c.valor}>
                                  {c.rotulo}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-2">
                          <Select
                            value={m.tipo_impressao ?? "simples"}
                            onValueChange={(v) => atualizar(m.id, "tipo_impressao", v as TipoServico)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="simples">Impressão Simples</SelectItem>
                              <SelectItem value="especial">Impressão Especial</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>

                        <td className="px-2 py-2">
                          <Select
                            value={m.formato ?? "A4"}
                            onValueChange={(v) => atualizar(m.id, "formato", v as FormatoPapel)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FORMATOS.map((f) => (
                                <SelectItem key={f.valor} value={f.valor}>
                                  {f.rotulo}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-2">
                          <Switch checked={m.ativo} onCheckedChange={(v) => atualizar(m.id, "ativo", v)} />
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => mover(i, -1)}>
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => mover(i, 1)}>
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <Button size="sm" onClick={() => setEditandoId(m.id)}>
                            <Pencil className="h-4 w-4" /> Editar
                          </Button>
                        </td>
                        <td className="px-2 py-2">
                          <ConfirmarExclusao onConfirmar={() => excluir(m.id)}>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </ConfirmarExclusao>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="acabamentos">
          <AcabamentosTabela />
        </TabsContent>
        <TabsContent value="area-impressao">
          <Card className="shadow-card">
            <CardContent className="space-y-4 p-4">
              <p className="text-xs text-muted-foreground">
                Área imprimível (em mm) de cada formato. Usada no cálculo de TAGs da calculadora.
              </p>
              {areas &&
                FORMATOS.map((f) => (
                  <div key={f.valor} className="flex flex-wrap items-center gap-3">
                    <Label className="w-32 text-sm font-bold">{f.rotulo}</Label>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Largura (mm)</Label>
                      <Input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        className="w-24"
                        value={areas[f.valor].largura || ""}
                        onChange={(e) =>
                          setAreas({
                            ...areas,
                            [f.valor]: { ...areas[f.valor], largura: Math.max(1, Number(e.target.value) || 0) },
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Altura (mm)</Label>
                      <Input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        className="w-24"
                        value={areas[f.valor].altura || ""}
                        onChange={(e) =>
                          setAreas({
                            ...areas,
                            [f.valor]: { ...areas[f.valor], altura: Math.max(1, Number(e.target.value) || 0) },
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
              <div>
                <Button onClick={salvarAreas} disabled={salvandoAreas || !areas}>
                  <Save className="h-4 w-4" /> {salvandoAreas ? "Salvando..." : "Salvar Área de Impressão"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editandoId} onOpenChange={(aberto) => !aberto && setEditandoId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {(() => {
            const m = linhas.find((l) => l.id === editandoId);
            if (!m) return null;
            return (
              <>
                <DialogHeader>
                  <DialogTitle>Valores — {m.nome}</DialogTitle>
                  <DialogDescription>
                    Faixas: uma por linha no formato{" "}
                    <span className="font-mono">quantidade = valor</span>.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Preço uni.</Label>
                    <Input
                      inputMode="decimal"
                      value={String(m.preco_pb ?? 0)}
                      onChange={(e) => atualizar(m.id, "preco_pb", parsePreco(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Qtd. fixa de arquivos</Label>
                    <Input
                      inputMode="numeric"
                      value={String(m.quantidade_arquivos_fixo ?? 0)}
                      onChange={(e) =>
                        atualizar(
                          m.id,
                          "quantidade_arquivos_fixo",
                          Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Valor fixo</Label>
                    <Input
                      inputMode="decimal"
                      value={String(m.preco_arquivos_fixo ?? 0)}
                      onChange={(e) =>
                        atualizar(m.id, "preco_arquivos_fixo", parsePreco(e.target.value))
                      }
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Preço por arquivo excedente</Label>
                    <Input
                      inputMode="decimal"
                      value={String(m.preco_por_arquivo ?? 0)}
                      onChange={(e) =>
                        atualizar(m.id, "preco_por_arquivo", parsePreco(e.target.value))
                      }
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Perfil de impressão</Label>
                    <Select
                      value={m.perfil_impressao_id ?? "nenhum"}
                      onValueChange={(v) =>
                        atualizar(m.id, "perfil_impressao_id", v === "nenhum" ? null : v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Nenhum</SelectItem>
                        {(perfis ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {m.perfil_impressao_id
                        ? resumoPerfil(
                            (perfis ?? []).find((p) => p.id === m.perfil_impressao_id) ?? null,
                          )
                        : "Define papel, qualidade, bandeja, tamanho, cor e frente e verso ao imprimir."}
                    </p>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Faixas por páginas</Label>
                    <Textarea
                      rows={4}
                      value={faixasTexto[m.id] ?? ""}
                      onChange={(e) =>
                        setFaixasTexto((f) => ({ ...f, [m.id]: e.target.value }))
                      }
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Faixas por arquivos excedentes</Label>
                    <Textarea
                      rows={4}
                      value={faixasArquivosTexto[m.id] ?? ""}
                      onChange={(e) =>
                        setFaixasArquivosTexto((f) => ({ ...f, [m.id]: e.target.value }))
                      }
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Faixas por cópias adicionais</Label>
                    <Textarea
                      rows={4}
                      value={faixasCopiasTexto[m.id] ?? ""}
                      onChange={(e) =>
                        setFaixasCopiasTexto((f) => ({ ...f, [m.id]: e.target.value }))
                      }
                      className="font-mono text-xs"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditandoId(null)}>
                    Cancelar
                  </Button>
                  <Button disabled={salvando} onClick={() => salvarUm(m)}>
                    <Save className="h-4 w-4" /> Salvar
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAcabamentos } from "@/hooks/useDados";
import { PrecosExcel } from "@/components/PrecosExcel";
import { ConfirmarExclusao } from "@/components/ConfirmarExclusao";
import {
  faixasParaTexto,
  rotuloCobranca,
  rotuloTipoServico,
  textoParaFaixas,
  type Acabamento,
  type CobrancaAcabamento,
  type TipoServicoAcabamento,
} from "@/lib/calc";

const COBRANCAS: CobrancaAcabamento[] = ["quantidade", "bloco", "pagina", "fixo"];
const TIPOS: TipoServicoAcabamento[] = ["simples", "especial", "ambas"];

export function AcabamentosTabela() {
  const { data: acabamentos, isLoading } = useAcabamentos();
  const queryClient = useQueryClient();
  const [linhas, setLinhas] = useState<Acabamento[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [faixasTexto, setFaixasTexto] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!acabamentos) return;
    setLinhas(acabamentos.map((a) => ({ ...a })));
    setFaixasTexto(
      Object.fromEntries(acabamentos.map((a) => [a.id, faixasParaTexto(a.faixas ?? [])])),
    );
  }, [acabamentos]);

  function atualizar(id: string, campo: keyof Acabamento, valor: unknown) {
    setLinhas((atual) => atual.map((a) => (a.id === id ? { ...a, [campo]: valor } : a)));
  }

  async function salvar() {
    setSalvando(true);
    try {
      const normalizadas: Record<string, string> = {};
      for (const a of linhas) {
        const faixas = textoParaFaixas(faixasTexto[a.id] ?? "");
        const { error } = await supabase
          .from("acabamentos")
          .update({
            nome: a.nome,
            cobranca: a.cobranca,
            valor: Number(a.valor) || 0,
            paginas_bloco: Math.max(1, Number(a.paginas_bloco) || 1),
            faixas: faixas as unknown as never,
            tipo_impressao: a.tipo_impressao ?? "ambas",
            mostrar_nao_incluso: !!a.mostrar_nao_incluso,
            mostrar_no_orcamento: a.mostrar_no_orcamento !== false,
            ativo: a.ativo,
            ordem: Number(a.ordem) || 0,
          })
          .eq("id", a.id);
        if (error) throw error;
        normalizadas[a.id] = faixasParaTexto(faixas);
      }
      setFaixasTexto(normalizadas);
      queryClient.invalidateQueries({ queryKey: ["acabamentos"] });
      toast.success("Acabamentos atualizados com sucesso.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function adicionar() {
    const { error } = await supabase
      .from("acabamentos")
      .insert({ nome: "Novo acabamento", cobranca: "quantidade", ordem: linhas.length + 1 });
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["acabamentos"] });
    toast.success("Acabamento adicionado.");
  }

  async function excluir(id: string) {
    const { error } = await supabase.from("acabamentos").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["acabamentos"] });
    toast.success("Acabamento excluído.");
  }

  return (
    <>
      <p className="mb-4 text-xs text-muted-foreground">
        Cobrança: <strong>Por unidade</strong> (quantidade informada na calculadora),{" "}
        <strong>Por bloco de páginas</strong> (ex.: corte a cada 100 páginas),{" "}
        <strong>Por página</strong> ou <strong>Valor fixo</strong> por trabalho. Faixas: uma por
        linha no formato <span className="font-mono">quantidade = valor</span> (ex.:{" "}
        <span className="font-mono">6 = 2,50</span>) — a partir daquela quantidade o valor unitário
        passa a ser o da faixa.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={adicionar}>
          <Plus className="h-4 w-4" /> Adicionar acabamento
        </Button>
        <Button onClick={salvar} disabled={salvando}>
          <Save className="h-4 w-4" /> {salvando ? "Salvando..." : "Salvar Alterações"}
        </Button>
        <PrecosExcel
          tipo="acabamentos"
          dados={acabamentos}
          aoImportar={() => queryClient.invalidateQueries({ queryKey: ["acabamentos"] })}
        />
      </div>

      <Card className="shadow-card">
        <CardContent className="overflow-x-auto py-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold tracking-wider text-muted-foreground">
                  <th className="px-2 py-3">ACABAMENTO</th>
                  <th className="px-2 py-3 w-44">TIPO DE IMPRESSÃO</th>
                  <th className="px-2 py-3 w-56">COBRANÇA</th>
                  <th className="px-2 py-3 w-32">VALOR</th>
                  <th className="px-2 py-3 w-60">FAIXAS POR QUANTIDADE</th>
                  <th className="px-2 py-3 w-40">PÁGINAS POR BLOCO</th>
                  <th className="px-2 py-3 w-32">NÃO INCLUSO</th>
                  <th className="px-2 py-3 w-40">APARECER NO ORÇAMENTO</th>
                  <th className="px-2 py-3 w-20">ATIVO</th>
                  <th className="px-2 py-3 w-24">ORDEM</th>
                  <th className="px-2 py-3 w-16" />
                </tr>
              </thead>
              <tbody>
                {linhas.map((a) => (
                  <tr key={a.id} className="border-b border-border">
                    <td className="px-2 py-2">
                      <Input value={a.nome} onChange={(e) => atualizar(a.id, "nome", e.target.value)} />
                    </td>
                    <td className="px-2 py-2">
                      <Select
                        value={a.tipo_impressao ?? "ambas"}
                        onValueChange={(v) =>
                          atualizar(a.id, "tipo_impressao", v as TipoServicoAcabamento)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS.map((t) => (
                            <SelectItem key={t} value={t}>
                              {rotuloTipoServico[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-2">
                      <Select
                        value={a.cobranca}
                        onValueChange={(v) => atualizar(a.id, "cobranca", v as CobrancaAcabamento)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COBRANCAS.map((c) => (
                            <SelectItem key={c} value={c}>
                              {rotuloCobranca[c]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={a.valor}
                        onChange={(e) => atualizar(a.id, "valor", e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Textarea
                        rows={3}
                        placeholder={"1 = 3,00\n6 = 2,50\n21 = 2,00"}
                        value={faixasTexto[a.id] ?? ""}
                        onChange={(e) =>
                          setFaixasTexto((f) => ({ ...f, [a.id]: e.target.value }))
                        }
                        onBlur={() =>
                          setFaixasTexto((f) => ({
                            ...f,
                            [a.id]: faixasParaTexto(textoParaFaixas(f[a.id] ?? "")),
                          }))
                        }
                        className="min-w-[14rem] font-mono text-xs"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        min="1"
                        disabled={a.cobranca !== "bloco"}
                        value={a.paginas_bloco}
                        onChange={(e) => atualizar(a.id, "paginas_bloco", e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Switch
                        checked={!!a.mostrar_nao_incluso}
                        onCheckedChange={(v) => atualizar(a.id, "mostrar_nao_incluso", v)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Switch
                        checked={a.mostrar_no_orcamento !== false}
                        onCheckedChange={(v) => atualizar(a.id, "mostrar_no_orcamento", v)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Switch checked={a.ativo} onCheckedChange={(v) => atualizar(a.id, "ativo", v)} />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        min="0"
                        value={a.ordem}
                        onChange={(e) => atualizar(a.id, "ordem", e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <ConfirmarExclusao onConfirmar={() => excluir(a.id)}>
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
    </>
  );
}

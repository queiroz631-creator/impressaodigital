import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { rotuloCobranca, type Acabamento, type CobrancaAcabamento } from "@/lib/calc";

const COBRANCAS: CobrancaAcabamento[] = ["quantidade", "bloco", "pagina", "fixo"];

export function AcabamentosTabela() {
  const { data: acabamentos, isLoading } = useAcabamentos();
  const queryClient = useQueryClient();
  const [linhas, setLinhas] = useState<Acabamento[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (acabamentos) setLinhas(acabamentos.map((a) => ({ ...a })));
  }, [acabamentos]);

  function atualizar(id: string, campo: keyof Acabamento, valor: unknown) {
    setLinhas((atual) => atual.map((a) => (a.id === id ? { ...a, [campo]: valor } : a)));
  }

  async function salvar() {
    setSalvando(true);
    try {
      for (const a of linhas) {
        const { error } = await supabase
          .from("acabamentos")
          .update({
            nome: a.nome,
            cobranca: a.cobranca,
            valor: Number(a.valor) || 0,
            paginas_bloco: Math.max(1, Number(a.paginas_bloco) || 1),
            ativo: a.ativo,
            ordem: Number(a.ordem) || 0,
          })
          .eq("id", a.id);
        if (error) throw error;
      }
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
        <strong>Por página</strong> ou <strong>Valor fixo</strong> por trabalho.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={adicionar}>
          <Plus className="h-4 w-4" /> Adicionar acabamento
        </Button>
        <Button onClick={salvar} disabled={salvando}>
          <Save className="h-4 w-4" /> {salvando ? "Salvando..." : "Salvar Alterações"}
        </Button>
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
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold tracking-wider text-muted-foreground">
                  <th className="px-2 py-3">ACABAMENTO</th>
                  <th className="px-2 py-3 w-56">COBRANÇA</th>
                  <th className="px-2 py-3 w-32">VALOR</th>
                  <th className="px-2 py-3 w-40">PÁGINAS POR BLOCO</th>
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
                      <Input
                        type="number"
                        min="1"
                        disabled={a.cobranca !== "bloco"}
                        value={a.paginas_bloco}
                        onChange={(e) => atualizar(a.id, "paginas_bloco", e.target.value)}
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
                      <Button variant="ghost" size="icon" onClick={() => excluir(a.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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

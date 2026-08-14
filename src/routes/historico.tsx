import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Trash2, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCalculos } from "@/hooks/useDados";
import { brl, dataHoraBR } from "@/lib/format";

export const Route = createFileRoute("/historico")({
  component: () => (
    <AppLayout>
      <Historico />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Histórico de Cálculos | Impressão Digital" },
      { name: "description", content: "Consulte todos os cálculos de impressão já realizados." },
      { property: "og:title", content: "Histórico de Cálculos | Impressão Digital" },
      { property: "og:description", content: "Filtre e pesquise os cálculos realizados." },
    ],
  }),
});

const rotuloTipo: Record<string, string> = {
  pb: "PB",
  color: "Colorida",
  ambas: "Ambas",
};

function Historico() {
  const { data: calculos, isLoading } = useCalculos();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");

  const filtrados = useMemo(() => {
    return (calculos ?? []).filter((c) => {
      const texto = `${c.cliente_nome ?? ""} ${c.material_nome ?? ""}`.toLowerCase();
      if (busca && !texto.includes(busca.toLowerCase())) return false;
      if (inicio && new Date(c.created_at) < new Date(`${inicio}T00:00:00`)) return false;
      if (fim && new Date(c.created_at) > new Date(`${fim}T23:59:59`)) return false;
      return true;
    });
  }, [calculos, busca, inicio, fim]);

  async function excluir(id: string) {
    const { error } = await supabase.from("calculos").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["calculos"] });
    toast.success("Cálculo excluído.");
  }

  return (
    <>
      <PageHeader titulo="HISTÓRICO DE CÁLCULOS" subtitulo="Todos os cálculos salvos no sistema." />

      <Card className="mb-4 shadow-card">
        <CardContent className="grid gap-4 py-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="busca">Pesquisar</Label>
            <div className="relative">
              <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="busca"
                className="pl-9"
                placeholder="Cliente ou material"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inicio">Data inicial</Label>
            <Input id="inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fim">Data final</Label>
            <Input id="fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="overflow-x-auto py-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtrados.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <History className="h-10 w-10 text-muted-foreground" />
              <p className="font-semibold">Nenhum cálculo realizado ainda</p>
              <p className="text-sm text-muted-foreground">
                Informe a quantidade de arquivos e páginas para começar.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold tracking-wider text-muted-foreground">
                  <th className="px-3 py-3">DATA</th>
                  <th className="px-3 py-3">CLIENTE</th>
                  <th className="px-3 py-3">ARQUIVOS</th>
                  <th className="px-3 py-3">PÁGINAS</th>
                  <th className="px-3 py-3">TIPO</th>
                  <th className="px-3 py-3">MATERIAL</th>
                  <th className="px-3 py-3 text-right">VALOR</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id} className="border-b border-border">
                    <td className="px-3 py-3">{dataHoraBR(c.created_at)}</td>
                    <td className="px-3 py-3 font-semibold">{c.cliente_nome || "-"}</td>
                    <td className="px-3 py-3">{c.quantidade_arquivos}</td>
                    <td className="px-3 py-3">{c.paginas_total}</td>
                    <td className="px-3 py-3">
                      <Badge variant="secondary">{rotuloTipo[c.tipo_impressao] ?? c.tipo_impressao}</Badge>
                    </td>
                    <td className="px-3 py-3">{c.material_nome || "-"}</td>
                    <td className="px-3 py-3 text-right font-bold text-success">
                      {brl(Number(c.valor_total))}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => excluir(c.id)}>
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
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileDown, FileText, Image as ImageIcon, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmarExclusao } from "@/components/ConfirmarExclusao";
import { useConfiguracao, useOrcamentos } from "@/hooks/useDados";
import { brl, dataBR } from "@/lib/format";
import { documentoDeOrcamentos } from "@/lib/orcamento-doc";
import { gerarOrcamentoPdf } from "@/lib/pdf";
import { gerarOrcamentoImagem } from "@/lib/imagem";
import { STATUS_ORCAMENTO, normalizarStatus, rotuloStatus } from "@/lib/status";

export const Route = createFileRoute("/orcamentos")({
  component: () => (
    <AppLayout>
      <Orcamentos />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Orçamentos | Impressão Digital" },
      { name: "description", content: "Consulte, filtre por status e reemita orçamentos em PDF ou imagem." },
      { property: "og:title", content: "Orçamentos | Impressão Digital" },
      { property: "og:description", content: "Gestão dos orçamentos gerados pelo sistema." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Orcamentos() {
  const { data: orcamentos, isLoading } = useOrcamentos();
  const { data: config } = useConfiguracao();
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState("todos");

  const lista = useMemo(() => {
    return (orcamentos ?? []).filter((o) =>
      filtro === "todos" ? true : normalizarStatus(o.status) === filtro,
    );
  }, [orcamentos, filtro]);

  async function alterarStatus(id: string, status: string) {
    const { error } = await supabase.from("orcamentos").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
    toast.success("Status atualizado com sucesso.");
  }

  async function excluir(id: string) {
    const { error } = await supabase.from("orcamentos").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
    toast.success("Orçamento excluído.");
  }

  function documento(orc: Record<string, unknown>) {
    return documentoDeOrcamentos([orc], config, {
      numero: String(orc["numero"]),
      data: String(orc["created_at"]),
      clienteNome: String(orc["cliente_nome"] ?? ""),
      clienteTelefone: (orc["cliente_telefone"] as string | null) ?? null,
      validade: (orc["validade"] as string | null) ?? null,
      observacao: (orc["observacao"] as string | null) ?? null,
    });
  }

  return (
    <>
      <PageHeader titulo="ORÇAMENTOS" subtitulo="Todos os orçamentos gerados pelo sistema." />

      <Card className="mb-4 shadow-card">
        <CardContent className="grid gap-2 py-4 sm:max-w-xs">
          <Label>Filtrar por status</Label>
          <Select value={filtro} onValueChange={setFiltro}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {STATUS_ORCAMENTO.map((s) => (
                <SelectItem key={s} value={s}>
                  {rotuloStatus[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          ) : lista.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="font-semibold">Nenhum orçamento encontrado</p>
              <p className="text-sm text-muted-foreground">
                Use a calculadora e clique em Adicionar ao Pedido.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold tracking-wider text-muted-foreground">
                  <th className="px-3 py-3">NÚMERO</th>
                  <th className="px-3 py-3">DATA</th>
                  <th className="px-3 py-3">CLIENTE</th>
                  <th className="px-3 py-3">MATERIAL</th>
                  <th className="px-3 py-3 text-right">PÁGINAS</th>
                  <th className="px-3 py-3 text-right">VALOR</th>
                  <th className="px-3 py-3">STATUS</th>
                  <th className="px-3 py-3 text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((o) => (
                  <tr key={o.id} className="border-b border-border">
                    <td className="px-3 py-3 font-semibold">{o.numero}</td>
                    <td className="px-3 py-3">{dataBR(o.created_at)}</td>
                    <td className="px-3 py-3">{o.cliente_nome || "-"}</td>
                    <td className="px-3 py-3">{o.material_nome || "-"}</td>
                    <td className="px-3 py-3 text-right">{o.paginas_total ?? 0}</td>
                    <td className="px-3 py-3 text-right font-bold text-success">
                      {brl(Number(o.valor_total))}
                    </td>
                    <td className="px-3 py-3">
                      <Select
                        value={normalizarStatus(o.status)}
                        onValueChange={(v) => alterarStatus(o.id, v)}
                      >
                        <SelectTrigger className="h-8 w-48">
                          <SelectValue>
                            <Badge variant="secondary">{rotuloStatus[normalizarStatus(o.status)]}</Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_ORCAMENTO.map((s) => (
                            <SelectItem key={s} value={s}>
                              {rotuloStatus[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Gerar PDF"
                        onClick={() => gerarOrcamentoPdf(documento(o as unknown as Record<string, unknown>))}
                      >
                        <FileDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Gerar Imagem"
                        onClick={() => gerarOrcamentoImagem(documento(o as unknown as Record<string, unknown>))}
                      >
                        <ImageIcon className="h-4 w-4" />
                      </Button>
                      <ConfirmarExclusao onConfirmar={() => excluir(o.id)}>
                        <Button variant="ghost" size="icon" title="Excluir">
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

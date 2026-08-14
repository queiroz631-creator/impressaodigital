import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileDown, FileText, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfiguracao, useOrcamentos } from "@/hooks/useDados";
import { brl, dataBR } from "@/lib/format";
import { gerarOrcamentoPdf } from "@/lib/pdf";

export const Route = createFileRoute("/orcamentos")({
  component: () => (
    <AppLayout>
      <Orcamentos />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Orçamentos | Impressão Digital" },
      { name: "description", content: "Consulte, atualize o status e reemita orçamentos em PDF." },
      { property: "og:title", content: "Orçamentos | Impressão Digital" },
      { property: "og:description", content: "Gestão dos orçamentos gerados pelo sistema." },
    ],
  }),
});

const STATUS = ["rascunho", "enviado", "aprovado", "recusado", "expirado"];

function Orcamentos() {
  const { data: orcamentos, isLoading } = useOrcamentos();
  const { data: config } = useConfiguracao();
  const queryClient = useQueryClient();

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

  async function baixarPdf(orc: Record<string, unknown>) {
    const calculoId = orc["calculo_id"] as string | null;
    let calculo: Record<string, unknown> | null = null;
    if (calculoId) {
      const { data } = await supabase.from("calculos").select("*").eq("id", calculoId).maybeSingle();
      calculo = data as Record<string, unknown> | null;
    }
    const paginasPb = Number(calculo?.["paginas_pb"] ?? 0);
    const paginasColor = Number(calculo?.["paginas_color"] ?? 0);
    const paginasTotal = Number(calculo?.["paginas_total"] ?? paginasPb + paginasColor);
    const valorTotal = Number(orc["valor_total"] ?? 0);
    gerarOrcamentoPdf({
      numero: String(orc["numero"]),
      data: String(orc["created_at"]),
      empresaNome: config?.empresa_nome ?? "Impressão Digital",
      empresaTelefone: config?.telefone,
      empresaEmail: config?.email,
      empresaEndereco: config?.endereco,
      rodape:
        config?.rodape_orcamento ??
        "Orçamento gerado pelo sistema de Calculadora de Impressão Digital.",
      clienteNome: String(orc["cliente_nome"] ?? ""),
      clienteTelefone: (orc["cliente_telefone"] as string | null) ?? null,
      quantidadeArquivos: Number(calculo?.["quantidade_arquivos"] ?? 0),
      paginasTotal,
      paginasPb,
      paginasColor,
      tipoImpressao: String(calculo?.["tipo_impressao"] ?? "-"),
      material: String(orc["material_nome"] ?? "-"),
      valorUnitario: paginasTotal > 0 ? valorTotal / paginasTotal : 0,
      valorTotal,
      validade: (orc["validade"] as string | null) ?? null,
      observacao: (orc["observacao"] as string | null) ?? null,
    });
  }

  return (
    <>
      <PageHeader titulo="ORÇAMENTOS" subtitulo="Todos os orçamentos gerados pelo sistema." />
      <Card className="shadow-card">
        <CardContent className="overflow-x-auto py-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (orcamentos ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="font-semibold">Nenhum orçamento gerado ainda</p>
              <p className="text-sm text-muted-foreground">
                Use a calculadora e clique em Gerar Orçamento.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold tracking-wider text-muted-foreground">
                  <th className="px-3 py-3">NÚMERO</th>
                  <th className="px-3 py-3">DATA</th>
                  <th className="px-3 py-3">CLIENTE</th>
                  <th className="px-3 py-3">TELEFONE</th>
                  <th className="px-3 py-3 text-right">VALOR</th>
                  <th className="px-3 py-3">STATUS</th>
                  <th className="px-3 py-3 text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {(orcamentos ?? []).map((o) => (
                  <tr key={o.id} className="border-b border-border">
                    <td className="px-3 py-3 font-semibold">{o.numero}</td>
                    <td className="px-3 py-3">{dataBR(o.created_at)}</td>
                    <td className="px-3 py-3">{o.cliente_nome}</td>
                    <td className="px-3 py-3">{o.cliente_telefone || "-"}</td>
                    <td className="px-3 py-3 text-right font-bold text-success">
                      {brl(Number(o.valor_total))}
                    </td>
                    <td className="px-3 py-3">
                      <Select value={o.status} onValueChange={(v) => alterarStatus(o.id, v)}>
                        <SelectTrigger className="h-8 w-36">
                          <SelectValue>
                            <Badge variant="secondary" className="capitalize">
                              {o.status}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS.map((s) => (
                            <SelectItem key={s} value={s} className="capitalize">
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => baixarPdf(o)}>
                        <FileDown className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => excluir(o.id)}>
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
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

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
      {
        title: "Orçamentos | Impressão Digital",
      },
      {
        name: "description",
        content: "Consulte, filtre por status e reemita pedidos de orçamento em PDF ou imagem.",
      },
      {
        property: "og:title",
        content: "Orçamentos | Impressão Digital",
      },
      {
        property: "og:description",
        content: "Gestão dos pedidos de orçamento do sistema.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
    ],
  }),
});

function Orcamentos() {
  const { data: orcamentos, isLoading } = useOrcamentos();

  const { data: config } = useConfiguracao();

  const queryClient = useQueryClient();

  const [filtro, setFiltro] = useState("todos");

  /*
   * ============================================================
   * FILTRA OS ORÇAMENTOS
   * ============================================================
   */

  const listaFiltrada = useMemo(() => {
    return (orcamentos ?? []).filter((o) => (filtro === "todos" ? true : normalizarStatus(o.status) === filtro));
  }, [orcamentos, filtro]);

  /*
   * ============================================================
   * AGRUPA OS ORÇAMENTOS PELO PEDIDO
   * ============================================================
   */

  const pedidos = useMemo(() => {
    const grupos = new Map<
      string,
      {
        pedidoId: string;
        numero: string;
        data: string;
        clienteNome: string;
        clienteTelefone: string | null;
        validade: string | null;
        observacao: string | null;
        itens: Record<string, unknown>[];
        total: number;
        status: string;
      }
    >();

    for (const orc of listaFiltrada) {
      /*
       * O pedido_id é o campo que une os vários
       * orçamentos pertencentes ao mesmo pedido.
       */

      const pedidoId = String(orc.pedido_id ?? orc.id);

      if (!grupos.has(pedidoId)) {
        grupos.set(pedidoId, {
          pedidoId,

          numero: String(orc.numero ?? "-"),

          data: String(orc.created_at ?? ""),

          clienteNome: String(orc.cliente_nome ?? ""),

          clienteTelefone: (orc.cliente_telefone as string | null) ?? null,

          validade: (orc.validade as string | null) ?? null,

          observacao: (orc.observacao as string | null) ?? null,

          itens: [],

          total: 0,

          status: normalizarStatus(orc.status),
        });
      }

      const grupo = grupos.get(pedidoId)!;

      grupo.itens.push(orc as unknown as Record<string, unknown>);

      grupo.total += Number(orc.valor_total ?? 0);
    }

    return Array.from(grupos.values());
  }, [listaFiltrada]);

  /*
   * ============================================================
   * ALTERAR STATUS
   * ============================================================
   */

  async function alterarStatusPedido(itens: Record<string, unknown>[], status: string) {
    const ids = itens.map((o) => String(o.id)).filter(Boolean);

    if (ids.length === 0) return;

    const { error } = await supabase.from("orcamentos").update({ status }).in("id", ids);

    if (error) {
      toast.error(error.message);
      return;
    }

    queryClient.invalidateQueries({
      queryKey: ["orcamentos"],
    });

    toast.success("Status do pedido atualizado com sucesso.");
  }

  /*
   * ============================================================
   * EXCLUIR PEDIDO INTEIRO
   * ============================================================
   */

  async function excluirPedido(itens: Record<string, unknown>[]) {
    const ids = itens.map((o) => String(o.id)).filter(Boolean);

    if (ids.length === 0) return;

    const { error } = await supabase.from("orcamentos").delete().in("id", ids);

    if (error) {
      toast.error(error.message);
      return;
    }

    queryClient.invalidateQueries({
      queryKey: ["orcamentos"],
    });

    toast.success("Pedido e seus orçamentos foram excluídos.");
  }

  /*
   * ============================================================
   * GERAR DOCUMENTO DO PEDIDO
   * ============================================================
   */

  function documentoPedido(pedido: {
    numero: string;
    data: string;
    clienteNome: string;
    clienteTelefone: string | null;
    validade: string | null;
    observacao: string | null;
    itens: Record<string, unknown>[];
  }) {
    return documentoDeOrcamentos(pedido.itens, config, {
      numero: pedido.numero,

      data: pedido.data,

      clienteNome: pedido.clienteNome,

      clienteTelefone: pedido.clienteTelefone,

      validade: pedido.validade,

      observacao: pedido.observacao,
    });
  }

  /*
   * ============================================================
   * TELA
   * ============================================================
   */

  return (
    <>
      <PageHeader titulo="ORÇAMENTOS" subtitulo="Pedidos de orçamento agrupados por pedido." />

      {/* FILTRO */}
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

      {/* LISTA */}
      <Card className="shadow-card">
        <CardContent className="overflow-x-auto py-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({
                length: 5,
              }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : pedidos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />

              <p className="font-semibold">Nenhum pedido encontrado</p>

              <p className="text-sm text-muted-foreground">Use a calculadora e clique em Adicionar ao Pedido.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {pedidos.map((pedido) => (
                <div key={pedido.pedidoId} className="overflow-hidden rounded-xl border border-border">
                  {/* CABEÇALHO DO PEDIDO */}
                  <div className="flex flex-col gap-4 bg-accent/50 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-extrabold text-primary">PEDIDO {pedido.numero}</h2>

                        <Badge variant="secondary">
                          {pedido.itens.length} {pedido.itens.length === 1 ? "item" : "itens"}
                        </Badge>
                      </div>

                      <p className="mt-1 text-sm">
                        <strong>Cliente:</strong> {pedido.clienteNome || "-"}
                      </p>

                      <p className="text-xs text-muted-foreground">Data: {dataBR(pedido.data)}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {/* PDF */}
                      <Button variant="outline" size="sm" onClick={() => gerarOrcamentoPdf(documentoPedido(pedido))}>
                        <FileDown className="h-4 w-4" />
                        PDF
                      </Button>

                      {/* IMAGEM */}
                      <Button variant="outline" size="sm" onClick={() => gerarOrcamentoImagem(documentoPedido(pedido))}>
                        <ImageIcon className="h-4 w-4" />
                        Imagem
                      </Button>

                      {/* STATUS */}
                      <Select
                        value={normalizarStatus(pedido.status)}
                        onValueChange={(v) => alterarStatusPedido(pedido.itens, v)}
                      >
                        <SelectTrigger className="h-9 w-44">
                          <SelectValue>
                            <Badge variant="secondary">{rotuloStatus[normalizarStatus(pedido.status)]}</Badge>
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

                      {/* EXCLUIR */}
                      <ConfirmarExclusao
                        titulo="Excluir pedido"
                        descricao={`Tem certeza que deseja excluir o pedido ${pedido.numero} e todos os seus ${pedido.itens.length} orçamento(s)?`}
                        rotuloConfirmar="Excluir pedido"
                        onConfirmar={() => excluirPedido(pedido.itens)}
                      >
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4 text-destructive" />
                          Excluir
                        </Button>
                      </ConfirmarExclusao>
                    </div>
                  </div>

                  {/* ITENS DO PEDIDO */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs font-bold tracking-wider text-muted-foreground">
                          <th className="px-4 py-3">Nº</th>

                          <th className="px-4 py-3">MATERIAL</th>

                          <th className="px-4 py-3">TIPO</th>

                          <th className="px-4 py-3">FORMATO</th>

                          <th className="px-4 py-3 text-right">PÁGINAS</th>

                          <th className="px-4 py-3 text-right">VALOR</th>
                        </tr>
                      </thead>

                      <tbody>
                        {pedido.itens.map((o, index) => (
                          <tr key={String(o.id)} className="border-b border-border last:border-0">
                            <td className="px-4 py-3 font-bold">{String(index + 1).padStart(2, "0")}</td>

                            <td className="px-4 py-3 font-semibold">{String(o.material_nome ?? "-")}</td>

                            <td className="px-4 py-3 capitalize">{String(o.tipo_impressao ?? "-")}</td>

                            <td className="px-4 py-3">{String(o.tamanho ?? "-")}</td>

                            <td className="px-4 py-3 text-right">{Number(o.paginas_total ?? 0)}</td>

                            <td className="px-4 py-3 text-right font-bold text-success">
                              {brl(Number(o.valor_total ?? 0))}
                            </td>
                          </tr>
                        ))}
                      </tbody>

                      {/* TOTAL DO PEDIDO */}
                      <tfoot>
                        <tr className="bg-accent/50">
                          <td colSpan={5} className="px-4 py-4 text-right font-extrabold">
                            TOTAL DO PEDIDO
                          </td>

                          <td className="px-4 py-4 text-right text-lg font-extrabold text-success">
                            {brl(pedido.total)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

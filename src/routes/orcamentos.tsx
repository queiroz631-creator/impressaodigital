import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { FileDown, FileText, Image as ImageIcon, Trash2, Eye } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

import { AppLayout, PageHeader } from "@/components/AppLayout";

import { Card, CardContent } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";

import { Label } from "@/components/ui/label";

import { Skeleton } from "@/components/ui/skeleton";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

  /*
   * ============================================================
   * FILTRO
   * ============================================================
   */

  const [filtro, setFiltro] = useState("todos");

  /*
   * ============================================================
   * PEDIDO ABERTO NO DIALOG
   * ============================================================
   */

  const [pedidoItensAberto, setPedidoItensAberto] = useState<PedidoAgrupado | null>(null);

  /*
   * ============================================================
   * FILTRA OS ORÇAMENTOS
   * ============================================================
   */

  const listaFiltrada = useMemo(() => {
    return (orcamentos ?? []).filter((orc) => {
      if (filtro === "todos") {
        return true;
      }

      return normalizarStatus(orc.status) === filtro;
    });
  }, [orcamentos, filtro]);

  /*
   * ============================================================
   * AGRUPAMENTO POR PEDIDO
   *
   * Vários registros da tabela "orcamentos"
   * podem possuir o mesmo pedido_id.
   *
   * Aqui transformamos:
   *
   * pedido 1
   *   orçamento A
   *   orçamento B
   *   orçamento C
   *
   * em um único pedido na tela.
   * ============================================================
   */

  const pedidos = useMemo<PedidoAgrupado[]>(() => {
    const grupos = new Map<string, PedidoAgrupado>();

    for (const orc of listaFiltrada) {
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

    /*
     * Ordena os itens de cada pedido pela
     * coluna "ordem", quando existir.
     */

    for (const pedido of grupos.values()) {
      pedido.itens.sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0));
    }

    return Array.from(grupos.values());
  }, [listaFiltrada]);

  /*
   * ============================================================
   * ALTERAR STATUS DO PEDIDO
   *
   * Atualiza todos os orçamentos que pertencem
   * ao mesmo pedido.
   * ============================================================
   */

  async function alterarStatusPedido(itens: Record<string, unknown>[], status: string) {
    const ids = itens.map((item) => String(item.id)).filter(Boolean);

    if (ids.length === 0) {
      return;
    }

    const { error } = await supabase
      .from("orcamentos")
      .update({
        status,
      })
      .in("id", ids);

    if (error) {
      toast.error(error.message);
      return;
    }

    queryClient.invalidateQueries({
      queryKey: ["orcamentos"],
    });

    toast.success("Status do pedido atualizado.");
  }

  /*
   * ============================================================
   * EXCLUIR PEDIDO
   *
   * Exclui todos os orçamentos daquele pedido.
   * ============================================================
   */

  async function excluirPedido(itens: Record<string, unknown>[]) {
    const ids = itens.map((item) => String(item.id)).filter(Boolean);

    if (ids.length === 0) {
      return;
    }

    const { error } = await supabase.from("orcamentos").delete().in("id", ids);

    if (error) {
      toast.error(error.message);
      return;
    }

    queryClient.invalidateQueries({
      queryKey: ["orcamentos"],
    });

    toast.success("Pedido excluído com sucesso.");
  }

  /*
   * ============================================================
   * DOCUMENTO COMPLETO DO PEDIDO
   *
   * Aqui passamos TODOS os itens daquele pedido.
   * Portanto o PDF/imagem será unificado.
   * ============================================================
   */

  function documentoPedido(pedido: PedidoAgrupado) {
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
   * RENDER
   * ============================================================
   */

  return (
    <>
      <PageHeader titulo="ORÇAMENTOS" subtitulo="Consulte e gerencie os pedidos de orçamento." />

      {/* ======================================================
          FILTRO
          ====================================================== */}

      <Card className="mb-6 shadow-card">
        <CardContent className="py-4">
          <div className="grid max-w-xs gap-2">
            <Label>Filtrar por status</Label>

            <Select value={filtro} onValueChange={setFiltro}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>

                {STATUS_ORCAMENTO.map((status) => (
                  <SelectItem key={status} value={status}>
                    {rotuloStatus[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ======================================================
          TABELA DE PEDIDOS
          ====================================================== */}

      <Card className="shadow-card">
        <CardContent className="py-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({
                length: 6,
              }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : pedidos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />

              <p className="font-semibold">Nenhum pedido encontrado</p>

              <p className="text-sm text-muted-foreground">Use a calculadora para criar um novo pedido.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[950px] text-sm">
                {/* CABEÇALHO */}
                <thead>
                  <tr className="border-b border-border bg-accent/60 text-left text-xs font-bold tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Nº PEDIDO</th>

                    <th className="px-4 py-3">DATA</th>

                    <th className="px-4 py-3">CLIENTE</th>

                    <th className="px-4 py-3 text-center">ITENS</th>

                    <th className="px-4 py-3 text-right">VALOR TOTAL</th>

                    <th className="px-4 py-3 text-center">STATUS</th>

                    <th className="px-4 py-3 text-right">AÇÕES</th>
                  </tr>
                </thead>

                {/* CORPO */}
                <tbody>
                  {pedidos.map((pedido) => (
                    <tr
                      key={pedido.pedidoId}
                      className="border-b border-border transition-colors last:border-0 hover:bg-accent/30"
                    >
                      {/* Nº PEDIDO */}
                      <td className="px-4 py-4">
                        <span className="font-bold text-primary">{pedido.numero}</span>
                      </td>

                      {/* DATA */}
                      <td className="whitespace-nowrap px-4 py-4">{dataBR(pedido.data)}</td>

                      {/* CLIENTE */}
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-semibold">{pedido.clienteNome}</p>

                          {pedido.clienteTelefone && (
                            <p className="text-xs text-muted-foreground">{pedido.clienteTelefone}</p>
                          )}
                        </div>
                      </td>

                      {/* ITENS */}
                      <td className="px-4 py-4 text-center">
                        <Badge variant="secondary">{pedido.itens.length}</Badge>
                      </td>

                      {/* TOTAL */}
                      <td className="px-4 py-4 text-right">
                        <span className="text-base font-extrabold text-success">{brl(pedido.total)}</span>
                      </td>

                      {/* STATUS */}
                      <td className="px-4 py-4 text-center">
                        <Select
                          value={normalizarStatus(pedido.status)}
                          onValueChange={(value) => alterarStatusPedido(pedido.itens, value)}
                        >
                          <SelectTrigger className="mx-auto h-9 w-36">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>
                            {STATUS_ORCAMENTO.map((status) => (
                              <SelectItem key={status} value={status}>
                                {rotuloStatus[status]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* AÇÕES */}
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-1">
                          {/* VER ITENS */}
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Ver itens"
                            onClick={() => setPedidoItensAberto(pedido)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {/* PDF */}
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Gerar PDF"
                            onClick={() => gerarOrcamentoPdf(documentoPedido(pedido))}
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>

                          {/* IMAGEM */}
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Gerar imagem"
                            onClick={() => gerarOrcamentoImagem(documentoPedido(pedido))}
                          >
                            <ImageIcon className="h-4 w-4" />
                          </Button>

                          {/* EXCLUIR */}
                          <ConfirmarExclusao
                            titulo="Excluir pedido"
                            descricao={`Tem certeza que deseja excluir o pedido ${pedido.numero} e todos os seus ${pedido.itens.length} item(ns)?`}
                            rotuloConfirmar="Excluir pedido"
                            onConfirmar={() => excluirPedido(pedido.itens)}
                          >
                            <Button variant="ghost" size="icon" title="Excluir pedido">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </ConfirmarExclusao>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ======================================================
          DIALOG - VER ITENS
          ====================================================== */}

      <Dialog
        open={pedidoItensAberto !== null}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setPedidoItensAberto(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Pedido {pedidoItensAberto?.numero ?? "-"}</DialogTitle>

            <DialogDescription>Itens incluídos neste pedido.</DialogDescription>
          </DialogHeader>

          {pedidoItensAberto && (
            <div className="space-y-5">
              {/* ================================================
                  INFORMAÇÕES DO PEDIDO
                  ================================================ */}

              <div className="grid gap-3 rounded-xl border border-border bg-accent/40 p-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">CLIENTE</p>

                  <p className="font-semibold">{pedidoItensAberto.clienteNome || "-"}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground">DATA</p>

                  <p className="font-semibold">{dataBR(pedidoItensAberto.data)}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground">QUANTIDADE DE ITENS</p>

                  <p className="font-semibold">{pedidoItensAberto.itens.length}</p>
                </div>
              </div>

              {/* ================================================
                  TABELA DE ITENS
                  ================================================ */}

              <div className="max-h-[55vh] overflow-auto rounded-xl border border-border">
                <table className="w-full min-w-[750px] text-sm">
                  <thead className="sticky top-0 z-10 bg-accent">
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
                    {pedidoItensAberto.itens.map((item, index) => (
                      <tr key={String(item.id)} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-bold">{String(index + 1).padStart(2, "0")}</td>

                        <td className="px-4 py-3 font-semibold">{String(item.material_nome ?? "-")}</td>

                        <td className="px-4 py-3 capitalize">{String(item.tipo_impressao ?? "-")}</td>

                        <td className="px-4 py-3">{String(item.tamanho ?? "-")}</td>

                        <td className="px-4 py-3 text-right">{Number(item.paginas_total ?? 0)}</td>

                        <td className="px-4 py-3 text-right font-bold text-success">
                          {brl(Number(item.valor_total ?? 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  {/* TOTAL */}
                  <tfoot>
                    <tr className="bg-accent/50">
                      <td colSpan={5} className="px-4 py-4 text-right font-extrabold">
                        TOTAL DO PEDIDO
                      </td>

                      <td className="px-4 py-4 text-right text-lg font-extrabold text-success">
                        {brl(pedidoItensAberto.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* ================================================
                  OBSERVAÇÃO
                  ================================================ */}

              {pedidoItensAberto.observacao && (
                <div className="rounded-xl border border-border bg-accent/30 p-4">
                  <p className="mb-1 text-xs font-bold text-muted-foreground">OBSERVAÇÃO</p>

                  <p className="whitespace-pre-wrap text-sm">{pedidoItensAberto.observacao}</p>
                </div>
              )}

              {/* ================================================
                  BOTÕES
                  ================================================ */}

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => gerarOrcamentoImagem(documentoPedido(pedidoItensAberto))}>
                  <ImageIcon className="h-4 w-4" />
                  Gerar Imagem
                </Button>

                <Button onClick={() => gerarOrcamentoPdf(documentoPedido(pedidoItensAberto))}>
                  <FileDown className="h-4 w-4" />
                  Gerar PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/*
 * ================================================================
 * TIPO DO PEDIDO AGRUPADO
 * ================================================================
 */

type PedidoAgrupado = {
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
};

import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  FileDown,
  FileText,
  Image as ImageIcon,
  Trash2,
  Eye,
  Printer,
  FileStack,
  Tags,
  Pencil,
  Link2 as LinkIcon,
} from "lucide-react";

import { useServerFn } from "@tanstack/react-start";
import { gerarLinkOrcamento } from "@/lib/link.functions";


import { supabase } from "@/integrations/supabase/client";

import { AppLayout, PageHeader } from "@/components/AppLayout";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { ConfirmarExclusao } from "@/components/ConfirmarExclusao";
import { ImprimirEtiqueta } from "@/components/ImprimirEtiqueta";

import { useConfiguracao, useOrcamentos, usePedidos, useMateriais, usePerfisImpressao } from "@/hooks/useDados";
import {
  ImprimirDocumentosDialog,
  type DocumentoParaImprimir,
} from "@/components/impressao/ImprimirDocumentosDialog";
import { PERFIL_VAZIO, type PerfilImpressao } from "@/lib/perfil-impressao";
import type { ArquivoDoc } from "@/lib/documento";
import { useAuth } from "@/hooks/useAuth";


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
      {
        name: "description",
        content: "Consulte por data e status, altere o andamento e imprima etiquetas térmicas dos pedidos.",
      },
      { property: "og:title", content: "Orçamentos | Impressão Digital" },
      { property: "og:description", content: "Gestão dos pedidos de orçamento do sistema." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

/** Data local (fuso do navegador) no formato aceito por <input type="date">. */
function dataLocalISO(valor: Date | string | null | undefined) {
  const data = valor ? new Date(valor) : new Date();
  if (Number.isNaN(data.getTime())) return "";
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/** Situação do pagamento de um pedido. */
function situacaoPagamento(total: number, pago: number) {
  if (pago <= 0) return { rotulo: "NÃO PAGO", classe: "bg-destructive text-destructive-foreground" };
  if (pago + 0.009 < total) return { rotulo: "PARCIAL", classe: "bg-yellow-ink text-sidebar" };
  return { rotulo: "PAGO", classe: "bg-success text-success-foreground" };
}

function Orcamentos() {
  const { data: orcamentos, isLoading } = useOrcamentos();
  const { data: listaPedidos } = usePedidos();
  const { data: config } = useConfiguracao();
  const { data: materiais } = useMateriais();
  const { data: perfis } = usePerfisImpressao();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();



  const hoje = dataLocalISO(new Date());
  const criarLink = useServerFn(gerarLinkOrcamento);

  /* ---------------- FILTRO POR DATA ---------------- */
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);
  const [todasAsDatas, setTodasAsDatas] = useState(false);

  /* ---------------- ABA ATIVA ---------------- */
  const [abaStatus, setAbaStatus] = useState<string>("pendente_envio");
  const [abaTocada, setAbaTocada] = useState(false);

  const [pedidoItensAberto, setPedidoItensAberto] = useState<PedidoAgrupado | null>(null);
  const [pedidoStatusAberto, setPedidoStatusAberto] = useState<PedidoAgrupado | null>(null);
  const [novoStatus, setNovoStatus] = useState<string>("pendente_envio");
  const [salvandoStatus, setSalvandoStatus] = useState(false);
  const [impressaoAberta, setImpressaoAberta] = useState(false);
  const [documentosImpressao, setDocumentosImpressao] = useState<DocumentoParaImprimir[]>([]);

  /* Dados do pedido (fonte principal do status e do pagamento). */
  const mapaPedidos = useMemo(() => {
    const mapa = new Map<string, Record<string, unknown>>();
    for (const p of (listaPedidos ?? []) as unknown as Record<string, unknown>[]) {
      mapa.set(String(p["id"]), p);
    }
    return mapa;
  }, [listaPedidos]);

  /* ---------------- AGRUPAMENTO POR PEDIDO ---------------- */
  const pedidos = useMemo<PedidoAgrupado[]>(() => {
    const grupos = new Map<string, PedidoAgrupado>();

    for (const orc of orcamentos ?? []) {
      const pedidoId = String(orc.pedido_id ?? orc.id);
      const pedidoBase = mapaPedidos.get(pedidoId);

      if (!grupos.has(pedidoId)) {
        grupos.set(pedidoId, {
          pedidoId,
          temPedido: !!pedidoBase,
          numero: String(pedidoBase?.["numero"] ?? orc.numero ?? "-"),
          data: String(pedidoBase?.["created_at"] ?? orc.created_at ?? ""),
          clienteNome: String(pedidoBase?.["cliente_nome"] ?? orc.cliente_nome ?? ""),
          clienteTelefone: String(pedidoBase?.["cliente_telefone"] ?? orc.cliente_telefone ?? "") || null,
          validade: (orc.validade as string | null) ?? null,
          observacao: (orc.observacao as string | null) ?? null,
          itens: [],
          total: 0,
          valorPago: Number(pedidoBase?.["valor_pago"] ?? 0),
          status: normalizarStatus(String(pedidoBase?.["status"] ?? orc.status ?? "")),
        });
      }

      const grupo = grupos.get(pedidoId)!;
      grupo.itens.push(orc as unknown as Record<string, unknown>);
      grupo.total += Number(orc.valor_total ?? 0);
    }

    for (const pedido of grupos.values()) {
      pedido.itens.sort((a, b) => Number(a["ordem"] ?? 0) - Number(b["ordem"] ?? 0));
    }

    return Array.from(grupos.values());
  }, [orcamentos, mapaPedidos]);

  /**
   * Monta a lista de documentos do pedido (com o perfil de impressão do
   * material de cada item) e abre o modal de impressão.
   */
  function imprimirDocumentosPedido(pedido: PedidoAgrupado) {
    const lista: DocumentoParaImprimir[] = [];
    let semArquivo = 0;

    for (const item of pedido.itens) {
      const arquivos = (Array.isArray(item["arquivos"]) ? item["arquivos"] : []) as ArquivoDoc[];
      const comCaminho = arquivos.filter((a) => !!a.caminho);
      semArquivo += arquivos.length - comCaminho.length;
      if (comCaminho.length === 0) continue;

      const material = (materiais ?? []).find((m) => m.id === item["material_id"]);
      const perfil =
        (perfis ?? []).find((p) => p.id === material?.perfil_impressao_id) ??
        ({ ...PERFIL_VAZIO, id: "padrao", nome: "Padrão" } as PerfilImpressao);

      for (const arquivo of comCaminho) {
        lista.push({
          nome: arquivo.nome,
          caminho: arquivo.caminho ?? null,
          paginas: Math.max(0, arquivo.paginas || 0),
          copias: Math.max(1, arquivo.copias ?? 1),
          perfil,
        });
      }
    }

    if (lista.length === 0) {
      toast.error(
        semArquivo > 0
          ? "Os arquivos deste pedido não foram salvos para reimpressão."
          : "Nenhum PDF anexado a este pedido.",
      );
      return;
    }

    setDocumentosImpressao(lista);
    setImpressaoAberta(true);
  }

  /* ---------------- FILTRO POR DATA (fuso local) ---------------- */
  const pedidosNoPeriodo = useMemo(() => {
    if (todasAsDatas) return pedidos;
    return pedidos.filter((p) => {
      const dia = dataLocalISO(p.data);
      if (!dia) return false;
      if (dataInicio && dia < dataInicio) return false;
      if (dataFim && dia > dataFim) return false;
      return true;
    });
  }, [pedidos, todasAsDatas, dataInicio, dataFim]);

  /* ---------------- CONTAGEM POR STATUS (pedidos únicos) ---------------- */
  const contagem = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const p of pedidosNoPeriodo) mapa.set(p.status, (mapa.get(p.status) ?? 0) + 1);
    return mapa;
  }, [pedidosNoPeriodo]);

  const abas = useMemo(
    () => STATUS_ORCAMENTO.filter((s) => (contagem.get(s) ?? 0) > 0),
    [contagem],
  );

  /* Aba inicial: pendente de envio; se vazia, a primeira com pedidos. */
  useEffect(() => {
    if (abas.length === 0) return;
    const valida = abas.includes(abaStatus as (typeof STATUS_ORCAMENTO)[number]);
    if (valida && abaTocada) return;
    if (valida && abaStatus === "pendente_envio") return;
    const preferida = abas.includes("pendente_envio") ? "pendente_envio" : abas[0]!;
    if (!valida) setAbaStatus(preferida);
  }, [abas, abaStatus, abaTocada]);

  const pedidosDaAba = useMemo(
    () => pedidosNoPeriodo.filter((p) => p.status === abaStatus),
    [pedidosNoPeriodo, abaStatus],
  );

  /* ---------------- AÇÕES ---------------- */
  function invalidar(pedidoId?: string) {
    queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
    queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    if (pedidoId) {
      queryClient.invalidateQueries({ queryKey: ["pedido", pedidoId] });
      queryClient.invalidateQueries({ queryKey: ["orcamentos-pedido", pedidoId] });
    }
  }

  async function salvarStatus() {
    const pedido = pedidoStatusAberto;
    if (!pedido) return;
    if (!(STATUS_ORCAMENTO as readonly string[]).includes(novoStatus)) {
      toast.error("Status inválido.");
      return;
    }
    const ids = pedido.itens.map((item) => String(item["id"])).filter(Boolean);
    if (ids.length === 0) return;

    setSalvandoStatus(true);
    try {
      const { error } = await supabase.from("orcamentos").update({ status: novoStatus }).in("id", ids);
      if (error) throw error;

      if (pedido.temPedido) {
        const { error: erroPedido } = await supabase
          .from("pedidos")
          .update({ status: novoStatus })
          .eq("id", pedido.pedidoId);
        if (erroPedido) throw erroPedido;
      }

      invalidar(pedido.pedidoId);
      setAbaStatus(novoStatus);
      setAbaTocada(true);
      setPedidoStatusAberto(null);
      toast.success("Status do pedido atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível alterar o status.");
    } finally {
      setSalvandoStatus(false);
    }
  }

  async function salvarPagamento(pedido: PedidoAgrupado, valorPago: number) {
    if (valorPago < 0 || valorPago > pedido.total) {
      toast.error("Valor pago inválido.");
      return;
    }
    if (!pedido.temPedido) return;
    const { error } = await supabase
      .from("pedidos")
      .update({ valor_pago: valorPago })
      .eq("id", pedido.pedidoId);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidar(pedido.pedidoId);
  }

  /** Gera (ou reaproveita) o link público do orçamento e copia para a área de transferência. */
  async function copiarLink(pedido: PedidoAgrupado) {
    const primeiro = pedido.itens[0];
    const orcamentoId = primeiro ? String(primeiro["id"] ?? "") : "";
    if (!orcamentoId) {
      toast.error("Este pedido não possui itens para gerar o link.");
      return;
    }
    try {
      const r = await criarLink({ data: { orcamentoId } });
      if (!r.ok || !r.url) {
        toast.error(r.motivo ?? "Não foi possível gerar o link.");
        return;
      }
      const url = r.url.startsWith("http") ? r.url : `${window.location.origin}${r.url}`;
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado para a área de transferência.");
    } catch {
      toast.error("Não foi possível gerar o link do orçamento.");
    }
  }

  /** Abre o pedido na calculadora para continuar/editar os itens. */
  async function editarPedido(pedido: PedidoAgrupado) {
    if (!pedido.temPedido) {
      toast.error("Este orçamento antigo não possui pedido vinculado.");
      return;
    }
    if (!user?.id) return;
    const dados = {
      pedidoId: pedido.pedidoId,
      editandoId: null,
      clienteNome: pedido.clienteNome,
      clienteTelefone: pedido.clienteTelefone ?? "",
      observacao: pedido.observacao ?? "",
      validade: pedido.validade ?? "",
      arquivosLista: [],
      arquivos: 0,
      paginasAdicionais: 0,
      copiasAdicionais: 0,
      tipoServico: "",
      copiaManual: false,
      materialId: "",
      selecao: {},
      frenteVerso: false,
      incluirPix: false,
      precisaPrazo: false,
      prazoTipo: "",
      prazoQuantidade: 0,
    };
    const { error } = await supabase
      .from("rascunhos")
      .upsert(
        { usuario_id: user.id, dados: dados as unknown as never },
        { onConflict: "usuario_id" },
      );
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["rascunho", user.id] });
    toast.success(`Pedido ${pedido.numero} aberto na calculadora.`);
    void navigate({ to: "/" });
  }


  async function excluirPedido(pedido: PedidoAgrupado) {
    const ids = pedido.itens.map((item) => String(item["id"])).filter(Boolean);
    if (ids.length === 0) return;

    const { error } = await supabase.from("orcamentos").delete().in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (pedido.temPedido) await supabase.from("pedidos").delete().eq("id", pedido.pedidoId);
    invalidar(pedido.pedidoId);
    toast.success("Pedido excluído com sucesso.");
  }

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

  /* ---------------- RENDER ---------------- */
  return (
    <>
      <PageHeader titulo="ORÇAMENTOS" subtitulo="Consulte e gerencie os pedidos de orçamento." />

      {/* FILTRO POR DATA */}
      <Card className="mb-4 shadow-card">
        <CardContent className="flex flex-wrap items-end gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="data-inicio">Início</Label>
            <Input
              id="data-inicio"
              type="date"
              className="w-44"
              value={dataInicio}
              disabled={todasAsDatas}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="data-fim">Final</Label>
            <Input
              id="data-fim"
              type="date"
              className="w-44"
              value={dataFim}
              disabled={todasAsDatas}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>

          <Button variant={todasAsDatas ? "default" : "outline"} onClick={() => setTodasAsDatas((v) => !v)}>
            Todas as datas
          </Button>

          {!todasAsDatas && (
            <Button
              variant="ghost"
              onClick={() => {
                setDataInicio(hoje);
                setDataFim(hoje);
              }}
            >
              Hoje
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ABAS POR STATUS */}
      {abas.length > 0 && (
        <div className="mb-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {abas.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setAbaStatus(status);
                setAbaTocada(true);
              }}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold tracking-wider uppercase transition-colors ${
                abaStatus === status
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-accent"
              }`}
            >
              {rotuloStatus[status]} ({contagem.get(status) ?? 0})
            </button>
          ))}
        </div>
      )}

      {/* TABELA DE PEDIDOS */}
      <Card className="shadow-card">
        <CardContent className="py-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : pedidosDaAba.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="font-semibold">Nenhum pedido encontrado</p>
              <p className="text-sm text-muted-foreground">
                Ajuste o período ou use a calculadora para criar um novo pedido.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[950px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-accent/60 text-left text-xs font-bold tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Nº PEDIDO</th>
                    <th className="px-4 py-3">DATA</th>
                    <th className="px-4 py-3">CLIENTE</th>
                    <th className="px-4 py-3 text-center">ITENS</th>
                    <th className="px-4 py-3 text-right">VALOR TOTAL</th>
                    <th className="px-4 py-3 text-center">STATUS</th>
                    <th className="px-4 py-3 text-center">PAGAMENTO</th>

                    <th className="px-4 py-3 text-right">AÇÕES</th>
                  </tr>
                </thead>

                <tbody>
                  {pedidosDaAba.map((pedido) => (
                    <tr
                      key={pedido.pedidoId}
                      className="border-b border-border transition-colors last:border-0 hover:bg-accent/30"
                    >
                      <td className="px-4 py-4">
                        <span className="font-bold text-primary">{pedido.numero}</span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">{dataBR(pedido.data)}</td>

                      <td className="px-4 py-4">
                        <div>
                          <p className="font-semibold">{pedido.clienteNome}</p>
                          {pedido.clienteTelefone && (
                            <p className="text-xs text-muted-foreground">{pedido.clienteTelefone}</p>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <Badge variant="secondary">{pedido.itens.length}</Badge>
                      </td>

                      <td className="px-4 py-4 text-right">
                        <span className="text-base font-extrabold text-success">{brl(pedido.total)}</span>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <Badge variant="outline">{rotuloStatus[pedido.status]}</Badge>
                      </td>

                      <td className="px-4 py-4 text-center">
                        {(() => {
                          const p = situacaoPagamento(pedido.total, pedido.valorPago);
                          return (
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${p.classe}`}
                            >
                              {p.rotulo}
                            </span>
                          );
                        })()}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Ver itens"
                            onClick={() => setPedidoItensAberto(pedido)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            title="Editar pedido"
                            onClick={() => void editarPedido(pedido)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>


                          <Button
                            variant="ghost"
                            size="icon"
                            title="Copiar link do orçamento"
                            onClick={() => void copiarLink(pedido)}
                          >
                            <LinkIcon className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            title="Alterar status"
                            onClick={() => {
                              setNovoStatus(pedido.status);
                              setPedidoStatusAberto(pedido);
                            }}
                          >
                            <Tags className="h-4 w-4" />
                          </Button>

                          <ImprimirEtiqueta
                            numero={pedido.numero}
                            clienteNome={pedido.clienteNome}
                            clienteTelefone={pedido.clienteTelefone}
                            data={pedido.data}
                            status={pedido.status}
                            total={pedido.total}
                            valorPago={pedido.valorPago}
                            itens={pedido.itens}
                            onSalvarPagamento={(valor) => salvarPagamento(pedido, valor)}
                          >
                            <Button variant="ghost" size="icon" title="Imprimir etiqueta">
                              <Printer className="h-4 w-4" />
                            </Button>
                          </ImprimirEtiqueta>

                          <Button
                            variant="ghost"
                            size="icon"
                            title="Imprimir documentos"
                            onClick={() => void imprimirDocumentosPedido(pedido)}
                          >
                            <FileStack className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            title="Gerar PDF"
                            onClick={() => gerarOrcamentoPdf(documentoPedido(pedido))}
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            title="Gerar imagem"
                            onClick={() => gerarOrcamentoImagem(documentoPedido(pedido))}
                          >
                            <ImageIcon className="h-4 w-4" />
                          </Button>

                          <ConfirmarExclusao
                            titulo="Excluir pedido"
                            descricao={`Tem certeza que deseja excluir o pedido ${pedido.numero} e todos os seus ${pedido.itens.length} item(ns)?`}
                            rotuloConfirmar="Excluir pedido"
                            onConfirmar={() => excluirPedido(pedido)}
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

      {/* DIALOG - ALTERAR STATUS */}
      <Dialog
        open={pedidoStatusAberto !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setPedidoStatusAberto(null);
        }}
      >
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar status do pedido</DialogTitle>
            <DialogDescription>
              Pedido Nº {pedidoStatusAberto?.numero ?? "-"} · Status atual:{" "}
              {rotuloStatus[pedidoStatusAberto?.status ?? "pendente_envio"]}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label>Novo status</Label>
            <RadioGroup value={novoStatus} onValueChange={setNovoStatus} className="gap-2">
              {STATUS_ORCAMENTO.map((status) => (
                <label key={status} className="flex items-center gap-2 text-sm font-medium">
                  <RadioGroupItem value={status} /> {rotuloStatus[status]}
                </label>
              ))}
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPedidoStatusAberto(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarStatus} disabled={salvandoStatus}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG - VER ITENS */}
      <Dialog
        open={pedidoItensAberto !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setPedidoItensAberto(null);
        }}
      >
        <DialogContent className="w-[95vw] max-w-5xl">
          <DialogHeader>
            <DialogTitle>Pedido {pedidoItensAberto?.numero ?? "-"}</DialogTitle>
            <DialogDescription>Itens incluídos neste pedido.</DialogDescription>
          </DialogHeader>

          {pedidoItensAberto && (
            <div className="space-y-5">
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
                      <tr key={String(item["id"])} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-bold">{String(index + 1).padStart(2, "0")}</td>
                        <td className="px-4 py-3 font-semibold">{String(item["material_nome"] ?? "-")}</td>
                        <td className="px-4 py-3 capitalize">{String(item["tipo_impressao"] ?? "-")}</td>
                        <td className="px-4 py-3">{String(item["tamanho"] ?? "-")}</td>
                        <td className="px-4 py-3 text-right">{Number(item["paginas_total"] ?? 0)}</td>
                        <td className="px-4 py-3 text-right font-bold text-success">
                          {brl(Number(item["valor_total"] ?? 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>

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

              {pedidoItensAberto.observacao && (
                <div className="rounded-xl border border-border bg-accent/30 p-4">
                  <p className="mb-1 text-xs font-bold text-muted-foreground">OBSERVAÇÃO</p>
                  <p className="whitespace-pre-wrap text-sm">{pedidoItensAberto.observacao}</p>
                </div>
              )}

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

type PedidoAgrupado = {
  pedidoId: string;
  temPedido: boolean;
  numero: string;
  data: string;
  clienteNome: string;
  clienteTelefone: string | null;
  validade: string | null;
  observacao: string | null;
  itens: Record<string, unknown>[];
  total: number;
  valorPago: number;
  status: string;
};

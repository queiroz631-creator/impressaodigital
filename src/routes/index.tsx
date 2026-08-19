import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Calculator,
  Files,
  FileStack,
  RefreshCw,
  FileText,
  TrendingDown,
  TrendingUp,
  BarChart3,
  Layers,
  Info,
  Printer,
  Paperclip,
  Scissors,
  Plus,
  Trash2,
  Pencil,
  ShoppingCart,
  Copy,
  Image as ImageIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import {
  useAcabamentos,
  useConfiguracao,
  useMateriais,
  useOrcamentosPedido,
  usePedido,
  useRascunho,
} from "@/hooks/useDados";
import { useAuth } from "@/hooks/useAuth";
import {
  acabamentosDoTipo,
  calcularAcabamentos,
  calcularLinhas,
  resumoLinhas,
  rotuloCobranca,
  totalAcabamentos,
  FORMATOS,
  FORMATO_PADRAO,
  type FormatoPapel,
  type SelecaoAcabamento,
  type TipoServico,
} from "@/lib/calc";
import { contarPaginas } from "@/lib/contagem";
import type { AcabamentoDoc, ArquivoDoc } from "@/lib/documento";
import { brl, numeroBR } from "@/lib/format";
import { documentoDeOrcamentos } from "@/lib/orcamento-doc";
import { gerarOrcamentoPdf } from "@/lib/pdf";
import { gerarOrcamentoImagem } from "@/lib/imagem";

export const Route = createFileRoute("/")({
  component: CalculadoraPage,
  head: () => ({
    meta: [
      { title: "Calculadora de Impressão Digital" },
      {
        name: "description",
        content: "Anexe arquivos, escolha cor e tipo de impressão e monte pedidos com vários orçamentos.",
      },
      { property: "og:title", content: "Calculadora de Impressão Digital" },
      {
        property: "og:description",
        content: "Anexe arquivos, escolha cor e tipo de impressão e monte pedidos com vários orçamentos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function CalculadoraPage() {
  return (
    <AppLayout>
      <Calculadora />
    </AppLayout>
  );
}

interface EstadoRascunho {
  pedidoId: string | null;
  editandoId: string | null;
  clienteNome: string;
  clienteTelefone: string;
  observacao: string;
  validade: string;
  arquivosLista: ArquivoDoc[];
  arquivos: number;
  paginasAdicionais: number;
  tipoServico: TipoServico | "";
  copiaManual: boolean;
  materialId: string;
  selecao: Record<string, SelecaoAcabamento>;
  frenteVerso: boolean;
  formato: FormatoPapel;
  usarFaixaCopiaManual: boolean;
  copiasAdicionais: number;
}

const ESTADO_INICIAL: EstadoRascunho = {
  pedidoId: null,
  editandoId: null,
  clienteNome: "",
  clienteTelefone: "",
  observacao: "",
  validade: "",
  arquivosLista: [],
  arquivos: 0,
  paginasAdicionais: 0,
  tipoServico: "",
  copiaManual: false,
  materialId: "",
  selecao: {},
  frenteVerso: false,
  formato: FORMATO_PADRAO,
  usarFaixaCopiaManual: false,
  copiasAdicionais: 0,
};

function Calculadora() {
  const { user } = useAuth();
  const { data: materiais, isLoading } = useMateriais(true);
  const { data: acabamentos } = useAcabamentos(true);
  const { data: config } = useConfiguracao();
  const { data: rascunhoSalvo, isFetched: rascunhoCarregado } = useRascunho(user?.id);
  const queryClient = useQueryClient();

  const [estado, setEstado] = useState<EstadoRascunho>(ESTADO_INICIAL);
  const [hidratado, setHidratado] = useState(false);
  const [lendoArquivos, setLendoArquivos] = useState(false);
  const [salvandoItem, setSalvandoItem] = useState(false);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [incluirTotal, setIncluirTotal] = useState(true);
  const [downloadDialogAberto, setDownloadDialogAberto] = useState(false);
  const [tipoGeracao, setTipoGeracao] = useState<"pdf" | "imagem" | null>(null);
  const inputArquivos = useRef<HTMLInputElement>(null);

  const set = useCallback(
    <K extends keyof EstadoRascunho>(campo: K, valor: EstadoRascunho[K]) =>
      setEstado((e) => ({ ...e, [campo]: valor })),
    [],
  );

  const { data: pedido } = usePedido(estado.pedidoId);
  const { data: itensPedido } = useOrcamentosPedido(estado.pedidoId);

  // ----- Hidratação do rascunho (Supabase é a fonte persistente) -----
  useEffect(() => {
    if (hidratado || !rascunhoCarregado) return;
    if (rascunhoSalvo && Object.keys(rascunhoSalvo).length > 0) {
      const salvo = rascunhoSalvo as Record<string, unknown>;
      const compat: Partial<EstadoRascunho> =
        salvo["paginasAdicionais"] == null && salvo["paginas"] != null
          ? {
              paginasAdicionais: Math.max(
                0,
                Number(salvo["paginas"] ?? 0) - Number(salvo["arquivos"] ?? 0),
              ),
            }
          : {};
      setEstado({ ...ESTADO_INICIAL, ...(salvo as unknown as EstadoRascunho), ...compat });
    }
    setHidratado(true);
  }, [hidratado, rascunhoCarregado, rascunhoSalvo]);

  // ----- Persistência automática do rascunho -----
  useEffect(() => {
    if (!hidratado || !user?.id) return;
    const timer = setTimeout(() => {
      void supabase
        .from("rascunhos")
        .upsert({ usuario_id: user.id, dados: estado as unknown as never }, { onConflict: "usuario_id" });
    }, 800);
    return () => clearTimeout(timer);
  }, [estado, hidratado, user?.id]);

  useEffect(() => {
    if (!config?.validade_padrao_dias) return;

    if (estado.validade) return;

    const dias = Number(config.validade_padrao_dias);

    if (dias <= 0) return;

    const data = new Date();

    data.setHours(0, 0, 0, 0);
    data.setDate(data.getDate() + dias);

    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");

    const dia = String(data.getDate()).padStart(2, "0");

    set("validade", `${ano}-${mes}-${dia}`);
  }, [config?.validade_padrao_dias, estado.validade, set]);

  const precisaSelecionar = !estado.tipoServico;
  const paginasAdicionais = estado.paginasAdicionais;
  const paginasArquivos = estado.arquivosLista.reduce((acc, a) => acc + a.paginas, 0);

  const entrada = useMemo(
    () => ({
      paginasAdicionais: estado.paginasAdicionais,

      arquivos: estado.arquivos,

      copiasAdicionais: estado.copiasAdicionais,

      ...(estado.tipoServico
        ? {
            tipoServico: estado.tipoServico as TipoServico,
          }
        : {}),

      formato: estado.formato,

      copiaManual: estado.copiaManual,

      usarFaixaCopiaManual: estado.usarFaixaCopiaManual,
    }),
    [
      estado.paginasAdicionais,
      estado.arquivos,
      estado.copiasAdicionais,
      estado.tipoServico,
      estado.formato,
      estado.copiaManual,
      estado.usarFaixaCopiaManual,
    ],
  );

  const linhas = useMemo(() => calcularLinhas(materiais ?? [], entrada), [materiais, entrada]);

  const acabamentosVisiveis = useMemo(
    () => acabamentosDoTipo(acabamentos ?? [], (estado.tipoServico || undefined) as TipoServico | undefined),
    [acabamentos, estado.tipoServico],
  );

  const linhasAcabamento = useMemo(
    () => calcularAcabamentos(acabamentosVisiveis, estado.selecao, { paginas: estado.paginasAdicionais }),
    [acabamentosVisiveis, estado.selecao, estado.paginasAdicionais],
  );
  const valorAcabamento = totalAcabamentos(linhasAcabamento);
  const tamanhoFinal = estado.formato;

  const linhasFinais = useMemo(
    () => linhas.map((l) => ({ ...l, total: l.total + valorAcabamento })),
    [linhas, valorAcabamento],
  );
  const resumo = resumoLinhas(linhasFinais);
  const quantidadeTotal = estado.arquivos + paginasAdicionais + estado.copiasAdicionais;
  const semQuantidade = quantidadeTotal <= 0;
  const mostrarTabela = !precisaSelecionar && !semQuantidade;

  const materialSelecionado = linhasFinais.find((l) => l.material.id === estado.materialId) ?? linhasFinais[0];

  const totalPedido = (itensPedido ?? []).reduce((acc, o) => acc + Number(o.valor_total ?? 0), 0);

  const num = (v: string) => Math.max(0, Number(v.replace(/\D/g, "")) || 0);

  async function anexar(files: FileList | null) {
    if (!files || files.length === 0) return;
    setLendoArquivos(true);
    try {
      const r = await contarPaginas(Array.from(files));
      const lista = [...estado.arquivosLista, ...r.arquivos];
      aplicarArquivos(lista);
      if (r.ignorados.length > 0) toast.warning(`Arquivos ignorados: ${r.ignorados.join(", ")}`);
      if (r.arquivos.length > 0) toast.success(`${r.arquivos.length} arquivo(s) anexado(s).`);
    } catch {
      toast.error("Não foi possível ler os arquivos.");
    } finally {
      setLendoArquivos(false);
      if (inputArquivos.current) inputArquivos.current.value = "";
    }
  }
  function solicitarDownload(tipo: "pdf" | "imagem") {
    setTipoGeracao(tipo);
    setDownloadDialogAberto(true);
  }

  function aplicarArquivos(lista: ArquivoDoc[]) {
    setEstado((e) => ({
      ...e,
      arquivosLista: lista,
      arquivos: lista.length,
      paginasAdicionais: Math.max(0, lista.reduce((acc, a) => acc + a.paginas, 0) - lista.length),
    }));
  }

  function removerArquivo(indice: number) {
    aplicarArquivos(estado.arquivosLista.filter((_, i) => i !== indice));
  }

  function acabamentosParaSalvar(): AcabamentoDoc[] {
    const selecionados: AcabamentoDoc[] = linhasAcabamento
      .filter((l) => l.acabamento.mostrar_no_orcamento !== false)
      .map((l) => ({
        nome: l.acabamento.nome,
        quantidade: l.quantidade,
        total: l.total,
        incluso: true,
      }));
    const naoInclusos: AcabamentoDoc[] = acabamentosVisiveis
      .filter((a) => a.mostrar_no_orcamento !== false && a.mostrar_nao_incluso && !estado.selecao[a.id]?.ativo)
      .map((a) => ({ nome: a.nome, quantidade: 0, total: 0, incluso: false }));
    return [...selecionados, ...naoInclusos];
  }

  async function garantirPedido() {
    if (estado.pedidoId) return estado.pedidoId;
    const { data, error } = await supabase
      .from("pedidos")
      .insert({
        cliente_nome: estado.clienteNome,
        cliente_telefone: estado.clienteTelefone,
        observacao: estado.observacao,
        validade: estado.validade || null,
        status: "pendente_envio",
      })
      .select()
      .single();
    if (error) throw error;
    set("pedidoId", data.id);
    return data.id as string;
  }

  async function adicionarAoPedido() {
    if (precisaSelecionar) {
      toast.error("Selecione o tipo de impressão para realizar o cálculo.");
      return;
    }
    if (!materialSelecionado) {
      toast.error("Selecione um material para o orçamento.");
      return;
    }
    if (semQuantidade) {
      toast.error("Informe arquivos, páginas adicionais ou cópias adicionais.");
      return;
    }
    setSalvandoItem(true);
    try {
      const pedidoId = await garantirPedido();
      const registro = {
        pedido_id: pedidoId,
        cliente_nome: estado.clienteNome,
        cliente_telefone: estado.clienteTelefone,
        material_id: materialSelecionado.material.id,
        material_nome: materialSelecionado.material.nome,
        arquivos: estado.arquivosLista as unknown as never,
        acabamentos: acabamentosParaSalvar() as unknown as never,
        tipo_impressao: estado.tipoServico,
        quantidade_arquivos: estado.arquivos,
        paginas_total: paginasArquivos,
        paginas_adicionais: estado.paginasAdicionais,
        copias_adicionais: estado.copiasAdicionais,
        tamanho: tamanhoFinal,
        frente_verso: estado.frenteVerso,
        valor_acabamento: valorAcabamento,
        valor_unitario: materialSelecionado.valorUnitario,
        valor_total: materialSelecionado.total,
        copia_manual: estado.copiaManual,
        observacao: estado.observacao,
        validade: estado.validade || null,
        status: "pendente_envio",
      };

      if (estado.editandoId) {
        const { error } = await supabase.from("orcamentos").update(registro).eq("id", estado.editandoId);
        if (error) throw error;
        toast.success("Orçamento atualizado no pedido.");
      } else {
        const ordem = (itensPedido?.length ?? 0) + 1;
        const { error } = await supabase.from("orcamentos").insert({ ...registro, ordem });
        if (error) throw error;
        toast.success("Orçamento adicionado ao pedido.");
      }

      await supabase
        .from("pedidos")
        .update({
          cliente_nome: estado.clienteNome,
          cliente_telefone: estado.clienteTelefone,
          observacao: estado.observacao,
          validade: estado.validade || null,
        })
        .eq("id", pedidoId);

      set("editandoId", null);
      queryClient.invalidateQueries({ queryKey: ["orcamentos-pedido", pedidoId] });
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      queryClient.invalidateQueries({ queryKey: ["pedido", pedidoId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar o orçamento.");
    } finally {
      setSalvandoItem(false);
    }
  }

  function editarItem(row: Record<string, unknown>) {
    const arquivos = Array.isArray(row["arquivos"]) ? (row["arquivos"] as ArquivoDoc[]) : [];
    const nomes = new Set(
      (Array.isArray(row["acabamentos"]) ? (row["acabamentos"] as AcabamentoDoc[]) : [])
        .filter((a) => a.incluso !== false)
        .map((a) => a.nome),
    );
    const selecao: Record<string, SelecaoAcabamento> = {};
    for (const a of acabamentos ?? []) {
      if (nomes.has(a.nome)) selecao[a.id] = { ativo: true, quantidade: 1 };
    }
    setEstado((e) => ({
      ...e,
      editandoId: String(row["id"]),
      arquivosLista: arquivos,
      arquivos: Number(row["quantidade_arquivos"] ?? arquivos.length),
      paginasAdicionais:
        row["paginas_adicionais"] != null
          ? Number(row["paginas_adicionais"])
          : Math.max(
              0,
              Number(row["paginas_total"] ?? 0) - Number(row["quantidade_arquivos"] ?? arquivos.length),
            ),
      copiasAdicionais: Number(row["copias_adicionais"] ?? 0),
      tipoServico: (row["tipo_impressao"] as TipoServico) ?? "simples",
      copiaManual: Boolean(row["copia_manual"]),
      materialId: String(row["material_id"] ?? ""),
      selecao,
      frenteVerso: Boolean(row["frente_verso"]),
      formato: (["A3", "A4", "A5"].includes(String(row["tamanho"]))
        ? String(row["tamanho"])
        : FORMATO_PADRAO) as FormatoPapel,
    }));
    toast.info("Orçamento carregado para edição.");
  }

  async function excluirItem(id: string) {
    const { error } = await supabase.from("orcamentos").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (estado.editandoId === id) set("editandoId", null);
    queryClient.invalidateQueries({ queryKey: ["orcamentos-pedido", estado.pedidoId] });
    queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
    toast.success("Orçamento removido do pedido.");
  }

  function limparFormulario(manterPedido: boolean) {
    setEstado((e) => ({
      ...ESTADO_INICIAL,
      pedidoId: manterPedido ? e.pedidoId : null,
      clienteNome: manterPedido ? e.clienteNome : "",
      clienteTelefone: manterPedido ? e.clienteTelefone : "",
      validade: manterPedido ? e.validade : "",
    }));
  }
  function calcularValidadePadrao() {
    const dias = Number(config?.validade_padrao_dias ?? 0);

    if (dias <= 0) {
      return "";
    }

    const data = new Date();

    data.setHours(12, 0, 0, 0);
    data.setDate(data.getDate() + dias);

    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");

    return `${ano}-${mes}-${dia}`;
  }

  function documentoDoPedido() {
    const validade = estado.validade || calcularValidadePadrao();

    return documentoDeOrcamentos((itensPedido ?? []) as unknown as Record<string, unknown>[], config, {
      numero: String(pedido?.numero ?? "-"),
      data: String(pedido?.created_at ?? new Date().toISOString()),
      clienteNome: estado.clienteNome,
      clienteTelefone: estado.clienteTelefone,
      validade: validade || null,
      observacao: estado.observacao || null,
    });
  }

  function documentoParaGerar() {
    return { ...documentoDoPedido(), mostrarTotal: incluirTotal };
  }

  function validarDadosOrcamento() {
    if (!estado.clienteNome.trim()) {
      toast.error("Informe o nome do cliente para gerar o orçamento.");
      return false;
    }

    if ((itensPedido ?? []).length === 0) {
      toast.error("Adicione pelo menos um item ao pedido.");
      return false;
    }

    return true;
  }

  async function salvarDadosCliente() {
    if (!estado.pedidoId) return;
    await supabase
      .from("pedidos")
      .update({
        cliente_nome: estado.clienteNome,
        cliente_telefone: estado.clienteTelefone,
        observacao: estado.observacao,
        validade: estado.validade || null,
      })
      .eq("id", estado.pedidoId);
    if ((itensPedido ?? []).length > 0) {
      await supabase
        .from("orcamentos")
        .update({
          cliente_nome: estado.clienteNome,
          cliente_telefone: estado.clienteTelefone,
          observacao: estado.observacao,
          validade: estado.validade || null,
        })
        .eq("pedido_id", estado.pedidoId);
      queryClient.invalidateQueries({ queryKey: ["orcamentos-pedido", estado.pedidoId] });
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
    }
  }

  return (
    <>
      <PageHeader
        titulo="CALCULADORA DE IMPRESSÃO DIGITAL"
        subtitulo="Anexe os arquivos, escolha cor e tipo de impressão e monte o pedido."
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <ConfirmarAcao
          titulo="Novo pedido"
          descricao="Deseja iniciar um novo pedido? Os dados atuais que ainda não foram adicionados ao pedido serão descartados."
          rotuloConfirmar="Novo Pedido"
          onConfirmar={() => {
            limparFormulario(false);
            toast.success("Novo pedido iniciado.");
          }}
        >
          <Button>
            <ShoppingCart className="h-4 w-4" /> Novo Pedido
          </Button>
        </ConfirmarAcao>
        <Button variant="outline" onClick={() => setDialogAberto(true)}>
          <FileText className="h-4 w-4" /> Gerar Orçamento
        </Button>
        {pedido && (
          <Badge variant="secondary" className="text-sm">
            Pedido {pedido.numero}
          </Badge>
        )}
      </div>

      <Card className="mb-6 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-bold tracking-wide">
            <span className="rounded-lg bg-accent p-2 text-primary">
              <Calculator className="h-4 w-4" />
            </span>
            DADOS DO TRABALHO
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
            <div className="space-y-4">
              <div>
                <input
                  ref={inputArquivos}
                  type="file"
                  multiple
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => anexar(e.target.files)}
                />
                <Button variant="outline" disabled={lendoArquivos} onClick={() => inputArquivos.current?.click()}>
                  <Paperclip className="h-4 w-4" />
                  {lendoArquivos ? "Lendo arquivos..." : "Anexar PDFs / Imagens"}
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  As páginas dos PDFs são contadas automaticamente; cada imagem conta como 1 página.
                </p>
              </div>

              {estado.arquivosLista.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-bold tracking-wider text-muted-foreground">
                        <th className="px-3 py-2">ARQUIVO</th>
                        <th className="px-3 py-2">TIPO</th>
                        <th className="px-3 py-2 text-right">PÁGINAS</th>
                        <th className="px-3 py-2 text-right">AÇÃO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estado.arquivosLista.map((a, i) => (
                        <tr key={`${a.nome}-${i}`} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 font-semibold">{a.nome}</td>
                          <td className="px-3 py-2 text-muted-foreground">{a.tipo}</td>
                          <td className="px-3 py-2 text-right">{numeroBR(a.paginas)}</td>
                          <td className="px-3 py-2 text-right">
                            <ConfirmarExclusao
                              titulo="Remover arquivo"
                              descricao="Tem certeza que deseja remover este arquivo do orçamento?"
                              rotuloConfirmar="Remover"
                              onConfirmar={() => removerArquivo(i)}
                            >
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </ConfirmarExclusao>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Campo
                  icon={<Files className="h-4 w-4 text-cyan-ink" />}
                  label="Quantidade de arquivos"
                  sufixo="arquivos"
                >
                  <div className="flex h-11 overflow-hidden rounded-lg border border-border bg-background">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-full w-12 shrink-0 rounded-none border-r"
                      onClick={() => set("arquivos", Math.max(0, estado.arquivos - 1))}
                    >
                      −
                    </Button>

                    <Input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={estado.arquivos}
                      onChange={(e) => set("arquivos", Math.max(0, num(e.target.value)))}
                      className="h-full rounded-none border-0 text-center text-xl font-bold focus-visible:ring-0"
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      className="h-full w-12 shrink-0 rounded-none border-l"
                      onClick={() => set("arquivos", estado.arquivos + 1)}
                    >
                      +
                    </Button>
                  </div>
                </Campo>

                <Campo
                  icon={<FileStack className="h-4 w-4 text-navy" />}
                  label="Páginas adicionais"
                  sufixo="páginas adicionais"
                >
                  <div className="flex h-11 overflow-hidden rounded-lg border border-border bg-background">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-full w-12 shrink-0 rounded-none border-r"
                      onClick={() => set("paginasAdicionais", Math.max(0, estado.paginasAdicionais - 1))}
                    >
                      −
                    </Button>

                    <Input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={estado.paginasAdicionais}
                      onChange={(e) => set("paginasAdicionais", Math.max(0, num(e.target.value)))}
                      className="h-full rounded-none border-0 text-center text-xl font-bold focus-visible:ring-0"
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      className="h-full w-12 shrink-0 rounded-none border-l"
                      onClick={() => set("paginasAdicionais", estado.paginasAdicionais + 1)}
                    >
                      +
                    </Button>
                  </div>
                </Campo>

                <Campo
                  icon={<Copy className="h-4 w-4 text-magenta-ink" />}
                  label="Cópias adicionais"
                  sufixo="cópias adicionais"
                >
                  <div className="flex h-11 items-center overflow-hidden rounded-md border border-input">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-full rounded-none px-3"
                      onClick={() =>
                        setEstado((e) => ({
                          ...e,
                          copiasAdicionais: Math.max(0, e.copiasAdicionais - 1),
                        }))
                      }
                    >
                      −
                    </Button>

                    <Input
                      inputMode="numeric"
                      value={estado.copiasAdicionais}
                      onChange={(e) => set("copiasAdicionais", Math.max(0, num(e.target.value)))}
                      className="h-full border-0 text-center text-xl font-bold shadow-none focus-visible:ring-0"
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      className="h-full rounded-none px-3"
                      onClick={() =>
                        setEstado((e) => ({
                          ...e,
                          copiasAdicionais: e.copiasAdicionais + 1,
                        }))
                      }
                    >
                      +
                    </Button>
                  </div>
                </Campo>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Tipo de impressão *</Label>
                  <RadioGroup
                    value={estado.tipoServico}
                    onValueChange={(v) => set("tipoServico", v as TipoServico)}
                    className="gap-2"
                  >
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <RadioGroupItem value="simples" /> Impressão Simples
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <RadioGroupItem value="especial" /> Impressão Especial
                    </label>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Formato *</Label>
                  <RadioGroup
                    value={estado.formato}
                    onValueChange={(v) => set("formato", v as FormatoPapel)}
                    className="gap-2"
                  >
                    {FORMATOS.map((f) => (
                      <label key={f.valor} className="flex items-center gap-2 text-sm font-medium">
                        <RadioGroupItem value={f.valor} /> {f.rotulo}
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  className={
                    estado.copiaManual
                      ? "border-transparent bg-magenta-ink text-white hover:bg-magenta-ink/90"
                      : "border-magenta-ink text-magenta-ink hover:bg-magenta-ink/10 hover:text-magenta-ink"
                  }
                  onClick={() => set("copiaManual", !estado.copiaManual)}
                >
                  <Copy className="h-4 w-4" />
                  Cópia Manual {estado.copiaManual ? "(ativa)" : ""}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Na cópia manual o cálculo usa somente a quantidade de páginas e o preço unitário cadastrado, sem
                  faixas por quantidade e sem valor por arquivo.
                </p>
                {estado.copiaManual && (
                  <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold">Usar faixa de quantidade</p>
                      <p className="text-xs text-muted-foreground">Aplica as faixas cadastradas ao preço por página.</p>
                    </div>

                    <Switch
                      checked={estado.usarFaixaCopiaManual}
                      onCheckedChange={(v) => set("usarFaixaCopiaManual", v)}
                    />
                  </div>
                )}
              </div>

              {precisaSelecionar && (
                <p className="rounded-lg border border-border bg-accent/60 p-3 text-sm font-semibold text-primary">
                  Selecione o tipo de impressão para ver os valores automaticamente.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-accent/60 p-5">
              <p className="text-center text-sm font-bold tracking-widest text-primary">RESUMO</p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Total de arquivos</dt>
                  <dd className="text-2xl font-extrabold text-primary">{numeroBR(estado.arquivos)}</dd>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <dt className="text-muted-foreground">Páginas</dt>
                  <dd className="text-2xl font-extrabold text-primary">{numeroBR(totalPaginas)}</dd>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <dt className="text-muted-foreground">Cópias adicionais</dt>
                  <dd className="text-xl font-extrabold text-primary">{numeroBR(estado.copiasAdicionais)}</dd>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <dt className="text-muted-foreground">Total para cobrança</dt>
                  <dd className="text-2xl font-extrabold text-success">
                    {numeroBR(estado.paginas + estado.copiasAdicionais)}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <dt className="text-muted-foreground">Acabamento</dt>
                  <dd className="text-lg font-extrabold text-primary">{brl(valorAcabamento)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        {/* ==================== ACABAMENTO ==================== */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-bold tracking-wide">
              <span className="rounded-lg bg-accent p-2 text-primary">
                <Scissors className="h-4 w-4" />
              </span>
              ACABAMENTO
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {acabamentosVisiveis.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum acabamento disponível para o tipo de impressão selecionado.
              </p>
            ) : (
              <div className="space-y-2">
                {acabamentosVisiveis.map((a) => {
                  const sel = estado.selecao[a.id] ?? {
                    ativo: false,
                    quantidade: 1,
                  };

                  const linha = linhasAcabamento.find((l) => l.acabamento.id === a.id);

                  return (
                    <div
                      key={a.id}
                      className={`rounded-xl border p-3 transition-colors ${
                        sel.ativo ? "border-primary/50 bg-accent/30" : "border-border bg-card"
                      }`}
                    >
                      {/* Cabeçalho do acabamento */}
                      <div className="flex items-center justify-between gap-3">
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                          <Checkbox
                            checked={sel.ativo}
                            onCheckedChange={(v) =>
                              set("selecao", {
                                ...estado.selecao,
                                [a.id]: {
                                  ...sel,
                                  ativo: v === true,
                                },
                              })
                            }
                          />

                          <div className="min-w-0">
                            <p className="truncate font-semibold">{a.nome}</p>

                            <p className="text-xs text-muted-foreground">
                              {rotuloCobranca[a.cobranca]} · {brl(Number(a.valor) || 0)}
                              {a.cobranca === "bloco" ? ` a cada ${a.paginas_bloco} páginas` : ""}
                            </p>
                          </div>
                        </label>

                        {/* Spinner para acabamentos por quantidade */}
                        {sel.ativo && a.cobranca === "quantidade" && (
                          <div className="flex shrink-0 items-center overflow-hidden rounded-lg border border-border bg-background">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-none border-r"
                              onClick={() =>
                                set("selecao", {
                                  ...estado.selecao,
                                  [a.id]: {
                                    ...sel,
                                    quantidade: Math.max(0, sel.quantidade - 1),
                                  },
                                })
                              }
                            >
                              −
                            </Button>

                            <div className="flex h-8 min-w-10 items-center justify-center px-2 text-sm font-bold">
                              {sel.quantidade}
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-none border-l"
                              onClick={() =>
                                set("selecao", {
                                  ...estado.selecao,
                                  [a.id]: {
                                    ...sel,
                                    quantidade: sel.quantidade + 1,
                                  },
                                })
                              }
                            >
                              +
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Valor do acabamento */}
                      {sel.ativo && (
                        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                          <span className="text-xs text-muted-foreground">
                            {a.cobranca === "quantidade"
                              ? `${sel.quantidade} unidade(s)`
                              : a.cobranca === "pagina"
                                ? `${estado.paginas} página(s)`
                                : a.cobranca === "bloco"
                                  ? `${linha?.quantidade ?? 0} bloco(s)`
                                  : "Valor fixo"}
                          </span>

                          <span className="text-sm font-bold text-success">{brl(linha?.total ?? 0)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Frente e verso */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-accent/30 p-3">
              <div>
                <p className="font-semibold">Frente e verso</p>
                <p className="text-xs text-muted-foreground">Informado no orçamento</p>
              </div>

              <Switch checked={estado.frenteVerso} onCheckedChange={(v) => set("frenteVerso", v)} />
            </div>
          </CardContent>
        </Card>

        {/* ==================== VALORES DE IMPRESSÃO ==================== */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-bold tracking-wide">
              <span className="rounded-lg bg-accent p-2 text-primary">
                <Printer className="h-4 w-4" />
              </span>
              VALORES DE IMPRESSÃO
            </CardTitle>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  queryClient.invalidateQueries({
                    queryKey: ["materiais"],
                  });

                  toast.success("Cálculo atualizado com sucesso.");
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </Button>

              <Button disabled={!mostrarTabela || salvandoItem} onClick={adicionarAoPedido}>
                <Plus className="h-4 w-4" />

                {estado.editandoId ? "Salvar alterações do orçamento" : "Adicionar ao Pedido"}
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 w-full" />
                ))}
              </div>
            ) : !mostrarTabela ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Printer className="h-10 w-10 text-muted-foreground" />

                <p className="font-semibold">Nenhum cálculo realizado ainda</p>

                <p className="text-sm text-muted-foreground">
                  {precisaSelecionar
                    ? "Selecione o tipo de impressão para ver os valores."
                    : "Informe a quantidade de páginas para ver os valores."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] border-separate border-spacing-y-1 text-sm">
                  <thead>
                    <tr className="bg-navy text-left text-xs font-bold tracking-wider text-navy-foreground">
                      <th className="rounded-l-lg px-3 py-3">SELECIONAR</th>

                      <th className="px-3 py-3">MATERIAL</th>

                      <th className="px-3 py-3">DESCRIÇÃO</th>

                      <th className="px-3 py-3 text-right">PREÇO UNI</th>

                      <th className="rounded-r-lg px-3 py-3 text-right">TOTAL ({numeroBR(totalPaginas)} PÁGINAS)</th>
                    </tr>
                  </thead>

                  <tbody>
                    {linhasFinais.map((l) => {
                      const ativa = materialSelecionado?.material.id === l.material.id;

                      return (
                        <tr
                          key={l.material.id}
                          onClick={() => set("materialId", l.material.id)}
                          className={`cursor-pointer bg-card shadow-xs transition-all ${
                            ativa ? "ring-2 ring-primary" : "hover:bg-accent/30"
                          }`}
                        >
                          <td className="rounded-l-lg border-y border-l border-border px-3 py-3">
                            <input
                              type="radio"
                              className="h-4 w-4 accent-[var(--color-primary)]"
                              checked={ativa}
                              onChange={() => set("materialId", l.material.id)}
                              aria-label={`Selecionar ${l.material.nome}`}
                            />
                          </td>

                          <td className="border-y border-border px-3 py-3 font-semibold">{l.material.nome}</td>

                          <td className="border-y border-border px-3 py-3 text-muted-foreground">
                            {l.material.descricao}
                          </td>

                          <td className="border-y border-border px-3 py-3 text-right font-semibold">
                            {brl(l.valorUnitario)}
                          </td>

                          <td className="rounded-r-lg border-y border-r border-border px-3 py-3 text-right font-extrabold text-success">
                            {brl(l.total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(itensPedido ?? []).length > 0 && (
        <Card className="mb-6 shadow-card">
          <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-bold tracking-wide">
              <span className="rounded-lg bg-accent p-2 text-primary">
                <ShoppingCart className="h-4 w-4" />
              </span>
              ORÇAMENTOS ADICIONADOS AO PEDIDO {pedido?.numero ?? ""}
            </CardTitle>
            <Button variant="outline" onClick={() => setDialogAberto(true)}>
              <FileText className="h-4 w-4" /> Gerar Orçamento
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold tracking-wider text-muted-foreground">
                  <th className="px-3 py-3">Nº</th>
                  <th className="px-3 py-3">MATERIAL</th>
                  <th className="px-3 py-3">TIPO</th>
                  <th className="px-3 py-3">FORMATO</th>
                  <th className="px-3 py-3 text-right">PÁGINAS</th>
                  <th className="px-3 py-3 text-right">TOTAL</th>
                  <th className="px-3 py-3 text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {(itensPedido ?? []).map((o, i) => (
                  <tr key={o.id} className="border-b border-border">
                    <td className="px-3 py-3 font-semibold">{String(i + 1).padStart(2, "0")}</td>
                    <td className="px-3 py-3">{o.material_nome}</td>
                    <td className="px-3 py-3 capitalize">{o.tipo_impressao}</td>
                    <td className="px-3 py-3">{o.tamanho}</td>
                    <td className="px-3 py-3 text-right">{numeroBR(Number(o.paginas_total))}</td>
                    <td className="px-3 py-3 text-right font-bold text-success">{brl(Number(o.valor_total))}</td>
                    <td className="px-3 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => editarItem(o as unknown as Record<string, unknown>)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <ConfirmarExclusao onConfirmar={() => excluirItem(o.id)}>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </ConfirmarExclusao>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-right font-bold">
                    TOTAL DO PEDIDO
                  </td>
                  <td className="px-3 py-3 text-right text-lg font-extrabold text-success">{brl(totalPedido)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}

      {resumo && mostrarTabela && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <CardResumo
            icon={<TrendingDown className="h-5 w-5 text-success" />}
            titulo={`MENOR VALOR (${numeroBR(estado.arquivos)} arq. · ${numeroBR(paginasAdicionais)} pág. adic.)`}
            valor={brl(resumo.menor.total)}
            detalhe={resumo.menor.material.nome}
          />
          <CardResumo
            icon={<TrendingUp className="h-5 w-5 text-cyan-ink" />}
            titulo={`MAIOR VALOR (${numeroBR(estado.arquivos)} arq. · ${numeroBR(paginasAdicionais)} pág. adic.)`}
            valor={brl(resumo.maior.total)}
            detalhe={resumo.maior.material.nome}
          />
          <CardResumo
            icon={<BarChart3 className="h-5 w-5 text-primary" />}
            titulo="MÉDIA DE VALORES"
            valor={brl(resumo.media)}
            detalhe="Entre todos os materiais"
          />
          <CardResumo
            icon={<Layers className="h-5 w-5 text-magenta-ink" />}
            titulo="PÁGINAS ADICIONAIS"
            valor={numeroBR(paginasAdicionais)}
            detalhe={`${numeroBR(paginasArquivos)} página(s) nos arquivos`}
          />
        </div>
      )}

      <div className="flex items-start gap-3 rounded-xl border border-border bg-accent/60 p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        Os valores podem ser alterados a qualquer momento na tela de configuração de preços.
      </div>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar orçamento</DialogTitle>
            <DialogDescription>Informe os dados do cliente para gerar o documento do pedido.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Cliente <span className="text-destructive">*</span>
              </Label>

              <div className="flex gap-2">
                <Input
                  value={estado.clienteNome}
                  onChange={(e) => set("clienteNome", e.target.value)}
                  placeholder="Digite o nome do cliente"
                  className="flex-1"
                />

                <Button type="button" variant="outline" onClick={() => set("clienteNome", "CLIENTE PADRÃO")}>
                  Cliente Padrão
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={estado.clienteTelefone} onChange={(e) => set("clienteTelefone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Validade</Label>
              <Input type="date" value={estado.validade} onChange={(e) => set("validade", e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Observação</Label>
              <Textarea rows={2} value={estado.observacao} onChange={(e) => set("observacao", e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3 sm:col-span-2">
              <div>
                <p className="font-semibold">Mostrar total</p>
                <p className="text-xs text-muted-foreground">
                  Desative para gerar o orçamento sem exibir os valores totais.
                </p>
              </div>
              <Switch checked={incluirTotal} onCheckedChange={setIncluirTotal} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                if (!validarDadosOrcamento()) {
                  return;
                }

                await salvarDadosCliente();

                solicitarDownload("imagem");

                setDialogAberto(false);
              }}
            >
              <ImageIcon className="h-4 w-4" />
              Gerar Imagem
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!validarDadosOrcamento()) {
                  return;
                }

                await salvarDadosCliente();

                solicitarDownload("pdf");

                setDialogAberto(false);
              }}
            >
              <FileText className="h-4 w-4" />
              Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={downloadDialogAberto} onOpenChange={setDownloadDialogAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tipoGeracao === "pdf" ? "PDF gerado" : "Imagem gerada"}</DialogTitle>

            <DialogDescription>
              {tipoGeracao === "pdf"
                ? "O orçamento foi gerado. Deseja fazer o download do PDF?"
                : "A imagem do orçamento foi gerada. Deseja fazer o download da imagem?"}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDownloadDialogAberto(false);
                setTipoGeracao(null);
              }}
            >
              Não baixar
            </Button>

            <Button
              onClick={() => {
                const documento = documentoParaGerar();

                if (tipoGeracao === "pdf") {
                  gerarOrcamentoPdf(documento, true);
                }

                if (tipoGeracao === "imagem") {
                  gerarOrcamentoImagem(documento, true);
                }

                setDownloadDialogAberto(false);
                setTipoGeracao(null);
              }}
            >
              {tipoGeracao === "pdf" ? "Baixar PDF" : "Baixar Imagem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Campo({
  icon,
  label,
  sufixo,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  sufixo?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        {icon}
        {label}
      </Label>
      {children}
      {sufixo && <p className="text-xs text-muted-foreground">{sufixo}</p>}
    </div>
  );
}

function CardResumo({
  icon,
  titulo,
  valor,
  detalhe,
}: {
  icon: React.ReactNode;
  titulo: string;
  valor: string;
  detalhe: string;
}) {
  return (
    <Card className="shadow-card">
      <CardContent className="flex items-center gap-4 py-5">
        <span className="rounded-xl bg-accent p-3">{icon}</span>
        <div>
          <p className="text-xs font-bold tracking-wider text-muted-foreground">{titulo}</p>
          <p className="text-xl font-extrabold text-primary">{valor}</p>
          <p className="text-xs text-muted-foreground">{detalhe}</p>
        </div>
      </CardContent>
    </Card>
  );
}

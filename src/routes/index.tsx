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
  Tag,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

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
  usePerfisImpressao,
  useRascunho,
} from "@/hooks/useDados";
import {
  ImprimirDocumentosDialog,
  type DocumentoParaImprimir,
} from "@/components/impressao/ImprimirDocumentosDialog";
import { PERFIL_VAZIO, type PerfilImpressao } from "@/lib/perfil-impressao";
import { useAuth } from "@/hooks/useAuth";
import {
  acabamentosDoTipo,
  calcularAcabamentos,
  calcularLinhas,
  resumoLinhas,
  rotuloCobranca,
  totalAcabamentos,
  tagsPorFolha,
  tamanhoTagPorQuantidade,
  normalizarAreasImpressao,
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
import { montarTextoPix, montarTextoPrazo, type PrazoTipo } from "@/lib/orcamento-extras";

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
  /** Decisão obrigatória sobre frente e verso (vazio = não respondido). */
  decisaoFrenteVerso: "" | "sim" | "nao";
  /** Decisão obrigatória sobre usar acabamento (vazio = não respondido). */
  decisaoAcabamento: "" | "sim" | "nao";
  formato: FormatoPapel;

  copiasAdicionais: number;
  /** Decisão do usuário sobre incluir PIX (vazio = não respondido). */
  decisaoPix: "" | "sim" | "nao";
  /** Incluir dados de pagamento PIX no orçamento. */
  incluirPix: boolean;
  /** Decisão do usuário sobre prazo de entrega (vazio = não respondido). */
  decisaoPrazo: "" | "sim" | "nao";
  /** Informar prazo de entrega no orçamento. */
  precisaPrazo: boolean;
  prazoTipo: PrazoTipo | "";
  prazoQuantidade: number;
}

/** Chave do sessionStorage usada para receber arquivos enviados pela tela do WhatsApp. */
const CHAVE_ARQUIVOS_WHATSAPP = "calc-arquivos-whatsapp";

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
  decisaoFrenteVerso: "",
  decisaoAcabamento: "",
  formato: FORMATO_PADRAO,

  copiasAdicionais: 0,
  decisaoPix: "",
  incluirPix: false,
  decisaoPrazo: "",
  precisaPrazo: false,
  prazoTipo: "",
  prazoQuantidade: 0,
};

function Calculadora() {
  const { user } = useAuth();
  const { data: materiais, isLoading } = useMateriais(true);
  const { data: acabamentos } = useAcabamentos(true);
  const { data: config } = useConfiguracao();
  const { data: perfis } = usePerfisImpressao();
  const { data: rascunhoSalvo, isFetched: rascunhoCarregado } = useRascunho(user?.id);
  const [impressaoAberta, setImpressaoAberta] = useState(false);
  const queryClient = useQueryClient();

  const [estado, setEstado] = useState<EstadoRascunho>(ESTADO_INICIAL);
  const [hidratado, setHidratado] = useState(false);
  const [lendoArquivos, setLendoArquivos] = useState(false);
  const [salvandoItem, setSalvandoItem] = useState(false);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [incluirTotal, setIncluirTotal] = useState(true);
  /** Decisão obrigatória sobre mostrar o total no documento. */
  const [decisaoTotal, setDecisaoTotal] = useState<"" | "sim" | "nao">("");
  const [downloadDialogAberto, setDownloadDialogAberto] = useState(false);
  const [tipoGeracao, setTipoGeracao] = useState<"pdf" | "imagem" | null>(null);
  const inputArquivos = useRef<HTMLInputElement>(null);

  // ----- TAG -----
  const [tagAtivo, setTagAtivo] = useState(false);
  const [tagLargura, setTagLargura] = useState("");
  const [tagComprimento, setTagComprimento] = useState("");
  const [tagModo, setTagModo] = useState<"tags" | "folhas">("tags");
  const [tagQuantidade, setTagQuantidade] = useState("");
  const [tagPorFolhaDesejado, setTagPorFolhaDesejado] = useState("");
  const [tagDistribuicao, setTagDistribuicao] = useState("");

  /** Confirmação das páginas lidas nos arquivos com mais de 1 página. */
  const [paginasConfirmadas, setPaginasConfirmadas] = useState<string[]>([]);

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
              paginasAdicionais: Math.max(0, Number(salvo["paginas"] ?? 0) - Number(salvo["arquivos"] ?? 0)),
            }
          : {};
      setEstado({ ...ESTADO_INICIAL, ...(salvo as unknown as EstadoRascunho), ...compat });
    }
    setHidratado(true);
  }, [hidratado, rascunhoCarregado, rascunhoSalvo]);

  // ----- Arquivos enviados pela tela do WhatsApp -----
  const whatsappPendente = useRef<{ arquivos: { id: string; nome: string }[]; nome: string; telefone: string } | null>(null);
  const [importacao, setImportacao] = useState<{ ativo: boolean; progresso: number }>({
    ativo: false,
    progresso: 0,
  });
  useEffect(() => {
    try {
      const bruto = sessionStorage.getItem(CHAVE_ARQUIVOS_WHATSAPP);
      if (bruto) {
        sessionStorage.removeItem(CHAVE_ARQUIVOS_WHATSAPP);
        const dados = JSON.parse(bruto) as
          | { id: string; nome: string }[]
          | { arquivos: { id: string; nome: string }[]; nome?: string; telefone?: string };
        // Aceita também o formato antigo (lista simples de arquivos).
        whatsappPendente.current = Array.isArray(dados)
          ? { arquivos: dados, nome: "", telefone: "" }
          : { arquivos: dados.arquivos ?? [], nome: dados.nome ?? "", telefone: dados.telefone ?? "" };
      }
    } catch {
      whatsappPendente.current = null;
    }
  }, []);

  useEffect(() => {
    if (!hidratado) return;
    const itens = whatsappPendente.current;
    whatsappPendente.current = null;
    if (!itens || itens.length === 0) return;
    void importarArquivosWhatsapp(itens);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidratado]);

  /** Limpa a tela (como "Novo Pedido") e anexa os arquivos vindos do WhatsApp. */
  async function importarArquivosWhatsapp(itens: { id: string; nome: string }[]) {
    limparFormulario(false);
    setImportacao({ ativo: true, progresso: 0 });
    try {
      const arquivos: File[] = [];
      let baixados = 0;
      for (const item of itens) {
        try {
          const resposta = await fetch(`/api/public/whatsapp/midia?id=${encodeURIComponent(item.id)}`);
          if (resposta.ok) {
            const blob = await resposta.blob();
            arquivos.push(new File([blob], item.nome, { type: blob.type || "application/octet-stream" }));
          }
        } catch {
          /* ignora falhas individuais de download */
        }
        baixados += 1;
        // Downloads representam até 80% do progresso; os 20% finais são a contagem de páginas.
        setImportacao({ ativo: true, progresso: Math.round((baixados / itens.length) * 80) });
      }
      if (arquivos.length === 0) {
        toast.error("Não foi possível obter os arquivos selecionados no WhatsApp.");
        return;
      }
      setImportacao({ ativo: true, progresso: 90 });
      await anexarArquivos(arquivos, []);
      setImportacao({ ativo: true, progresso: 100 });
    } finally {
      setImportacao({ ativo: false, progresso: 0 });
    }
  }

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

  // ----- Ao sair da calculadora, descarta o rascunho (tela volta limpa) -----
  const usuarioRef = useRef(user?.id);
  usuarioRef.current = user?.id;
  const pedidoRef = useRef(estado.pedidoId);
  pedidoRef.current = estado.pedidoId;
  useEffect(() => {
    return () => {
      const pedidoAnterior = pedidoRef.current;
      if (pedidoAnterior) {
        queryClient.removeQueries({ queryKey: ["orcamentos-pedido", pedidoAnterior] });
        queryClient.removeQueries({ queryKey: ["pedido", pedidoAnterior] });
      }
      const usuarioId = usuarioRef.current;
      if (usuarioId) {
        queryClient.setQueryData(["rascunho", usuarioId], ESTADO_INICIAL as unknown as Record<string, unknown>);
        void supabase
          .from("rascunhos")
          .upsert(
            { usuario_id: usuarioId, dados: ESTADO_INICIAL as unknown as never },
            { onConflict: "usuario_id" },
          );
      }
    };
  }, [queryClient]);

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
    }),
    [
      estado.paginasAdicionais,
      estado.arquivos,
      estado.copiasAdicionais,
      estado.tipoServico,
      estado.formato,
      estado.copiaManual,
    ],
  );

  const linhas = useMemo(() => calcularLinhas(materiais ?? [], entrada), [materiais, entrada]);

  const acabamentosVisiveis = useMemo(
    () => acabamentosDoTipo(acabamentos ?? [], (estado.tipoServico || undefined) as TipoServico | undefined),
    [acabamentos, estado.tipoServico],
  );

  const linhasAcabamento = useMemo(
    () =>
      calcularAcabamentos(acabamentosVisiveis, estado.selecao, {
        paginas: estado.arquivos + estado.paginasAdicionais + estado.copiasAdicionais,
      }),
    [acabamentosVisiveis, estado.selecao, estado.arquivos, estado.paginasAdicionais, estado.copiasAdicionais],
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
  /** Decisões obrigatórias antes de exibir valores/resumo. */
  const acabamentoOk =
    estado.decisaoAcabamento === "nao" || (estado.decisaoAcabamento === "sim" && linhasAcabamento.length > 0);
  const frenteVersoOk = estado.decisaoFrenteVerso !== "";
  /** Arquivos Word aguardando a quantidade de páginas informada manualmente. */
  const arquivosPendentes = estado.arquivosLista.filter((a) => a.paginasManuais === true || Number(a.paginas || 0) < 1);
  /** Existe ao menos um arquivo cuja contagem foi feita automaticamente. */
  const leituraAutomatica = estado.arquivosLista.some((a) => a.paginasManuais !== true && Number(a.paginas || 0) > 0);
  const mostrarTabela =
    !precisaSelecionar && !semQuantidade && acabamentoOk && frenteVersoOk && arquivosPendentes.length === 0;

  const materialSelecionado = linhasFinais.find((l) => l.material.id === estado.materialId) ?? null;

  const totalPedido = (itensPedido ?? []).reduce((acc, o) => acc + Number(o.valor_total ?? 0), 0);

  const num = (v: string) => Math.max(0, Number(v.replace(/\D/g, "")) || 0);

  async function anexarArquivos(originais: File[], atuais: ArquivoDoc[]) {
    setLendoArquivos(true);
    try {
      const r = await contarPaginas(originais);

      /**
       * Envia os PDFs para o storage para permitir a
       * reimpressão do documento a partir do pedido.
       */
      const caminhos = new Map<string, string>();
      await Promise.all(
        originais
          .filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))
          .map(async (f) => {
            const caminho = `${user?.id ?? "anonimo"}/${Date.now()}-${crypto.randomUUID()}.pdf`;
            const { error } = await supabase.storage
              .from("orcamento-arquivos")
              .upload(caminho, f, { contentType: "application/pdf", upsert: false });
            if (!error) caminhos.set(f.name, caminho);
          }),
      );

      const novos = r.arquivos.map((a) => ({ ...a, caminho: caminhos.get(a.nome) ?? null }));
      const lista = [...atuais, ...novos];
      aplicarArquivos(lista);
      if (r.ignorados.length > 0) toast.warning(`Arquivos ignorados: ${r.ignorados.join(", ")}`);
      if (r.manuais.length > 0) {
        toast.warning(
          `Informe manualmente a quantidade de páginas de: ${r.manuais.join(", ")}. Arquivos .DOC e alguns .DOCX não permitem contagem automática confiável no navegador.`,
        );
      }
      if (r.arquivos.length > 0) toast.success(`${r.arquivos.length} arquivo(s) anexado(s).`);
    } catch {
      toast.error("Não foi possível ler os arquivos.");
    } finally {
      setLendoArquivos(false);
    }
  }

  async function anexar(files: FileList | null) {
    if (!files || files.length === 0) return;
    try {
      await anexarArquivos(Array.from(files), estado.arquivosLista);
    } finally {
      if (inputArquivos.current) inputArquivos.current.value = "";
    }
  }
  function solicitarDownload(tipo: "pdf" | "imagem") {
    setTipoGeracao(tipo);
    setDownloadDialogAberto(true);
  }

  function aplicarArquivos(lista: ArquivoDoc[]) {
    const paginasAdicionais = lista.reduce((acc, a) => acc + Math.max(0, (a.paginas || 0) - 1), 0);
    const copiasAdicionais = lista.reduce((acc, a) => {
      const paginas = Math.max(0, a.paginas || 0);
      const copias = Math.max(1, a.copias ?? 1);
      return acc + paginas * copias - paginas;
    }, 0);
    setEstado((e) => ({
      ...e,
      arquivosLista: lista,
      arquivos: lista.length,
      paginasAdicionais,
      copiasAdicionais,
    }));
  }

  /** Atualiza um arquivo da lista e recalcula páginas/cópias adicionais. */
  function atualizarArquivo(indice: number, dados: Partial<ArquivoDoc>) {
    aplicarArquivos(estado.arquivosLista.map((a, i) => (i === indice ? { ...a, ...dados } : a)));
  }

  function removerArquivo(indice: number) {
    aplicarArquivos(estado.arquivosLista.filter((_, i) => i !== indice));
  }

  /** Remove todos os arquivos, zera arquivos, páginas e cópias adicionais e desmarca o tipo de impressão. */
  function removerTodosArquivos() {
    aplicarArquivos([]);
    setPaginasConfirmadas([]);
    set("tipoServico", "");
  }

  /** Perfil de impressão do material selecionado (ou perfil padrão). */
  const perfilAtual =
    (perfis ?? []).find((p) => p.id === materialSelecionado?.material.perfil_impressao_id) ??
    ({ ...PERFIL_VAZIO, id: "padrao", nome: "Padrão" } as PerfilImpressao);

  /** Arquivos anexados prontos para o modal de impressão. */
  const documentosImpressao: DocumentoParaImprimir[] = estado.arquivosLista
    .filter((a) => !!a.caminho)
    .map((a) => ({
      nome: a.nome,
      caminho: a.caminho ?? null,
      paginas: Math.max(0, a.paginas || 0),
      copias: Math.max(1, a.copias ?? 1),
      perfil: perfilAtual,
    }));

  function abrirImpressaoArquivos() {
    if (documentosImpressao.length === 0) {
      toast.error("Nenhum arquivo anexado disponível para impressão.");
      return;
    }
    setImpressaoAberta(true);
  }


  /** Chave de confirmação de um arquivo (muda se o nome ou as páginas mudarem). */
  const chaveArquivo = (a: ArquivoDoc) => `${a.nome}|${a.paginas}`;

  /** Arquivos com mais de 1 página que ainda aguardam confirmação da leitura. */
  const arquivosParaConfirmar = useMemo(
    () =>
      estado.arquivosLista.filter(
        (a) => !a.origemTag && Number(a.paginas || 0) > 1 && !paginasConfirmadas.includes(chaveArquivo(a)),
      ),
    [estado.arquivosLista, paginasConfirmadas],
  );

  function confirmarPaginas() {
    setPaginasConfirmadas(estado.arquivosLista.map(chaveArquivo));
    toast.success("Páginas confirmadas.");
  }

  // ----- TAG: quantas cabem na área de impressão do formato -----
  const areaFormato = useMemo(
    () => normalizarAreasImpressao(config?.areas_impressao)[estado.formato],
    [config?.areas_impressao, estado.formato],
  );
  const tagPorFolha = useMemo(
    () => tagsPorFolha(Number(tagLargura), Number(tagComprimento), areaFormato),
    [tagLargura, tagComprimento, areaFormato],
  );

  /** Resultado invertido: informando TAGs mostra folhas; informando folhas mostra TAGs. */
  const tagResultado = useMemo(() => {
    const qtd = Math.max(0, Number(tagQuantidade) || 0);
    if (qtd <= 0 || tagPorFolha < 1) return 0;
    return tagModo === "folhas" ? qtd * tagPorFolha : Math.ceil(qtd / tagPorFolha);
  }, [tagQuantidade, tagModo, tagPorFolha]);




  /** Converte milímetros em centímetros no padrão brasileiro (ex.: 45 -> "4,5"). */
  function mmParaCm(mm: number) {
    return (mm / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  }

  /** Calcula o tamanho da TAG a partir da quantidade desejada por folha. */
  function aplicarTagPorFolhaDesejado(valor: string) {
    setTagPorFolhaDesejado(valor);
    const alvo = Math.floor(Number(valor) || 0);
    if (alvo < 1) {
      setTagDistribuicao("");
      return;
    }
    const medida = tamanhoTagPorQuantidade(alvo, areaFormato);
    if (!medida) {
      setTagDistribuicao("");
      toast.error("Não é possível encaixar essa quantidade na área de impressão.");
      return;
    }
    setTagLargura(String(medida.largura));
    setTagComprimento(String(medida.altura));
    setTagDistribuicao(`${medida.colunas} coluna(s) x ${medida.linhas} linha(s)`);
  }

  /** Zera os campos da funcionalidade TAG. */
  function limparTag() {
    setTagAtivo(false);
    setTagLargura("");
    setTagComprimento("");
    setTagModo("tags");
    setTagQuantidade("");
    setTagPorFolhaDesejado("");
    setTagDistribuicao("");
  }

  function adicionarTagArquivo() {
    const largura = Number(tagLargura) || 0;
    const comprimento = Number(tagComprimento) || 0;
    if (largura <= 0 || comprimento <= 0) {
      toast.error("Informe a largura e o comprimento da TAG.");
      return;
    }
    if (tagPorFolha < 1) {
      toast.error("A TAG não cabe na área de impressão do formato selecionado.");
      return;
    }
    const qtd = Math.max(1, Number(tagQuantidade) || 0);
    const folhas = tagModo === "folhas" ? qtd : Math.ceil(qtd / tagPorFolha);
    const qtdTags = tagModo === "folhas" ? folhas * tagPorFolha : qtd;
    const numero = estado.arquivosLista.filter((a) => a.origemTag).length + 1;
    const nome = `TAG${numero} - TAMANHO: ${mmParaCm(largura)}x${mmParaCm(comprimento)} CM - QTD: ${qtdTags}`;
    aplicarArquivos([
      ...estado.arquivosLista,
      { nome, tipo: "TAG", paginas: 1, copias: folhas, frenteVerso: false, origemTag: true },
    ]);
    toast.success("TAG adicionada aos arquivos.");
  }

  /** Observação final do orçamento: nomes das TAGs + observação digitada. */
  const observacaoComTags = useMemo(() => {
    const tags = estado.arquivosLista.filter((a) => a.origemTag).map((a) => a.nome);
    return [...tags, estado.observacao.trim()].filter(Boolean).join("\n");
  }, [estado.arquivosLista, estado.observacao]);

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
    if (estado.pedidoId) {
      // O pedido salvo no rascunho pode ter sido excluído — valida antes de reutilizar.
      const { data: existente } = await supabase.from("pedidos").select("id").eq("id", estado.pedidoId).maybeSingle();
      if (existente) return estado.pedidoId;
      set("pedidoId", null);
    }
    const { data, error } = await supabase
      .from("pedidos")
      .insert({
        cliente_nome: estado.clienteNome,
        cliente_telefone: estado.clienteTelefone,
        observacao: observacaoComTags,
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
        observacao: observacaoComTags,
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
          observacao: observacaoComTags,
          validade: estado.validade || null,
        })
        .eq("id", pedidoId);

      set("editandoId", null);
      queryClient.invalidateQueries({ queryKey: ["orcamentos-pedido", pedidoId] });
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      queryClient.invalidateQueries({ queryKey: ["pedido", pedidoId] });
    } catch (e) {
      const msg =
        (e as { message?: string })?.message ||
        (e instanceof Error ? e.message : "") ||
        "Não foi possível salvar o orçamento.";
      toast.error(msg);
    } finally {
      setSalvandoItem(false);
    }
  }

  function editarItem(row: Record<string, unknown>) {
    const arquivos = (Array.isArray(row["arquivos"]) ? (row["arquivos"] as ArquivoDoc[]) : []).map((a) => ({
      ...a,
      copias: Math.max(1, Number(a.copias ?? 1) || 1),
      frenteVerso: a.frenteVerso === true,
    }));
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
          : Math.max(0, Number(row["paginas_total"] ?? 0) - Number(row["quantidade_arquivos"] ?? arquivos.length)),
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
    const anterior = estado.pedidoId;
    const novo: EstadoRascunho = manterPedido
      ? {
          ...ESTADO_INICIAL,
          pedidoId: estado.pedidoId,
          clienteNome: estado.clienteNome,
          clienteTelefone: estado.clienteTelefone,
          validade: estado.validade,
        }
      : { ...ESTADO_INICIAL };
    setEstado(novo);
    limparTag();
    setPaginasConfirmadas([]);
    if (!manterPedido) {
      // Descarta a lista de orçamentos que estava vinculada ao pedido anterior.
      setIncluirTotal(true);
      setDecisaoTotal("");
      if (anterior) {
        queryClient.removeQueries({ queryKey: ["orcamentos-pedido", anterior] });
        queryClient.removeQueries({ queryKey: ["pedido", anterior] });
      }
    }
    // Grava o rascunho limpo imediatamente (sem esperar o debounce) e atualiza o
    // cache, para que ao sair e voltar da tela nada antigo seja reidratado.
    if (user?.id) {
      queryClient.setQueryData(["rascunho", user.id], novo as unknown as Record<string, unknown>);
      void supabase
        .from("rascunhos")
        .upsert({ usuario_id: user.id, dados: novo as unknown as never }, { onConflict: "usuario_id" });
    }
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

  /** Texto do PIX (vazio quando não incluído). */
  const textoPix = config?.pix_ativo && estado.incluirPix ? montarTextoPix(config) : "";

  /** Texto do prazo de entrega (vazio quando não informado). */
  const textoPrazo = estado.precisaPrazo ? montarTextoPrazo(config, estado.prazoTipo, estado.prazoQuantidade) : "";

  function documentoDoPedido() {
    const validade = estado.validade || calcularValidadePadrao();

    return documentoDeOrcamentos((itensPedido ?? []) as unknown as Record<string, unknown>[], config, {
      numero: String(pedido?.numero ?? "-"),
      data: String(pedido?.created_at ?? new Date().toISOString()),
      clienteNome: estado.clienteNome,
      clienteTelefone: estado.clienteTelefone,
      validade: validade || null,
      observacao: observacaoComTags || null,
      pix: textoPix || null,
      prazoTexto: textoPrazo || null,
    });
  }

  /** Há arquivos no pedido cuja contagem de páginas foi lida automaticamente. */
  const leituraAutomaticaPedido =
    leituraAutomatica ||
    (itensPedido ?? []).some((o) =>
      (((o as unknown as { arquivos?: ArquivoDoc[] }).arquivos ?? []) as ArquivoDoc[]).some(
        (a) => a.paginasManuais !== true && Number(a.paginas || 0) > 0,
      ),
    );

  function documentoParaGerar() {
    return {
      ...documentoDoPedido(),
      mostrarTotal: incluirTotal,
      leituraAutomatica: leituraAutomaticaPedido,
    };
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

    if (!decisaoTotal) {
      toast.error("Responda se deseja mostrar o total no orçamento.");
      return false;
    }

    if (config?.pix_ativo && !estado.decisaoPix) {
      toast.error("Responda se deseja incluir os dados do PIX.");
      return false;
    }

    if (!estado.decisaoPrazo) {
      toast.error("Responda se deseja informar o prazo de entrega.");
      return false;
    }

    return true;
  }

  async function salvarDadosCliente() {
    if (!estado.pedidoId) return;
    const extras = {
      incluir_pix: estado.incluirPix,
      pix_texto_final: textoPix || null,
      precisa_prazo: estado.precisaPrazo,
      prazo_tipo: estado.prazoTipo || null,
      prazo_quantidade: Math.max(0, Number(estado.prazoQuantidade) || 0),
      prazo_texto_final: textoPrazo || null,
    };
    await supabase
      .from("pedidos")
      .update({
        cliente_nome: estado.clienteNome,
        cliente_telefone: estado.clienteTelefone,
        observacao: observacaoComTags,
        validade: estado.validade || null,
        ...extras,
      })
      .eq("id", estado.pedidoId);
    if ((itensPedido ?? []).length > 0) {
      await supabase
        .from("orcamentos")
        .update({
          cliente_nome: estado.clienteNome,
          cliente_telefone: estado.clienteTelefone,
          observacao: observacaoComTags,
          validade: estado.validade || null,
          ...extras,
        })
        .eq("pedido_id", estado.pedidoId);
      queryClient.invalidateQueries({ queryKey: ["orcamentos-pedido", estado.pedidoId] });
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
    }
  }

  return (
    <>
      {/* ==================== PRELOAD DA IMPORTAÇÃO DO WHATSAPP ==================== */}
      {importacao.ativo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-8 py-6 shadow-lg">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-card-foreground">Importando arquivos do WhatsApp…</p>
            <p className="text-2xl font-extrabold tabular-nums text-primary">
              {Math.round(importacao.progresso)}%
            </p>
          </div>
        </div>
      )}

      {/* ==================== HEADER FIXO ==================== */}
      <div className="sticky top-0 z-30 -mx-4 mb-6 border-b border-sidebar-border bg-sidebar px-4 pt-3 pb-3 text-sidebar-foreground sm:-mx-6 sm:px-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold tracking-tight text-sidebar-foreground sm:text-2xl">
              CALCULADORA DE IMPRESSÃO DIGITAL
            </h1>
            <p className="truncate text-xs text-sidebar-foreground/70 sm:text-sm">
              Anexe os arquivos, escolha as opções e veja o cálculo do seu pedido.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {pedido && (
              <Badge variant="secondary" className="hidden text-xs sm:inline-flex">
                Pedido {pedido.numero}
              </Badge>
            )}

            <ConfirmarAcao
              titulo="Novo pedido"
              descricao="Deseja iniciar um novo pedido? Os dados atuais que ainda não foram adicionados ao pedido serão descartados."
              rotuloConfirmar="Novo Pedido"
              onConfirmar={() => {
                limparFormulario(false);
                toast.success("Novo pedido iniciado.");
              }}
            >
              <Button size="sm">
                <ShoppingCart className="h-4 w-4" /> Novo Pedido
              </Button>
            </ConfirmarAcao>

            <Button
              size="sm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => setDialogAberto(true)}
            >
              <FileText className="h-4 w-4" /> Gerar Orçamento
            </Button>
          </div>
        </div>

        {/* ---------- FAIXA DE RESUMO ---------- */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
          <ResumoItem rotulo="Total de Arquivos" valor={numeroBR(estado.arquivos)} />
          <ResumoItem rotulo="Páginas Adicionais" valor={numeroBR(paginasAdicionais)} />
          <ResumoItem rotulo="Cópias Adicionais" valor={numeroBR(estado.copiasAdicionais)} />
          <ResumoItem rotulo="Total para Cobrança" valor={numeroBR(quantidadeTotal)} destaque />
          <ResumoItem rotulo="Valor do Acabamento" valor={brl(valorAcabamento)} />
          <ResumoItem
            rotulo="Tipo de Impressão"
            valor={
              estado.tipoServico === "simples"
                ? "Impressão Simples"
                : estado.tipoServico === "especial"
                  ? "Impressão Especial"
                  : "—"
            }
            pequeno
          />
          <ResumoItem rotulo="Formato" valor={estado.formato} pequeno />
          <ResumoItem rotulo="Material" valor={materialSelecionado?.material.nome ?? "—"} pequeno />

          <div className="col-span-2 rounded-lg border border-success/50 bg-success/15 px-3 py-2 sm:col-span-3 lg:col-span-1">
            <p className="text-[10px] font-bold tracking-wider text-sidebar-foreground/70">VALOR TOTAL</p>
            <p className="truncate text-xl font-extrabold text-success">
              {materialSelecionado ? brl(materialSelecionado.total) : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* ==================== DADOS DO TRABALHO ==================== */}
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
          {/* ---------- TAG ---------- */}
          <div className="mb-5">
            {!tagAtivo ? (
              <Button variant="outline" size="sm" onClick={() => setTagAtivo(true)}>
                <Tag className="h-4 w-4" /> Adicionar TAG
              </Button>
            ) : (
              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-accent/30 p-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">TAGs por folha (desejado)</Label>
                  <Input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    className="h-8 w-28"
                    placeholder="ex.: 8"
                    value={tagPorFolhaDesejado}
                    onChange={(e) => aplicarTagPorFolhaDesejado(e.target.value)}
                  />
                  {tagDistribuicao && (
                    <p className="text-[11px] font-medium text-muted-foreground">{tagDistribuicao}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Largura (mm)</Label>
                  <Input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    className="h-8 w-24"
                    value={tagLargura}
                    onChange={(e) => setTagLargura(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Comprimento (mm)</Label>
                  <Input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    className="h-8 w-24"
                    value={tagComprimento}
                    onChange={(e) => setTagComprimento(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-primary">Tags por folha ({estado.formato})</Label>
                  <p className="flex h-9 items-center rounded-md border-2 border-primary bg-primary/10 px-3 text-base font-extrabold text-primary">
                    {tagPorFolha}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-primary">
                    {tagModo === "tags" ? "Total de folhas" : "Total de TAGs"}
                  </Label>
                  <p className="flex h-9 items-center rounded-md border-2 border-primary bg-primary/10 px-3 text-base font-extrabold text-primary">
                    {tagResultado}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Informar</Label>
                  <div className="flex h-8 overflow-hidden rounded-md border border-border">
                    <Button
                      type="button"
                      variant={tagModo === "tags" ? "default" : "ghost"}
                      className="h-full rounded-none px-3 text-xs"
                      onClick={() => setTagModo("tags")}
                    >
                      Qtd. de TAGs
                    </Button>
                    <Button
                      type="button"
                      variant={tagModo === "folhas" ? "default" : "ghost"}
                      className="h-full rounded-none px-3 text-xs"
                      onClick={() => setTagModo("folhas")}
                    >
                      Qtd. de folhas
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    {tagModo === "tags" ? "Quantidade de TAGs" : "Quantidade de folhas"}
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    className="h-8 w-24"
                    value={tagQuantidade}
                    onChange={(e) => setTagQuantidade(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  className="h-8"
                  disabled={!tagQuantidade || Number(tagQuantidade) <= 0}
                  onClick={adicionarTagArquivo}
                >
                  <Paperclip className="h-4 w-4" /> Adicionar arquivo
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={limparTag}
                >
                  Cancelar
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            {/* ---------- COLUNA ESQUERDA: ARQUIVOS ---------- */}
            <div className="space-y-3">
              <input
                ref={inputArquivos}
                type="file"
                multiple
                accept="application/pdf,image/*,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => anexar(e.target.files)}
              />
              <Button
                variant="outline"
                className="w-full"
                disabled={lendoArquivos}
                onClick={() => inputArquivos.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
                {lendoArquivos ? "Lendo arquivos..." : "Anexar PDFs / Imagens / Word"}
              </Button>

              <p className="text-xs text-muted-foreground">
                As páginas dos PDFs e imagens são contadas automaticamente; cada arquivo já inclui 1 página e o
                excedente vira páginas adicionais. Arquivos Word (.doc/.docx) sempre exigem que a quantidade de páginas
                seja informada manualmente.
              </p>

              <div className="rounded-xl border border-border p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold tracking-wider text-muted-foreground">ARQUIVOS ANEXADOS</p>

                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={estado.arquivosLista.length === 0}
                      onClick={abrirImpressaoArquivos}
                    >
                      <FileStack className="h-4 w-4" /> Imprimir documentos
                    </Button>

                    <ConfirmarExclusao
                      titulo="Remover todos os arquivos"
                      descricao="Isso remove todos os arquivos anexados e zera a quantidade de arquivos, as páginas adicionais e as cópias adicionais."
                      rotuloConfirmar="Remover todos"
                      onConfirmar={removerTodosArquivos}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive"
                        disabled={estado.arquivosLista.length === 0}
                      >
                        <Trash2 className="h-4 w-4" /> Remover todos
                      </Button>
                    </ConfirmarExclusao>
                  </div>
                </div>

                {arquivosPendentes.length > 0 && (
                  <div className="mb-2 rounded-lg border-2 border-destructive bg-destructive/10 p-2.5">
                    <p className="text-sm font-bold text-destructive">
                      {arquivosPendentes.length} arquivo(s) Word aguardando a quantidade de páginas
                    </p>
                    <p className="text-xs font-medium text-destructive">
                      O cálculo fica bloqueado até que todas as quantidades sejam informadas.
                    </p>
                  </div>
                )}

                {arquivosParaConfirmar.length > 0 && (
                  <div className="mb-2 space-y-2 rounded-lg border-2 border-primary bg-primary/10 p-2.5">
                    <p className="text-sm font-bold text-primary">Confirme a quantidade de páginas lida</p>
                    <ul className="space-y-0.5 text-xs font-medium text-primary">
                      {arquivosParaConfirmar.map((a, i) => (
                        <li key={`conf-${a.nome}-${i}`} className="break-all">
                          {a.nome} → {numeroBR(a.paginas)} página(s)
                        </li>
                      ))}
                    </ul>
                    <Button size="sm" className="h-8" onClick={confirmarPaginas}>
                      Confirmar páginas
                    </Button>
                  </div>
                )}

                {estado.arquivosLista.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Nenhum arquivo anexado.</p>
                ) : (
                  <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
                    {estado.arquivosLista.map((a, i) => {
                      const copias = Math.max(1, a.copias ?? 1);
                      const pendente = a.paginasManuais === true || Number(a.paginas || 0) < 1;
                      const bloqueado = a.origemTag === true;
                      return (
                        <div
                          key={`${a.nome}-${i}`}
                          className={`rounded-lg border p-2.5 ${
                            pendente ? "border-2 border-destructive bg-destructive/5" : "border-border bg-accent/30"
                          }`}
                        >
                          <p className="text-sm font-semibold break-all">{a.nome}</p>

                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{a.tipo}</span>
                            <span>·</span>
                            <span>{numeroBR(a.paginas)} página(s)</span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            {/* PÁGINAS (editável; bloqueado para TAG) */}
                            <div className="flex items-center gap-2">
                              <Label className="text-xs font-semibold">Páginas:</Label>
                              {bloqueado ? (
                                <span className="flex h-8 w-20 items-center rounded-md border border-input bg-muted px-2 text-sm font-bold text-muted-foreground">
                                  {numeroBR(a.paginas)}
                                </span>
                              ) : (
                                <Input
                                  type="number"
                                  min="1"
                                  inputMode="numeric"
                                  placeholder="0"
                                  className={`h-8 w-20 ${pendente ? "border-2 border-destructive font-bold" : ""}`}
                                  value={a.paginas || ""}
                                  onChange={(e) =>
                                    atualizarArquivo(i, {
                                      paginas: Math.max(1, num(e.target.value) || 1),
                                      paginasManuais: false,
                                    })
                                  }
                                />
                              )}
                            </div>

                            {/* CÓPIAS (bloqueado para TAG) */}
                            <div className="flex items-center gap-2">
                              <Label className="text-xs font-semibold">Cópias:</Label>
                              {bloqueado ? (
                                <span className="flex h-8 w-16 items-center justify-center rounded-md border border-input bg-muted text-sm font-bold text-muted-foreground">
                                  {copias}
                                </span>
                              ) : (
                                <div className="flex h-8 items-center overflow-hidden rounded-md border border-input">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-full rounded-none px-2"
                                    onClick={() => atualizarArquivo(i, { copias: Math.max(1, copias - 1) })}
                                  >
                                    −
                                  </Button>
                                  <Input
                                    type="number"
                                    min="1"
                                    inputMode="numeric"
                                    value={copias}
                                    onChange={(e) =>
                                      atualizarArquivo(i, {
                                        copias: Math.max(1, num(e.target.value) || 1),
                                      })
                                    }
                                    className="h-full w-16 rounded-none border-0 text-center font-bold focus-visible:ring-0"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-full rounded-none px-2"
                                    onClick={() => atualizarArquivo(i, { copias: copias + 1 })}
                                  >
                                    +
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* FRENTE E VERSO (bloqueado para TAG) */}
                            {bloqueado ? (
                              <span className="text-xs font-medium text-muted-foreground">
                                Frente e verso: {a.frenteVerso ? "Sim" : "Não"}
                              </span>
                            ) : (
                              <label className="flex items-center gap-2 text-xs font-medium">
                                <Checkbox
                                  checked={a.frenteVerso ?? false}
                                  onCheckedChange={(v) => atualizarArquivo(i, { frenteVerso: v === true })}
                                />
                                Frente e verso
                              </label>
                            )}

                            <ConfirmarExclusao
                              titulo="Remover arquivo"
                              descricao="Tem certeza que deseja remover este arquivo do orçamento?"
                              rotuloConfirmar="Remover"
                              onConfirmar={() => removerArquivo(i)}
                            >
                              <Button variant="ghost" size="sm" className="ml-auto text-destructive">
                                <Trash2 className="h-4 w-4" /> Remover
                              </Button>
                            </ConfirmarExclusao>
                          </div>

                          {pendente && (
                            <p className="mt-2 text-xs font-bold text-destructive">
                              Informe a quantidade de páginas deste arquivo.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ---------- COLUNA DIREITA: CONFIGURAÇÃO ---------- */}
            <div className="space-y-4">
              <Campo icon={<Files className="h-4 w-4 text-cyan-ink" />} label="Quantidade de arquivos">
                <div className="flex h-8 overflow-hidden rounded-md border border-border bg-background">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-full w-4 shrink-0 rounded-none border-r text-base"
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
                    className="h-full rounded-none border-0 text-center text-sm font-bold focus-visible:ring-0"
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    className="h-full w-9 shrink-0 rounded-none border-l text-base"
                    onClick={() => set("arquivos", estado.arquivos + 1)}
                  >
                    +
                  </Button>
                </div>
              </Campo>

              <Campo icon={<FileStack className="h-4 w-4 text-navy" />} label="Páginas adicionais">
                <div className="flex h-8 overflow-hidden rounded-md border border-border bg-background">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-full w-9 shrink-0 rounded-none border-r text-base"
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
                    className="h-full rounded-none border-0 text-center text-sm font-bold focus-visible:ring-0"
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    className="h-full w-9 shrink-0 rounded-none border-l text-base"
                    onClick={() => set("paginasAdicionais", estado.paginasAdicionais + 1)}
                  >
                    +
                  </Button>
                </div>
              </Campo>

              <Campo icon={<Copy className="h-4 w-4 text-magenta-ink" />} label="Cópias adicionais">
                <div className="flex h-8 overflow-hidden rounded-md border border-border bg-background">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-full w-9 shrink-0 rounded-none border-r text-base"
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
                    className="h-full rounded-none border-0 text-center text-sm font-bold shadow-none focus-visible:ring-0"
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    className="h-full w-9 shrink-0 rounded-none border-l text-base"
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

              <div className="space-y-2 rounded-lg border border-border p-3">
                <Label className="text-xs font-semibold text-muted-foreground">Tipo de impressão *</Label>
                {arquivosParaConfirmar.length > 0 && (
                  <p className="text-xs font-semibold text-destructive">
                    Confirme a quantidade de páginas dos arquivos para liberar.
                  </p>
                )}
                <RadioGroup
                  value={estado.tipoServico}
                  onValueChange={(v) => set("tipoServico", v as TipoServico)}
                  disabled={arquivosParaConfirmar.length > 0}
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

              <div className="space-y-2 rounded-lg border border-border p-3">
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

              <div className="space-y-2">
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
                  Ativado, mostra em valores de impressão apenas os materiais da categoria &quot;Cópia&quot;.
                  Desativado, mostra os materiais da categoria &quot;Impressão&quot;.
                </p>
              </div>

              {precisaSelecionar && (
                <p className="rounded-lg border border-border bg-accent/60 p-3 text-sm font-semibold text-primary">
                  Selecione o tipo de impressão para ver os valores automaticamente.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ==================== 3 COLUNAS ==================== */}
      {!precisaSelecionar && (
        <div className="mb-6 grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
          {/* ==================== COLUNA 1 — ACABAMENTO ==================== */}
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-bold tracking-wide">
                <span className="rounded-lg bg-accent p-2 text-primary">
                  <Scissors className="h-4 w-4" />
                </span>
                ACABAMENTO
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Decisão obrigatória: usar acabamento? */}
              <div className="rounded-lg border border-border bg-accent/30 px-2.5 py-2">
                <p className="mb-2 text-sm font-semibold">Deseja acabamento?</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={estado.decisaoAcabamento === "sim" ? "default" : "outline"}
                    onClick={() => set("decisaoAcabamento", "sim")}
                  >
                    Sim
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={estado.decisaoAcabamento === "nao" ? "default" : "outline"}
                    onClick={() => setEstado((p) => ({ ...p, decisaoAcabamento: "nao", selecao: {} }))}
                  >
                    Não
                  </Button>
                </div>
                {estado.decisaoAcabamento === "sim" && linhasAcabamento.length === 0 && (
                  <p className="mt-2 text-[11px] font-semibold text-destructive">
                    Selecione ao menos uma opção de acabamento.
                  </p>
                )}
              </div>

              {estado.decisaoAcabamento === "sim" &&
                (acabamentosVisiveis.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum acabamento disponível para o tipo de impressão selecionado.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {acabamentosVisiveis.map((a) => {
                      const sel = estado.selecao[a.id] ?? {
                        ativo: false,
                        quantidade: 1,
                      };

                      const linha = linhasAcabamento.find((l) => l.acabamento.id === a.id);

                      return (
                        <div
                          key={a.id}
                          className={`rounded-lg border px-2.5 py-2 transition-colors ${
                            sel.ativo ? "border-primary bg-accent/50" : "border-border bg-card"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
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
                                <p className="truncate text-sm font-semibold">{a.nome}</p>

                                <p className="truncate text-[11px] text-muted-foreground">
                                  {rotuloCobranca[a.cobranca]} · {brl(Number(a.valor) || 0)}
                                  {a.cobranca === "bloco" ? ` a cada ${a.paginas_bloco} páginas` : ""}
                                </p>
                              </div>
                            </label>

                            {sel.ativo && a.cobranca === "quantidade" && (
                              <div className="flex shrink-0 items-center overflow-hidden rounded-md border border-border bg-background">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-none border-r"
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

                                <div className="flex h-7 min-w-8 items-center justify-center px-1 text-sm font-bold">
                                  {sel.quantidade}
                                </div>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-none border-l"
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

                            {sel.ativo && (
                              <span className="shrink-0 text-sm font-bold text-success">{brl(linha?.total ?? 0)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}

              {/* Frente e verso — decisão obrigatória */}
              <div className="rounded-lg border border-border bg-accent/30 px-2.5 py-2">
                <p className="mb-2 text-sm font-semibold">Frente e verso?</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={estado.decisaoFrenteVerso === "sim" ? "default" : "outline"}
                    onClick={() => setEstado((p) => ({ ...p, decisaoFrenteVerso: "sim", frenteVerso: true }))}
                  >
                    Sim
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={estado.decisaoFrenteVerso === "nao" ? "default" : "outline"}
                    onClick={() => setEstado((p) => ({ ...p, decisaoFrenteVerso: "nao", frenteVerso: false }))}
                  >
                    Não
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ==================== COLUNA 2 — VALORES DE IMPRESSÃO ==================== */}
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-bold tracking-wide">
                <span className="rounded-lg bg-accent p-2 text-primary">
                  <Printer className="h-4 w-4" />
                </span>
                VALORES DE IMPRESSÃO
              </CardTitle>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  size="sm"
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

                <Button size="sm" disabled={!mostrarTabela || salvandoItem} onClick={adicionarAoPedido}>
                  <Plus className="h-4 w-4" />

                  {estado.editandoId ? "Salvar alterações" : "Adicionar ao Pedido"}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
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
                      : arquivosPendentes.length > 0
                        ? `Informe a quantidade de páginas de: ${arquivosPendentes.map((a) => a.nome).join(", ")}.`
                        : semQuantidade
                          ? "Informe arquivos, páginas adicionais ou cópias adicionais para ver os valores."
                          : !frenteVersoOk
                            ? "Informe se o trabalho é frente e verso para ver os valores."
                            : "Escolha se haverá acabamento (e selecione ao menos uma opção) para ver os valores."}
                  </p>
                </div>
              ) : (
                <div className="max-h-[430px] space-y-1.5 overflow-y-auto pr-1">
                  {linhasFinais.map((l) => {
                    const ativa = materialSelecionado?.material.id === l.material.id;

                    return (
                      <button
                        type="button"
                        key={l.material.id}
                        onClick={() => set("materialId", l.material.id)}
                        className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                          ativa ? "border-primary bg-accent/50" : "border-border bg-card hover:bg-accent/30"
                        }`}
                      >
                        <input
                          type="radio"
                          className="h-4 w-4 shrink-0 accent-[var(--color-primary)]"
                          checked={ativa}
                          onChange={() => set("materialId", l.material.id)}
                          aria-label={`Selecionar ${l.material.nome}`}
                        />

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{l.material.nome}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {l.material.descricao} · Preço uni. {brl(l.valorUnitario)}
                          </p>
                        </div>

                        <span className="shrink-0 text-sm font-extrabold text-success">{brl(l.total)}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Valores baseados na configuração de preços.
              </p>
            </CardContent>
          </Card>

          {/* ==================== COLUNA 3 — RESUMO DO CÁLCULO ==================== */}
          <Card className="shadow-card md:col-span-2 xl:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-bold tracking-wide">
                <span className="rounded-lg bg-accent p-2 text-primary">
                  <Calculator className="h-4 w-4" />
                </span>
                RESUMO DO CÁLCULO
              </CardTitle>
            </CardHeader>

            <CardContent>
              {!materialSelecionado ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Informe os dados do trabalho para ver o resumo.
                </p>
              ) : (
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="truncate text-muted-foreground">Material</dt>
                    <dd className="truncate font-semibold">{materialSelecionado.material.nome}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Arquivos ({numeroBR(estado.arquivos)})</dt>
                    <dd className="font-semibold">{brl(materialSelecionado.totalArquivos)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Páginas adicionais ({numeroBR(paginasAdicionais)})</dt>
                    <dd className="font-semibold">{brl(materialSelecionado.totalPaginasAdicionais)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Cópias adicionais ({numeroBR(estado.copiasAdicionais)})</dt>
                    <dd className="font-semibold">{brl(materialSelecionado.totalCopiasAdicionais)}</dd>
                  </div>

                  <div className="flex justify-between gap-2 border-t border-border pt-2">
                    <dt className="font-semibold">Subtotal impressão</dt>
                    <dd className="font-bold">
                      {brl(
                        materialSelecionado.totalArquivos +
                          materialSelecionado.totalPaginasAdicionais +
                          materialSelecionado.totalCopiasAdicionais,
                      )}
                    </dd>
                  </div>

                  {linhasAcabamento.length > 0 && (
                    <div className="space-y-1 border-t border-border pt-2">
                      <p className="text-[11px] font-bold tracking-wider text-muted-foreground">ACABAMENTOS</p>
                      {linhasAcabamento.map((l) => (
                        <div key={l.acabamento.id} className="flex justify-between gap-2">
                          <dt className="truncate text-muted-foreground">
                            {l.acabamento.nome} ({numeroBR(l.quantidade)})
                          </dt>
                          <dd className="font-semibold">{brl(l.total)}</dd>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between gap-2 border-t border-border pt-2">
                    <dt className="font-semibold">Subtotal acabamentos</dt>
                    <dd className="font-bold">{brl(valorAcabamento)}</dd>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-success/40 bg-success/10 px-3 py-3">
                    <dt className="text-sm font-bold">TOTAL</dt>
                    <dd className="text-2xl font-extrabold text-success">{brl(materialSelecionado.total)}</dd>
                  </div>
                </dl>
              )}
            </CardContent>
          </Card>
        </div>
      )}

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
                  <th className="px-3 py-3 text-right">PÁG. ADIC.</th>
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
                    <td className="px-3 py-3 text-right">{numeroBR(Number(o.paginas_adicionais ?? 0))}</td>
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

          {leituraAutomaticaPedido && (
            <div className="rounded-lg border-2 border-yellow-ink bg-yellow-ink/15 p-3">
              <p className="text-sm font-bold text-foreground">
                Quantidade de páginas foi lida automaticamente, favor verificar se há divergência!
              </p>
            </div>
          )}

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

                <Button
                  type="button"
                  variant={estado.clienteNome === "CLIENTE PADRÃO" ? "default" : "outline"}
                  onClick={() => set("clienteNome", estado.clienteNome === "CLIENTE PADRÃO" ? "" : "CLIENTE PADRÃO")}
                >
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
            <div className="rounded-xl border border-border p-3 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Mostrar total? *</p>
                  <p className="text-xs text-muted-foreground">
                    Escolha "Não" para gerar o orçamento sem exibir os valores totais.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={decisaoTotal === "sim" ? "default" : "outline"}
                    onClick={() => {
                      setDecisaoTotal("sim");
                      setIncluirTotal(true);
                    }}
                  >
                    Sim
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={decisaoTotal === "nao" ? "default" : "outline"}
                    onClick={() => {
                      setDecisaoTotal("nao");
                      setIncluirTotal(false);
                    }}
                  >
                    Não
                  </Button>
                </div>
              </div>
            </div>

            {config?.pix_ativo && (
              <div className="rounded-xl border border-border p-3 sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Incluir pagamento via PIX? *</p>
                    <p className="text-xs text-muted-foreground">Adiciona os dados do PIX no documento do orçamento.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={estado.decisaoPix === "sim" ? "default" : "outline"}
                      onClick={() => setEstado((p) => ({ ...p, decisaoPix: "sim", incluirPix: true }))}
                    >
                      Sim
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={estado.decisaoPix === "nao" ? "default" : "outline"}
                      onClick={() => setEstado((p) => ({ ...p, decisaoPix: "nao", incluirPix: false }))}
                    >
                      Não
                    </Button>
                  </div>
                </div>
                {estado.incluirPix && textoPix && (
                  <pre className="mt-2 rounded-md bg-muted p-2 text-xs whitespace-pre-wrap">{textoPix}</pre>
                )}
              </div>
            )}

            <div className="rounded-xl border border-border p-3 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Informar prazo de entrega? *</p>
                  <p className="text-xs text-muted-foreground">Escolha entre horas ou dias e a quantidade.</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={estado.decisaoPrazo === "sim" ? "default" : "outline"}
                    onClick={() => setEstado((p) => ({ ...p, decisaoPrazo: "sim", precisaPrazo: true }))}
                  >
                    Sim
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={estado.decisaoPrazo === "nao" ? "default" : "outline"}
                    onClick={() =>
                      setEstado((p) => ({
                        ...p,
                        decisaoPrazo: "nao",
                        precisaPrazo: false,
                        prazoTipo: "",
                        prazoQuantidade: 0,
                      }))
                    }
                  >
                    Não
                  </Button>
                </div>
              </div>

              {estado.precisaPrazo && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Select value={estado.prazoTipo} onValueChange={(v) => set("prazoTipo", v as PrazoTipo)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Horas ou dias" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="horas">Horas</SelectItem>
                      <SelectItem value="dias">Dias</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    inputMode="numeric"
                    placeholder="Quantidade"
                    value={estado.prazoQuantidade ? String(estado.prazoQuantidade) : ""}
                    onChange={(e) => set("prazoQuantidade", num(e.target.value))}
                  />
                  {textoPrazo && <p className="text-xs text-muted-foreground sm:col-span-2">{textoPrazo}</p>}
                </div>
              )}
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

      <ImprimirDocumentosDialog
        aberto={impressaoAberta}
        onOpenChange={setImpressaoAberta}
        documentos={documentosImpressao}
        impressoraPadrao={(config?.impressora_padrao_nome ?? null) as string | null}
      />
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

function ResumoItem({
  rotulo,
  valor,
  destaque,
  pequeno,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
  pequeno?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-sidebar-border bg-sidebar-accent/60 px-3 py-2">
      <p className="truncate text-[10px] font-bold tracking-wider text-sidebar-foreground/60">{rotulo.toUpperCase()}</p>
      <p
        className={`truncate font-extrabold ${pequeno ? "text-sm" : "text-lg"} ${
          destaque ? "text-success" : "text-sidebar-foreground"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Bot as BotIcon,
  BotOff,
  Calculator,
  CheckCircle2,
  CheckSquare,
  Clock,
  Copy,
  Download,
  FileText,
  Flag,
  Headset,
  MessageSquare,
  Mic,
  Printer,
  Search,
  StickyNote,
  Send,
  Square,
  UserCheck,
  X,
  type LucideIcon,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { enviarDigitandoWhatsapp, enviarParaFinalizacao, enviarTextoWhatsapp, transcreverAudioWhatsapp } from "@/lib/whatsapp.functions";
import { cn } from "@/lib/utils";
import {
  STATUS_CONVERSA,
  dataHoraCurta,
  formatarTelefone,
  rotuloStatusConversa,
  type StatusConversa,
} from "@/lib/whatsapp-comum";

export const Route = createFileRoute("/whatsapp")({
  component: () => (
    <AppLayout>
      <Atendimento />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Atendimento WhatsApp | Impressão Digital" },
      { name: "description", content: "Converse com os clientes pelo WhatsApp e transforme mensagens em orçamentos." },
      { property: "og:title", content: "Atendimento WhatsApp | Impressão Digital" },
      { property: "og:description", content: "Central de atendimento integrada ao WhatsApp da gráfica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

interface Conversa {
  id: string;
  telefone: string;
  nome_contato: string | null;
  status: string;
  etapa: string;
  atendente_nome: string | null;
  ultima_mensagem: string | null;
  ultima_mensagem_em: string | null;
  total_mensagens: number;
  nao_lidas: number;
  pedido_id: string | null;
  orcamento_id: string | null;
  created_at: string;
  atendimento_numero: number;
  data_finalizacao: string | null;
}

interface Mensagem {
  id: string;
  conversa_id: string;
  direcao: string;
  autor: string | null;
  tipo: string;
  texto: string | null;
  arquivo_nome: string | null;
  arquivo_url: string | null;
  mime_type: string | null;
  status: string;
  erro: string | null;
  data_hora: string;
  transcricao: string | null;
}

/** Ícone de cada aba de status. */
const ICONE_STATUS: Record<StatusConversa, LucideIcon> = {
  automatico: Bot,
  aguardando: Clock,
  em_atendimento: Headset,
  pendente: AlertCircle,
  esperando_impressao: Printer,
  aguardando_finalizacao: Flag,
  finalizado: CheckCircle2,
};

function useConversas() {
  return useQuery({
    queryKey: ["whatsapp-conversas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_conversas")
        .select("*")
        .order("ultima_mensagem_em", { ascending: false, nullsFirst: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as Conversa[];
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
}

/** Texto sem acento, minúsculo, para busca. */
function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Atualiza o status da conversa e registra a auditoria. */
async function alterarStatusConversa(
  conversaId: string,
  status: StatusConversa,
  acao: string,
  atendente: string,
  atendenteId: string | null,
) {
  const extra: {
    status: string;
    atendente_id?: string | null;
    atendente_nome?: string | null;
    inicio_atendimento?: string;
    data_finalizacao?: string;
  } = { status };
  if (status === "em_atendimento") {
    extra.atendente_id = atendenteId;
    extra.atendente_nome = atendente;
    extra.inicio_atendimento = new Date().toISOString();
  }
  if (status === "finalizado") extra.data_finalizacao = new Date().toISOString();
  if (status === "automatico") {
    extra.atendente_id = null;
    extra.atendente_nome = null;
  }

  const { error } = await supabase.from("whatsapp_conversas").update(extra).eq("id", conversaId);
  if (error) {
    toast.error(error.message);
    return false;
  }

  await supabase.from("whatsapp_auditoria").insert({
    conversa_id: conversaId,
    usuario_id: atendenteId,
    usuario_nome: atendente,
    acao,
    detalhe: null,
  });

  toast.success("Conversa atualizada.");
  return true;
}

function Atendimento() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: conversas, isLoading } = useConversas();
  const isMobile = useIsMobile();
  const [aba, setAba] = useState<StatusConversa>("automatico");
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [todasFinalizadas, setTodasFinalizadas] = useState(false);
  const [idsBuscaMensagem, setIdsBuscaMensagem] = useState<Set<string> | null>(null);

  // Trocar de aba volta a mostrar somente os finalizados de hoje.
  useEffect(() => {
    setTodasFinalizadas(false);
  }, [aba]);

  // Largura da lista de contatos (arrastável e salva no navegador).
  const LARGURA_PADRAO = 340;
  const [larguraLista, setLarguraLista] = useState(LARGURA_PADRAO);
  const larguraRef = useRef(LARGURA_PADRAO);
  const inicioRef = useRef({ x: 0, largura: LARGURA_PADRAO });

  useEffect(() => {
    const salvo = Number(localStorage.getItem("whatsapp:largura-lista"));
    if (Number.isFinite(salvo) && salvo >= 260 && salvo <= 560) {
      larguraRef.current = salvo;
      setLarguraLista(salvo);
    }
  }, []);

  function iniciarArraste(e: React.PointerEvent) {
    e.preventDefault();
    inicioRef.current = { x: e.clientX, largura: larguraRef.current };
    const mover = (ev: PointerEvent) => {
      const largura = Math.min(
        560,
        Math.max(260, inicioRef.current.largura + (ev.clientX - inicioRef.current.x)),
      );
      larguraRef.current = largura;
      setLarguraLista(largura);
    };
    const soltar = () => {
      localStorage.setItem("whatsapp:largura-lista", String(larguraRef.current));
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  }

  function restaurarLargura() {
    larguraRef.current = LARGURA_PADRAO;
    setLarguraLista(LARGURA_PADRAO);
    localStorage.setItem("whatsapp:largura-lista", String(LARGURA_PADRAO));
  }


  useEffect(() => {
    const canal = supabase

      .channel("whatsapp-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversas" }, () => {
        queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_mensagens" }, () => {
        queryClient.invalidateQueries({ queryKey: ["whatsapp-mensagens"] });
        queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [queryClient]);

  const hojeTexto = new Date().toDateString();

  const contagem = useMemo(() => {
    const base: Record<string, number> = {};
    for (const s of STATUS_CONVERSA) base[s.valor] = 0;
    for (const c of conversas ?? []) {
      // Finalizados contam apenas os do dia atual.
      if (c.status === "finalizado") {
        const referencia = c.data_finalizacao ?? c.created_at;
        if (new Date(referencia).toDateString() !== hojeTexto) continue;
      }
      base[c.status] = (base[c.status] ?? 0) + 1;
    }
    return base;
  }, [conversas, hojeTexto]);


  const naoLidasPorStatus = useMemo(() => {
    const base: Record<string, number> = {};
    for (const s of STATUS_CONVERSA) base[s.valor] = 0;
    for (const c of conversas ?? []) base[c.status] = (base[c.status] ?? 0) + (c.nao_lidas ?? 0);
    return base;
  }, [conversas]);


  const termo = normalizar(busca.trim());

  // Busca também no conteúdo das mensagens (qualquer status), com espera curta.
  useEffect(() => {
    if (termo.length < 3) {
      setIdsBuscaMensagem(null);
      return;
    }
    let ativo = true;
    const espera = setTimeout(async () => {
      const alvo = busca.trim().replace(/[%,()]/g, " ").trim();
      if (!alvo) {
        if (ativo) setIdsBuscaMensagem(null);
        return;
      }
      const { data } = await supabase
        .from("whatsapp_mensagens")
        .select("conversa_id")
        .or(`texto.ilike.%${alvo}%,arquivo_nome.ilike.%${alvo}%,transcricao.ilike.%${alvo}%`)
        .limit(400);
      if (ativo) setIdsBuscaMensagem(new Set((data ?? []).map((r) => r.conversa_id as string)));
    }, 400);
    return () => {
      ativo = false;
      clearTimeout(espera);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo]);

  const hoje = hojeTexto;
  const digitosBusca = termo.replace(/\D/g, "");
  const lista = (conversas ?? []).filter((c) => {
    // Pesquisando: ignora a aba e a data; vale nome, telefone e conteúdo das mensagens.
    if (termo) {
      const nome = normalizar(c.nome_contato ?? "");
      const telefone = (c.telefone ?? "").replace(/\D/g, "");
      // O telefone só entra na comparação quando o termo tem dígitos; caso
      // contrário a busca vazia casaria com todos os contatos.
      const casaTelefone = digitosBusca.length > 0 && telefone.includes(digitosBusca);
      return (
        nome.includes(termo) ||
        casaTelefone ||
        (idsBuscaMensagem?.has(c.id) ?? false)
      );
    }

    if (c.status !== aba) return false;
    // Finalizados mostram só os de hoje, até pedir para ver todos.
    if (aba === "finalizado" && !todasFinalizadas) {
      const referencia = c.data_finalizacao ?? c.created_at;
      if (new Date(referencia).toDateString() !== hoje) return false;
    }
    return true;
  });
  const finalizadosOcultos =
    aba === "finalizado" && !todasFinalizadas && !termo
      ? (conversas ?? []).filter(
          (c) =>
            c.status === "finalizado" &&
            new Date(c.data_finalizacao ?? c.created_at).toDateString() !== hoje,
        ).length
      : 0;
  // Se a conversa aberta mudou de status (saiu da aba atual), fecha automaticamente
  // (na pesquisa, a conversa pode pertencer a outra aba e permanece aberta).
  const abertaBruta = (conversas ?? []).find((c) => c.id === abertaId) ?? null;
  const aberta = abertaBruta && (termo !== "" || abertaBruta.status === aba) ? abertaBruta : null;

  const painelContatos = (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar nome, telefone ou conteúdo da mensagem..."
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {STATUS_CONVERSA.map((s) => {
          const Icone = ICONE_STATUS[s.valor];
          const ativo = aba === s.valor;
          const novas = naoLidasPorStatus[s.valor] ?? 0;
          const rotulo = novas > 0 ? `${s.rotulo} — ${novas} nova(s) mensagem(ns)` : s.rotulo;
          return (
            <button
              key={s.valor}
              type="button"
              title={rotulo}
              aria-label={rotulo}
              onClick={() => setAba(s.valor)}
              className={cn(
                "relative flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs transition-colors",
                ativo
                  ? "border-primary bg-primary text-primary-foreground"
                  : novas > 0
                    ? "border-destructive font-bold text-destructive hover:bg-muted"
                    : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              <Icone className={cn("h-4 w-4", novas > 0 && !ativo && "animate-pulse")} />
              <span className="font-semibold">{contagem[s.valor] ?? 0}</span>
              {novas > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground">
                  {novas}
                </span>
              )}
            </button>
          );
        })}

      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {isLoading && <Skeleton className="h-20 w-full" />}

        {!isLoading && lista.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {termo ? "Nenhuma conversa encontrada." : "Nenhuma conversa nesta aba."}
          </p>
        )}

        {lista.map((c) => {
          const nome = c.nome_contato || formatarTelefone(c.telefone);
          const selecionado = c.id === abertaId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setAbertaId(c.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                selecionado ? "border-primary bg-muted" : "border-transparent hover:bg-muted/60",
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {nome.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={cn("min-w-0 flex-1 truncate text-sm", c.nao_lidas > 0 ? "font-bold" : "font-semibold")}>{nome}</span>
                  {termo !== "" && c.status !== aba && (
                    <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                      {rotuloStatusConversa[c.status] ?? c.status}
                    </Badge>
                  )}
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {dataHoraCurta(c.ultima_mensagem_em ?? c.created_at)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {c.ultima_mensagem ?? "Sem mensagens"}
                  </span>
                  {c.nao_lidas > 0 && <Badge className="shrink-0 px-1.5 py-0 text-[10px]">{c.nao_lidas}</Badge>}
                </span>
              </span>
            </button>
          );
        })}

        {finalizadosOcultos > 0 && (
          <button
            type="button"
            onClick={() => setTodasFinalizadas(true)}
            className="w-full rounded-lg border border-dashed px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
          >
            Mostrar todas ({finalizadosOcultos} de outros dias)
          </button>
        )}
      </div>
    </div>
  );

  // Mobile: lista em tela cheia e conversa substitui a lista.
  if (isMobile) {
    if (aberta) {
      return (
        <Conversa
          conversa={aberta}
          atendente={user?.email ?? "Atendente"}
          atendenteId={user?.id ?? null}
          onVoltar={() => setAbertaId(null)}
          onAbrirConversa={(id, status) => {
            setAbertaId(id);
            setAba(status);
          }}
          mostrarVoltar
        />
      );
    }
    return (
      <>
        <PageHeader titulo="Atendimento WhatsApp" subtitulo="Conversas recebidas pelo WhatsApp da loja" />
        <div className="flex h-[calc(100vh-14rem)] flex-col">{painelContatos}</div>
      </>
    );
  }

  return (
    <>
      <PageHeader titulo="Atendimento WhatsApp" subtitulo="Conversas recebidas pelo WhatsApp da loja" />
      <div
        className="grid h-[calc(100vh-12rem)] gap-0"
        style={{ gridTemplateColumns: `${larguraLista}px 12px 1fr` }}
      >
        <Card className="flex min-h-0 flex-col">
          <CardContent className="flex min-h-0 flex-1 flex-col p-3">{painelContatos}</CardContent>
        </Card>

        <div
          role="separator"
          aria-orientation="vertical"
          title="Arraste para ajustar a largura (duplo clique restaura)"
          onPointerDown={iniciarArraste}
          onDoubleClick={restaurarLargura}
          className="group flex cursor-col-resize items-center justify-center"
        >
          <span className="h-16 w-1 rounded-full bg-border transition-colors group-hover:bg-primary" />
        </div>



        <div className="min-h-0">
          {aberta ? (
            <Conversa
              key={aberta.id}
              conversa={aberta}
              atendente={user?.email ?? "Atendente"}
              atendenteId={user?.id ?? null}
              onVoltar={() => setAbertaId(null)}
              onAbrirConversa={(id, status) => {
                setAbertaId(id);
                setAba(status);
              }}
            />
          ) : (
            <Card className="flex h-full items-center justify-center">
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                <MessageSquare className="h-8 w-8 opacity-50" />
                Selecione uma conversa para começar o atendimento.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Conversa({
  conversa,
  atendente,
  atendenteId,
  onVoltar,
  onAbrirConversa,
  mostrarVoltar = false,
}: {
  conversa: Conversa;
  atendente: string;
  atendenteId: string | null;
  onVoltar: () => void;
  onAbrirConversa?: (id: string, status: StatusConversa) => void;
  mostrarVoltar?: boolean;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [texto, setTexto] = useState("");
  const [selecionando, setSelecionando] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [selecionarAoCarregar, setSelecionarAoCarregar] = useState(false);
  const [finalizarAberto, setFinalizarAberto] = useState(false);
  // Painel de anotações do cliente (direita): preferência fica salva no navegador.
  const [notasAbertas, setNotasAbertas] = useState(() => {
    try {
      return window.localStorage.getItem("whatsapp:notas-abertas") === "1";
    } catch {
      return false;
    }
  });
  const [notaTexto, setNotaTexto] = useState("");
  const fim = useRef<HTMLDivElement | null>(null);
  const ultimaPresenca = useRef(0);
  const enviarTexto = useServerFn(enviarTextoWhatsapp);
  const finalizacao = useServerFn(enviarParaFinalizacao);
  const presenca = useServerFn(enviarDigitandoWhatsapp);

  // Ao trocar de conversa, sai do modo seleção.
  useEffect(() => {
    setSelecionando(false);
    setSelecionados(new Set());
    setSelecionarAoCarregar(false);
  }, [conversa.id]);

  function alternarSelecao(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function baixarSelecionados() {
    const ids = Array.from(selecionados);
    if (ids.length === 0) return;
    for (const [i, id] of ids.entries()) {
      const a = document.createElement("a");
      a.href = urlMidia(id, true);
      a.download = "";
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (i < ids.length - 1) await new Promise((r) => setTimeout(r, 400));
    }
    toast.success(ids.length === 1 ? "1 arquivo baixado." : `${ids.length} arquivos baixados.`);
    setSelecionando(false);
    setSelecionados(new Set());
  }

  /** Retorna os IDs dos arquivos do atendimento mais recente (após o último divisor "ATENDIMENTO N"). Somente arquivos recebidos do cliente. */
  function arquivosDoUltimoAtendimento(msgs: Pick<Mensagem, "id" | "arquivo_url" | "tipo" | "texto" | "direcao">[]) {
    let inicio = 0;
    msgs.forEach((m, i) => {
      if (m.tipo === "sistema" && /^ATENDIMENTO\s+\d+/i.test(m.texto ?? "")) inicio = i + 1;
    });
    return msgs
      .slice(inicio)
      .filter((m) => m.arquivo_url && m.direcao === "entrada")
      .map((m) => m.id);
  }

  /** Abre o atendimento mais recente do cliente e seleciona todos os seus arquivos. */
  async function abrirUltimosArquivos() {
    const { data, error } = await supabase
      .from("whatsapp_conversas")
      .select("id,status,atendimento_numero,created_at")
      .eq("telefone", conversa.telefone)
      .order("atendimento_numero", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }

    const todas = (data ?? []) as unknown as Pick<Conversa, "id" | "status" | "atendimento_numero" | "created_at">[];
    const maisRecente = todas[0];
    if (!maisRecente) {
      toast("Nenhuma conversa encontrada para este número.");
      return;
    }

    const { data: msgs, error: erroMsgs } = await supabase
      .from("whatsapp_mensagens")
      .select("id, arquivo_url, tipo, texto, direcao")
      .eq("conversa_id", maisRecente.id)
      .order("data_hora", { ascending: true });
    if (erroMsgs) {
      toast.error(erroMsgs.message);
      return;
    }

    const arquivos = arquivosDoUltimoAtendimento(
      (msgs ?? []) as Pick<Mensagem, "id" | "arquivo_url" | "tipo" | "texto" | "direcao">[],
    );
    if (arquivos.length === 0) {
      toast("Nenhum arquivo no atendimento mais recente.");
      return;
    }

    setSelecionando(true);
    if (maisRecente.id === conversa.id) {
      setSelecionados(new Set(arquivos));
    } else {
      onAbrirConversa?.(maisRecente.id, maisRecente.status as StatusConversa);
      setSelecionarAoCarregar(true);
    }
  }

  /** Envia os arquivos selecionados para a calculadora, sem baixar nada. */
  function enviarParaCalculadora() {
    const itens = (mensagens ?? [])
      .filter((m) => selecionados.has(m.id) && m.arquivo_url)
      .map((m) => ({ id: m.id, nome: m.arquivo_nome ?? "arquivo" }));
    if (itens.length === 0) return;
    sessionStorage.setItem(
      "calc-arquivos-whatsapp",
      JSON.stringify({ arquivos: itens, nome: conversa.nome_contato ?? "", telefone: conversa.telefone }),
    );
    setSelecionando(false);
    setSelecionados(new Set());
    void navigate({ to: "/" });
  }

  // Avisa o cliente que o atendente está digitando (no máximo 1x a cada 3s).
  function avisarDigitando() {
    const agora = Date.now();
    if (agora - ultimaPresenca.current < 3000) return;
    ultimaPresenca.current = agora;
    void presenca({ data: { telefone: conversa.telefone } }).catch(() => undefined);
  }

  async function enviarFinalizacao(fluxoId?: string) {
    try {
      const r = await finalizacao({ data: { conversaId: conversa.id, atendente: atendente, fluxoId } });
      if (!r.ok) { toast.error(r.erro ?? "Falha ao enviar para finalização."); return; }
      toast.success(r.fluxo ? "Conversa enviada para finalização." : "Conversa movida (nenhum fluxo de finalização configurado).");
      await queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar para finalização.");
    }
  }

  // Fluxos marcados em Configurar Bot para aparecer como opção na finalização.
  const fluxosFinalizacao = useQuery({
    queryKey: ["bot-fluxos-finalizacao"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bot_fluxos")
        .select("id, nome, icone")
        .eq("ativo", true)
        .eq("mostrar_finalizacao", true)
        .order("ordem");
      return data ?? [];
    },
  });

  const { data: mensagens, isLoading } = useQuery({
    queryKey: ["whatsapp-mensagens", conversa.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_mensagens")
        .select("*")
        .eq("conversa_id", conversa.id)
        .order("data_hora", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Mensagem[];
    },
    refetchInterval: 4000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens]);

  // Após abrir o atendimento mais recente, seleciona todos os arquivos das mensagens carregadas.
  useEffect(() => {
    if (!selecionarAoCarregar || isLoading || !mensagens) return;
    const arquivos = arquivosDoUltimoAtendimento(mensagens);
    if (arquivos.length > 0) setSelecionados(new Set(arquivos));
    setSelecionarAoCarregar(false);
  }, [selecionarAoCarregar, isLoading, mensagens]);

  useEffect(() => {
    if (conversa.nao_lidas > 0) {
      void supabase
        .from("whatsapp_conversas")
        .update({ nao_lidas: 0 })
        .eq("id", conversa.id)
        .then(() => queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] }));
    }
  }, [conversa.id, conversa.nao_lidas, queryClient]);

  // Regra do bot para este número (BOT > Números).
  const regraBot = useQuery({
    queryKey: ["bot-numero", conversa.telefone],
    queryFn: async () => {
      const [cfg, regra] = await Promise.all([
        supabase.from("whatsapp_config").select("modo_numeros").limit(1).maybeSingle(),
        supabase
          .from("bot_numeros")
          .select("id, permitido, ativo")
          .eq("telefone", conversa.telefone)
          .maybeSingle(),
      ]);
      return {
        modo: cfg.data?.modo_numeros ?? "todos",
        regra: regra.data?.ativo ? regra.data : null,
      };
    },
  });

  const botLiberado =
    regraBot.data?.modo === "somente_liberados"
      ? Boolean(regraBot.data?.regra?.permitido)
      : regraBot.data?.regra
        ? regraBot.data.regra.permitido
        : true;

  async function alternarBotNumero() {
    const { error } = await supabase.from("bot_numeros").upsert(
      {
        telefone: conversa.telefone,
        nome: conversa.nome_contato ?? null,
        permitido: !botLiberado,
        ativo: true,
      },
      { onConflict: "telefone" },
    );
    if (error) { toast.error(error.message); return; }
    toast.success(!botLiberado ? "Bot ligado para este número." : "Bot desligado para este número.");
    await queryClient.invalidateQueries({ queryKey: ["bot-numero", conversa.telefone] });
  }

  async function alterarStatus(status: StatusConversa, acao: string) {
    const ok = await alterarStatusConversa(conversa.id, status, acao, atendente, atendenteId);
    if (!ok) return;
    await queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
  }

  const envio = useMutation({
    mutationFn: async (mensagem: string) =>
      enviarTexto({ data: { conversaId: conversa.id, telefone: conversa.telefone, mensagem, autor: atendente } }),
    onSuccess: async (r) => {
      if (!r.ok) {
        toast.error(r.erro ?? "Falha ao enviar.");
      } else {
        setTexto("");
        toast.success("Mensagem enviada.");
      }
      await queryClient.invalidateQueries({ queryKey: ["whatsapp-mensagens", conversa.id] });
      await queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Anotação do cliente (por telefone, vale para todos os atendimentos).
  const notaCliente = useQuery({
    queryKey: ["whatsapp-nota", conversa.telefone],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_notas")
        .select("nota")
        .eq("telefone", conversa.telefone)
        .maybeSingle();
      if (error) throw error;
      return data?.nota ?? "";
    },
  });

  // Preenche o campo ao abrir a conversa ou carregar a nota.
  useEffect(() => {
    setNotaTexto(notaCliente.data ?? "");
  }, [conversa.telefone, notaCliente.data]);

  function alternarNotas() {
    setNotasAbertas((aberto) => {
      const novo = !aberto;
      try {
        window.localStorage.setItem("whatsapp:notas-abertas", novo ? "1" : "0");
      } catch {
        /* sem armazenamento */
      }
      return novo;
    });
  }

  const salvarNota = useMutation({
    mutationFn: async (nota: string) => {
      const { error } = await supabase
        .from("whatsapp_notas")
        .upsert({ telefone: conversa.telefone, nota }, { onConflict: "telefone" });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Anotação salva.");
      await queryClient.invalidateQueries({ queryKey: ["whatsapp-nota", conversa.telefone] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className={cn("flex flex-col", mostrarVoltar ? "h-[calc(100vh-8rem)]" : "h-full")}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {mostrarVoltar && (
          <Button variant="ghost" size="sm" onClick={onVoltar}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Button>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">
            {conversa.nome_contato || formatarTelefone(conversa.telefone)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatarTelefone(conversa.telefone)} · {rotuloStatusConversa[conversa.status] ?? conversa.status}
            {conversa.atendente_nome ? ` · ${conversa.atendente_nome}` : ""}
          </p>
        </div>

        <Button size="sm" variant="secondary" title="Assumir" onClick={() => alterarStatus("em_atendimento", "assumiu")}>
          <UserCheck className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" title="Devolver ao bot" onClick={() => alterarStatus("automatico", "devolveu_bot")}>
          <BotIcon className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" title="Pendente" onClick={() => alterarStatus("pendente", "marcou_pendente")}>
          <AlertCircle className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" title="Fila de impressão" onClick={() => alterarStatus("esperando_impressao", "fila_impressao")}>
          <Printer className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" title="Enviar para Aguardando Finalização" onClick={() => void enviarFinalizacao()}>
          <Flag className="h-4 w-4" />
        </Button>
        <Button size="sm" title="Finalizar" onClick={() => setFinalizarAberto(true)}>
          <CheckCircle2 className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={botLiberado ? "outline" : "destructive"}
          onClick={() => void alternarBotNumero()}
          title={botLiberado ? "Bot ligado para este número" : "Bot desligado para este número"}
        >
          {botLiberado ? <Bot className="h-4 w-4" /> : <BotOff className="h-4 w-4" />}
        </Button>
        <Button
          size="sm"
          variant={selecionando ? "secondary" : "outline"}
          title="Selecionar arquivos para baixar"
          onClick={() => {
            if (selecionando) setSelecionados(new Set());
            setSelecionando(!selecionando);
          }}
        >
          <CheckSquare className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={notasAbertas ? "secondary" : "outline"}
          title={notasAbertas ? "Recolher anotações" : "Mostrar anotações do cliente"}
          onClick={alternarNotas}
        >
          <StickyNote className="h-4 w-4" />
        </Button>
      </div>

      {selecionando && (
        <div className="mb-3 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
          <span className="flex-1">
            {selecionados.size === 0
              ? "Toque nos arquivos da conversa para selecionar."
              : `${selecionados.size} arquivo${selecionados.size > 1 ? "s" : ""} selecionado${selecionados.size > 1 ? "s" : ""}`}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void abrirUltimosArquivos()}
            title="Abrir o atendimento mais recente e selecionar seus arquivos"
          >
            {(mensagens ?? []).filter((m) => m.arquivo_url).length > 0 &&
            (mensagens ?? []).filter((m) => m.arquivo_url).every((m) => selecionados.has(m.id)) ? (
              <CheckSquare className="mr-1 h-4 w-4" />
            ) : (
              <Square className="mr-1 h-4 w-4" />
            )}
            Últimos Arquivos
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={selecionados.size === 0}
            onClick={enviarParaCalculadora}
            title="Abrir a calculadora com os arquivos selecionados"
          >
            <Calculator className="mr-1 h-4 w-4" /> Calculadora
          </Button>
          <Button size="sm" disabled={selecionados.size === 0} onClick={() => void baixarSelecionados()}>
            <Download className="mr-1 h-4 w-4" /> Baixar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelecionando(false);
              setSelecionados(new Set());
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-3">
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {isLoading && <Skeleton className="h-20 w-full" />}
            {!isLoading && (mensagens ?? []).length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma mensagem nesta conversa.</p>
            )}

            {(mensagens ?? []).map((m) =>
              m.tipo === "sistema" ? (
                <div key={m.id} className="flex items-center gap-2 py-2">
                  <span className="h-px flex-1 bg-border" />
                  <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {m.texto ?? "Novo atendimento"}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              ) : (
              <div key={m.id} className={cn("flex", m.direcao === "saida" ? "justify-end" : "justify-start")}>
                <div
                  onClick={selecionando && m.arquivo_url ? () => alternarSelecao(m.id) : undefined}
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                    m.direcao === "saida" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                    selecionando && m.arquivo_url && "cursor-pointer",
                    selecionando && selecionados.has(m.id) && "ring-2 ring-offset-1 ring-primary",
                  )}
                >
                  {selecionando && m.arquivo_url && (
                    <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold opacity-90">
                      {selecionados.has(m.id) ? "☑" : "☐"} {selecionados.has(m.id) ? "Selecionado" : "Selecionar"}
                    </span>
                  )}
                  <MidiaMensagem mensagem={m} selecionando={selecionando} />
                  {m.texto && <p className="whitespace-pre-wrap break-words">{m.texto}</p>}

                  <p className="mt-1 text-[10px] opacity-70">
                    {dataHoraCurta(m.data_hora)}
                    {m.status === "erro" ? ` · erro: ${m.erro ?? ""}` : ""}
                  </p>
                </div>
              </div>
              ),
            )}
            <div ref={fim} />
          </div>

          <div className="flex items-end gap-2 border-t pt-3">
            <Textarea
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                if (e.target.value.trim()) avisarDigitando();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const msg = texto.trim();
                  if (msg && !envio.isPending) envio.mutate(msg);
                }
              }}
              placeholder="Escreva a mensagem..."
              rows={2}
              className="min-h-0 flex-1 resize-none"
            />
            <Button
              onClick={() => texto.trim() && envio.mutate(texto.trim())}
              disabled={!texto.trim() || envio.isPending}
            >
              <Send className="mr-1 h-4 w-4" /> Enviar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Escolha da finalização: imediata ou por fluxo configurado em Configurar Bot. */}
      <Dialog open={finalizarAberto} onOpenChange={setFinalizarAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar atendimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              className="w-full justify-start"
              onClick={() => {
                setFinalizarAberto(false);
                void alterarStatus("finalizado", "finalizou");
              }}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" /> Finalizar agora
            </Button>
            {(fluxosFinalizacao.data ?? []).map((f) => (
              <Button
                key={f.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setFinalizarAberto(false);
                  void enviarFinalizacao(f.id);
                }}
                title="Aguardando Finalização, iniciando este fluxo imediatamente"
              >
                <Flag className="mr-2 h-4 w-4" /> {f.nome}
              </Button>
            ))}
            {(fluxosFinalizacao.data ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">
                Para oferecer outros fluxos aqui, ative "Mostrar na finalização" no fluxo em Configurar Bot.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** URL do proxy de mídia da mensagem. */
function urlMidia(id: string, baixar = false) {
  return `/api/public/whatsapp/midia?id=${encodeURIComponent(id)}${baixar ? "&download=1" : ""}`;
}

/** Renderiza imagem, documento ou áudio anexado a uma mensagem. */
function MidiaMensagem({ mensagem, selecionando = false }: { mensagem: Mensagem; selecionando?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [transcricao, setTranscricao] = useState<string | null>(mensagem.transcricao);
  const [transcricaoAberta, setTranscricaoAberta] = useState(false);
  const [carregandoTranscricao, setCarregandoTranscricao] = useState(false);
  const transcrever = useServerFn(transcreverAudioWhatsapp);

  async function transcreverAudio() {
    if (carregandoTranscricao) return;
    setCarregandoTranscricao(true);
    try {
      const r = await transcrever({ data: { mensagemId: mensagem.id } });
      if (r.ok && r.texto) {
        setTranscricao(r.texto);
        setTranscricaoAberta(true);
      } else {
        toast.error(r.erro ?? "Não foi possível transcrever o áudio.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao transcrever.");
    } finally {
      setCarregandoTranscricao(false);
    }
  }

  if (!mensagem.arquivo_url && !mensagem.arquivo_nome) return null;

  const nome = mensagem.arquivo_nome ?? "arquivo";
  const ehImagem = mensagem.tipo === "imagem" || (mensagem.mime_type ?? "").startsWith("image/");
  const ehAudio = mensagem.tipo === "audio" || (mensagem.mime_type ?? "").startsWith("audio/");

  if (!mensagem.arquivo_url) {
    return <p className="mb-1 text-xs opacity-80">📎 {nome}</p>;
  }

  if (ehImagem) {
    return (
      <>
        {selecionando ? (
          <img
            src={urlMidia(mensagem.id)}
            alt={nome}
            loading="lazy"
            className="mb-1 max-h-64 w-full max-w-xs rounded-lg object-cover"
          />
        ) : (
          <>
            <button type="button" onClick={() => setAberto(true)} className="mb-1 block">
              <img
                src={urlMidia(mensagem.id)}
                alt={nome}
                loading="lazy"
                className="max-h-64 w-full max-w-xs rounded-lg object-cover"
              />
            </button>
            <a
              href={urlMidia(mensagem.id, true)}
              className="mb-1 inline-flex items-center gap-1 text-xs underline opacity-90"
              download={nome}
            >
              <Download className="h-3 w-3" /> Baixar imagem
            </a>
          </>
        )}
        <Dialog open={aberto && !selecionando} onOpenChange={setAberto}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="truncate text-sm">{nome}</DialogTitle>
            </DialogHeader>
            <img src={urlMidia(mensagem.id)} alt={nome} className="max-h-[70vh] w-full object-contain" />
            <a
              href={urlMidia(mensagem.id, true)}
              className="inline-flex items-center gap-1 text-sm underline"
              download={nome}
            >
              <Download className="h-4 w-4" /> Baixar imagem
            </a>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (ehAudio) {
    return (
      <div className="mb-1 space-y-1">
        <audio controls={!selecionando} src={urlMidia(mensagem.id)} className="w-56 max-w-full" />
        {!selecionando && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <a
              href={urlMidia(mensagem.id, true)}
              className="inline-flex items-center gap-1 underline opacity-90"
              download={nome}
            >
              <Download className="h-3 w-3" /> Baixar áudio
            </a>
            {transcricao ? (
              <button
                type="button"
                onClick={() => setTranscricaoAberta(true)}
                className="inline-flex items-center gap-1 underline opacity-90"
              >
                <Mic className="h-3 w-3" /> Ver transcrição
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void transcreverAudio()}
                disabled={carregandoTranscricao}
                className="inline-flex items-center gap-1 underline opacity-90 disabled:opacity-50"
              >
                <Mic className="h-3 w-3" /> {carregandoTranscricao ? "Transcrevendo..." : "Transcrever"}
              </button>
            )}
          </div>
        )}
        <Dialog open={transcricaoAberta} onOpenChange={setTranscricaoAberta}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">Transcrição do áudio</DialogTitle>
            </DialogHeader>
            <p className="whitespace-pre-wrap break-words text-sm">{transcricao ?? ""}</p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                if (!transcricao) return;
                void navigator.clipboard.writeText(transcricao).then(() => toast.success("Transcrição copiada."));
              }}
            >
              <Copy className="mr-2 h-4 w-4" /> Copiar transcrição
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (selecionando) {
    return (
      <div className="mb-1 flex items-center gap-2 rounded-lg border border-current/20 bg-background/20 px-2 py-2">
        <FileText className="h-5 w-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-xs">{nome}</span>
      </div>
    );
  }

  return (
    <a
      href={urlMidia(mensagem.id, true)}
      download={nome}
      className="mb-1 flex items-center gap-2 rounded-lg border border-current/20 bg-background/20 px-2 py-2"
    >
      <FileText className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-xs">{nome}</span>
      <Download className="h-4 w-4 shrink-0" />
    </a>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Bot as BotIcon,
  BotOff,
  CheckCircle2,
  Clock,
  Flag,
  Headset,
  MessageSquare,
  Search,
  Send,
  UserCheck,
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
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { enviarDigitandoWhatsapp, enviarParaFinalizacao, enviarTextoWhatsapp } from "@/lib/whatsapp.functions";
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
  status: string;
  erro: string | null;
  data_hora: string;
}

/** Ícone de cada aba de status. */
const ICONE_STATUS: Record<StatusConversa, LucideIcon> = {
  automatico: Bot,
  aguardando: Clock,
  em_atendimento: Headset,
  pendente: AlertCircle,
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

  const contagem = useMemo(() => {
    const base: Record<string, number> = {};
    for (const s of STATUS_CONVERSA) base[s.valor] = 0;
    for (const c of conversas ?? []) base[c.status] = (base[c.status] ?? 0) + 1;
    return base;
  }, [conversas]);

  const naoLidasPorStatus = useMemo(() => {
    const base: Record<string, number> = {};
    for (const s of STATUS_CONVERSA) base[s.valor] = 0;
    for (const c of conversas ?? []) base[c.status] = (base[c.status] ?? 0) + (c.nao_lidas ?? 0);
    return base;
  }, [conversas]);


  const termo = normalizar(busca.trim());
  const lista = (conversas ?? []).filter((c) => {
    if (c.status !== aba) return false;
    if (!termo) return true;
    const nome = normalizar(c.nome_contato ?? "");
    const telefone = (c.telefone ?? "").replace(/\D/g, "");
    return (
      nome.includes(termo) ||
      telefone.includes(termo.replace(/\D/g, "")) ||
      formatarTelefone(c.telefone).includes(busca.trim())
    );
  });
  // Se a conversa aberta mudou de status (saiu da aba atual), fecha automaticamente.
  const abertaBruta = (conversas ?? []).find((c) => c.id === abertaId) ?? null;
  const aberta = abertaBruta && abertaBruta.status === aba ? abertaBruta : null;

  const painelContatos = (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar por nome ou telefone..."
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
      <div className="grid h-[calc(100vh-12rem)] grid-cols-[340px_1fr] gap-4">
        <Card className="flex min-h-0 flex-col">
          <CardContent className="flex min-h-0 flex-1 flex-col p-3">{painelContatos}</CardContent>
        </Card>

        <div className="min-h-0">
          {aberta ? (
            <Conversa
              key={aberta.id}
              conversa={aberta}
              atendente={user?.email ?? "Atendente"}
              atendenteId={user?.id ?? null}
              onVoltar={() => setAbertaId(null)}
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
  mostrarVoltar = false,
}: {
  conversa: Conversa;
  atendente: string;
  atendenteId: string | null;
  onVoltar: () => void;
  mostrarVoltar?: boolean;
}) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState("");
  const fim = useRef<HTMLDivElement | null>(null);
  const ultimaPresenca = useRef(0);
  const enviarTexto = useServerFn(enviarTextoWhatsapp);
  const finalizacao = useServerFn(enviarParaFinalizacao);
  const presenca = useServerFn(enviarDigitandoWhatsapp);

  // Avisa o cliente que o atendente está digitando (no máximo 1x a cada 3s).
  function avisarDigitando() {
    const agora = Date.now();
    if (agora - ultimaPresenca.current < 3000) return;
    ultimaPresenca.current = agora;
    void presenca({ data: { telefone: conversa.telefone } }).catch(() => undefined);
  }

  async function enviarFinalizacao() {
    try {
      const r = await finalizacao({ data: { conversaId: conversa.id, atendente: atendente } });
      if (!r.ok) { toast.error(r.erro ?? "Falha ao enviar para finalização."); return; }
      toast.success(r.fluxo ? "Conversa enviada para finalização." : "Conversa movida (nenhum fluxo de finalização configurado).");
      await queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar para finalização.");
    }
  }

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
        <Button size="sm" variant="outline" title="Enviar para Aguardando Finalização" onClick={() => void enviarFinalizacao()}>
          <Flag className="h-4 w-4" />
        </Button>
        <Button size="sm" title="Finalizar" onClick={() => alterarStatus("finalizado", "finalizou")}>
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
      </div>

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
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                    m.direcao === "saida" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  )}
                >
                  {m.texto && <p className="whitespace-pre-wrap break-words">{m.texto}</p>}
                  {m.arquivo_nome && <p className="mt-1 text-xs opacity-80">📎 {m.arquivo_nome}</p>}
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
    </div>
  );
}

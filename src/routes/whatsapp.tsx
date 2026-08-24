import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Bot, CheckCircle2, Send, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { enviarTextoWhatsapp } from "@/lib/whatsapp.functions";
import { cn } from "@/lib/utils";
import {
  STATUS_CONVERSA,
  dataHoraCurta,
  formatarTelefone,
  rotuloEtapa,
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

const ACOES_STATUS: { status: StatusConversa; acao: string; rotulo: string }[] = [
  { status: "em_atendimento", acao: "assumiu", rotulo: "Assumir" },
  { status: "automatico", acao: "devolveu_bot", rotulo: "Devolver ao bot" },
  { status: "pendente", acao: "marcou_pendente", rotulo: "Pendente" },
  { status: "finalizado", acao: "finalizou", rotulo: "Finalizar" },
];


function Atendimento() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: conversas, isLoading } = useConversas();
  const [aba, setAba] = useState<StatusConversa>("automatico");
  const [abertaId, setAbertaId] = useState<string | null>(null);

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

  const termo = normalizar(busca.trim());
  const lista = (conversas ?? []).filter((c) => {
    if (c.status !== aba) return false;
    if (!termo) return true;
    const nome = normalizar(c.nome_contato ?? "");
    const telefone = (c.telefone ?? "").replace(/\D/g, "");
    return nome.includes(termo) || telefone.includes(termo.replace(/\D/g, "")) || formatarTelefone(c.telefone).includes(busca.trim());
  });
  const aberta = (conversas ?? []).find((c) => c.id === abertaId) ?? null;

  async function mudarStatus(conversaId: string, status: StatusConversa, acao: string) {
    const ok = await alterarStatusConversa(conversaId, status, acao, user?.email ?? "Atendente", user?.id ?? null);
    if (ok) await queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
  }

  if (aberta) {
    return (
      <Conversa
        conversa={aberta}
        atendente={user?.email ?? "Atendente"}
        atendenteId={user?.id ?? null}
        onVoltar={() => setAbertaId(null)}
      />
    );
  }

  return (
    <>
      <PageHeader titulo="Atendimento WhatsApp" subtitulo="Conversas recebidas pelo WhatsApp da loja" />

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar por nome ou telefone..."
          className="pl-9"
        />
      </div>

      <Tabs value={aba} onValueChange={(v) => setAba(v as StatusConversa)}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          {STATUS_CONVERSA.map((s) => (
            <TabsTrigger key={s.valor} value={s.valor} className="gap-2">
              {s.rotulo}
              <Badge variant="secondary">{contagem[s.valor] ?? 0}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-4 space-y-2">
        {isLoading && <Skeleton className="h-24 w-full" />}

        {!isLoading && lista.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {termo ? "Nenhuma conversa encontrada." : "Nenhuma conversa nesta aba."}
            </CardContent>
          </Card>
        )}

        {lista.map((c) => (
          <Card key={c.id} className="transition-colors hover:border-primary">
            <CardContent className="flex flex-wrap items-center gap-3 py-3">
              <button onClick={() => setAbertaId(c.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold">
                  {c.nome_contato || formatarTelefone(c.telefone)}
                  <span className="ml-2 font-normal text-muted-foreground">{formatarTelefone(c.telefone)}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">{c.ultima_mensagem ?? "Sem mensagens"}</p>
              </button>

              <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">{rotuloEtapa[c.etapa] ?? c.etapa}</Badge>
                <Badge variant="secondary">{c.total_mensagens} msg</Badge>
                {c.nao_lidas > 0 && <Badge>{c.nao_lidas} nova(s)</Badge>}
                {c.pedido_id && <Badge variant="outline">Pedido vinculado</Badge>}
                <span className="text-muted-foreground">{dataHoraCurta(c.ultima_mensagem_em ?? c.created_at)}</span>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1">
                      Status <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {ACOES_STATUS.map((a) => (
                      <DropdownMenuItem
                        key={a.status}
                        disabled={c.status === a.status}
                        onSelect={() => void mudarStatus(c.id, a.status, a.acao)}
                      >
                        {a.rotulo}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>

  );
}

function Conversa({
  conversa,
  atendente,
  atendenteId,
  onVoltar,
}: {
  conversa: Conversa;
  atendente: string;
  atendenteId: string | null;
  onVoltar: () => void;
}) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState("");
  const fim = useRef<HTMLDivElement | null>(null);
  const enviarTexto = useServerFn(enviarTextoWhatsapp);

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

  async function auditar(acao: string, detalhe?: string) {
    await supabase.from("whatsapp_auditoria").insert({
      conversa_id: conversa.id,
      usuario_id: atendenteId,
      usuario_nome: atendente,
      acao,
      detalhe: detalhe ?? null,
    });
  }

  async function alterarStatus(status: StatusConversa, acao: string) {
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

    const { error } = await supabase.from("whatsapp_conversas").update(extra).eq("id", conversa.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await auditar(acao);
    await queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    toast.success("Conversa atualizada.");
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
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onVoltar}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">
            {conversa.nome_contato || formatarTelefone(conversa.telefone)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatarTelefone(conversa.telefone)} · {rotuloStatusConversa[conversa.status] ?? conversa.status}
            {conversa.atendente_nome ? ` · ${conversa.atendente_nome}` : ""}
          </p>
        </div>

        <Button size="sm" variant="secondary" onClick={() => alterarStatus("em_atendimento", "assumiu")}>
          <UserCheck className="mr-1 h-4 w-4" /> Assumir
        </Button>
        <Button size="sm" variant="outline" onClick={() => alterarStatus("automatico", "devolveu_bot")}>
          <Bot className="mr-1 h-4 w-4" /> Devolver ao bot
        </Button>
        <Button size="sm" variant="outline" onClick={() => alterarStatus("pendente", "marcou_pendente")}>
          Pendente
        </Button>
        <Button size="sm" onClick={() => alterarStatus("finalizado", "finalizou")}>
          <CheckCircle2 className="mr-1 h-4 w-4" /> Finalizar
        </Button>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-3">
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {isLoading && <Skeleton className="h-20 w-full" />}
            {!isLoading && (mensagens ?? []).length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma mensagem nesta conversa.</p>
            )}

            {(mensagens ?? []).map((m) => (
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
            ))}
            <div ref={fim} />
          </div>

          <div className="flex items-end gap-2 border-t pt-3">
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
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

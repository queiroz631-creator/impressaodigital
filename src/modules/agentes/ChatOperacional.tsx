import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Loader2, Send, AlertCircle, CheckCircle, XCircle, ClipboardList, MessageSquare, ChevronDown, ChevronUp, X, Wrench, Zap, ShieldAlert, ScrollText, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PageHeader } from "@/components/AppLayout";
import {
  iniciarChatOperacional,
  continuarChatOperacional,
  listarMensagensChat,
  obterFerramentasAgente,
  type ChatMensagem,
  type IniciarChatResultado,
} from "@/lib/agentes/agentes-operacional.functions";
import { minhasPermissoesAgentes, listarAgentes } from "@/lib/agentes/agentes.functions";

const ATALHOS = [
  { rota: "/agentes/chat", nome: "Chat Operacional", icone: MessageSquare },
  { rota: "/agentes/ferramentas", nome: "Ferramentas", icone: Wrench },
  { rota: "/agentes/execucoes", nome: "Execuções", icone: Zap },
  { rota: "/agentes/aprovacoes", nome: "Aprovações", icone: ShieldAlert },
  { rota: "/agentes/auditoria", nome: "Auditoria", icone: ScrollText },
  { rota: "/agentes/configuracoes", nome: "Configurações", icone: Settings },
] as const;

interface Props {
  agenteId?: string;
  execucaoId?: string;
}

export default function ChatOperacional({ agenteId: agenteIdProp, execucaoId }: Props) {
  const qc = useQueryClient();
  const fnIniciar = useServerFn(iniciarChatOperacional);
  const fnContinuar = useServerFn(continuarChatOperacional);
  const fnMensagens = useServerFn(listarMensagensChat);
  const fnFerramentas = useServerFn(obterFerramentasAgente);
  const fnPermissoes = useServerFn(minhasPermissoesAgentes);
  const fnAgentes = useServerFn(listarAgentes);

  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [historicoCarregado, setHistoricoCarregado] = useState(false);
  const [mostrarFerramentas, setMostrarFerramentas] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const execucaoIdRef = useRef<string | null>(execucaoId ?? null);
  const idempotencyKeyRef = useRef<string>(`chat_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  const permissoes = useQuery({ queryKey: ["agentes-permissoes"], queryFn: () => fnPermissoes() });
  const ferramentas = useQuery({ queryKey: ["agente-ferramentas-sistema"], queryFn: () => fnFerramentas() });
  const agentes = useQuery({ queryKey: ["agentes-lista"], queryFn: () => fnAgentes() });

  // Resolver agenteId: se prop é UUID válido, usar; senão buscar por chave "operacional"
  const agenteIdResolvido = agenteIdProp?.match(/^[0-9a-f-]{36}$/i)
    ? agenteIdProp
    : (agentes.data?.find((a) => a.chave === (agenteIdProp ?? "operacional"))?.id ?? "operacional");

  const agenteEncontrado = agentes.data?.find((a) => a.id === agenteIdResolvido);
  const agenteValido = agenteEncontrado?.ativo === true;

  // Carregar mensagens se há execucaoId
  const mensagensQuery = useQuery({
    queryKey: ["agente-chat-mensagens", execucaoIdRef.current],
    queryFn: () => fnMensagens({ data: { execucaoId: execucaoIdRef.current!, limite: 100 } }),
    enabled: !!execucaoIdRef.current && !historicoCarregado,
  });

  useEffect(() => {
    if (mensagensQuery.data && !historicoCarregado) {
      setHistoricoCarregado(true);
    }
  }, [mensagensQuery.data, historicoCarregado]);

  useEffect(() => {
    scrollToBottom();
  }, [mensagensQuery.data, enviando]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const podeExecutar = permissoes.data?.executar ?? false;

  async function handleEnviar() {
    if (!mensagem.trim() || enviando) return;
    if (!podeExecutar) {
      toast.error("Você não tem permissão para executar agentes.");
      return;
    }
    if (!agenteValido) {
      toast.error(agenteEncontrado ? "Agente operacional está inativo." : "Agente operacional não encontrado.");
      return;
    }

    const msg = mensagem.trim();
    setMensagem("");
    setEnviando(true);

    try {
      let resultado: IniciarChatResultado;

      if (execucaoIdRef.current) {
        // Continuar conversa existente
        resultado = await fnContinuar({
          data: { execucaoId: execucaoIdRef.current, mensagem: msg },
        });
      } else {
        // Nova conversa - usar o UUID resolvido
        resultado = await fnIniciar({
          data: { agenteId: agenteIdResolvido, mensagem: msg, idempotencyKey: idempotencyKeyRef.current },
        });
        execucaoIdRef.current = resultado.execucaoId;
      }

      // Atualizar cache de mensagens
      await qc.invalidateQueries({ queryKey: ["agente-chat-mensagens", resultado.execucaoId] });
      await qc.invalidateQueries({ queryKey: ["agentes-metricas"] });
      await qc.invalidateQueries({ queryKey: ["agentes-aprovacoes"] });

      if (resultado.precisaAprovacao) {
        toast.info("Aguardando aprovação para operações sensíveis.", { duration: 5000 });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar mensagem.");
    } finally {
      setEnviando(false);
    }
  }

  async function handleAprovar(aprovacaoId: string, decisao: "aprovada" | "recusada") {
    if (!podeExecutar) {
      toast.error("Sem permissão para decidir aprovações.");
      return;
    }
    const motivo = decisao === "recusada" ? prompt("Motivo da recusa (opcional):") ?? "" : "";
    try {
      const resultado = await fnContinuar({
        data: { execucaoId: execucaoIdRef.current!, aprovacaoId, decisao, motivo },
      });
      await qc.invalidateQueries({ queryKey: ["agente-chat-mensagens", resultado.execucaoId] });
      await qc.invalidateQueries({ queryKey: ["agentes-aprovacoes"] });
      toast.success(decisao === "aprovada" ? "Aprovação concedida." : "Recusa registrada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao processar aprovação.");
    }
  }

  function formatToolResult(resultado: any): string {
    if (!resultado.ok) return `Erro: ${resultado.erro}`;
    if (resultado.data?.aguardando_aprovacao) return "Aguardando aprovação...";
    if (Array.isArray(resultado.data)) {
      return `${resultado.data.length} resultado(s)`;
    }
    return JSON.stringify(resultado.data, null, 2);
  }

  const mensagens = mensagensQuery.data ?? [];

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        titulo="Agente Operacional"
        subtitulo="Converse com o agente, consulte dados do sistema e execute operações autorizadas."
        semPaddingHorizontal
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {ATALHOS.map((atalho) => (
          <Button key={atalho.rota} variant="outline" size="sm" asChild>
            <Link to={atalho.rota}>
              <atalho.icone className="mr-2 h-4 w-4" />
              {atalho.nome}
            </Link>
          </Button>
        ))}
      </div>

      {/* Status do agente */}
      <div className="mb-4 flex items-center gap-3 text-sm">
        <span className="font-medium">Agente:</span>
        {agentes.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : agenteEncontrado ? (
          <>
            <Badge variant={agenteEncontrado.ativo ? "default" : "secondary"}>
              {agenteEncontrado.nome}
            </Badge>
            <Badge variant={agenteEncontrado.ativo ? "default" : "secondary"}>
              {agenteEncontrado.ativo ? "Ativo" : "Inativo"}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">{agenteEncontrado.id}</span>
          </>
        ) : (
          <Badge variant="destructive">Agente "operacional" não encontrado</Badge>
        )}
        {podeExecutar ? null : (
          <Badge variant="secondary" className="ml-auto">Sem permissão para executar</Badge>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Área de chat */}
        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 p-4 space-y-4">
            {mensagens.length === 0 && !enviando && !execucaoIdRef.current && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                <h3 className="text-lg font-medium">Nenhuma conversa iniciada</h3>
                <p className="text-sm mt-1">Digite uma mensagem abaixo para começar.</p>
              </div>
            )}

            {mensagens.map((msg, idx) => (
              <ChatMessage key={`${msg.id}-${idx}`} mensagem={msg} />
            ))}

            {enviando && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processando...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </ScrollArea>

          {/* Aprovações pendentes */}
          {mensagensQuery.data?.some((m) => m.role === "tool" && (m.content as any)?.data?.aguardando_aprovacao) && (
            <AprovacoesPendentesBar
              mensagens={mensagens}
              onAprovar={handleAprovar}
              podeAprovar={permissoes.data?.aprovar ?? false}
            />
          )}

          {/* Input de mensagem */}
          <div className="border-t p-4 bg-background">
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <Textarea
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleEnviar();
                    }
                  }}
                  placeholder={
                    !podeExecutar
                      ? "Sem permissão para executar agentes"
                      : !agenteValido
                      ? agenteEncontrado
                        ? "Agente operacional está inativo"
                        : "Agente operacional não encontrado"
                      : "Digite sua mensagem..."
                  }
                  disabled={!podeExecutar || !agenteValido || enviando}
                  rows={1}
                  className="min-h-[44px] max-h-[120px] resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter para enviar · Shift+Enter para nova linha
                </p>
              </div>
              <Button
                onClick={handleEnviar}
                disabled={!mensagem.trim() || enviando || !podeExecutar || !agenteValido}
                size="lg"
              >
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Painel lateral de ferramentas */}
        <Collapsible open={mostrarFerramentas} onOpenChange={setMostrarFerramentas}>
          <CollapsibleTrigger className="fixed bottom-20 right-4 z-20" asChild>
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-full shadow-lg">
              {mostrarFerramentas ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="fixed bottom-20 right-4 z-20 w-80 max-h-[500px] shadow-lg">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  Ferramentas Disponíveis
                  <Button variant="ghost" size="icon" onClick={() => setMostrarFerramentas(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {ferramentas.isLoading ? (
                  <div className="p-4 flex justify-center">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto p-2 space-y-1">
                    {(ferramentas.data ?? []).map((f) => (
                      <ToolBadge key={f.chave} ferramenta={f} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

function ChatMessage({ mensagem }: { mensagem: ChatMensagem }) {
  const isUser = mensagem.role === "user";
  const isTool = mensagem.role === "tool";

  if (isTool) {
    const content = mensagem.content as any;
    return (
      <div className="flex gap-3 w-full max-w-5xl">
        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
          <ClipboardList className="h-4 w-4 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground mb-1">{content.name ?? "Ferramenta"}</div>
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-auto p-0 text-left">
                <pre className="text-xs bg-muted p-2 rounded max-h-32 overflow-auto font-mono">
                  {formatToolResult(content)}
                </pre>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="text-xs bg-muted p-2 rounded max-h-96 overflow-auto font-mono">
                {formatToolResult(content)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 w-full max-w-5xl ${isUser ? "flex-row-reverse justify-end" : "justify-start"}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {isUser ? (
          <MessageSquare className="h-4 w-4" />
        ) : (
          <span className="text-xs font-medium">OP</span>
        )}
      </div>
      <div
        className={`flex-1 min-w-0 ${isUser ? "text-right" : ""}`}
      >
        <div
          className={`inline-block max-w-[85%] p-3 rounded-2xl ${
            isUser
              ? "bg-primary text-primary-foreground rounded-br-none"
              : "bg-muted rounded-bl-none"
          }`}
        >
          <p className="whitespace-pre-wrap">{mensagem.content}</p>
        </div>
        <div className="text-xs text-muted-foreground mt-1 px-1">
          {new Date(mensagem.criado_em).toLocaleTimeString("pt-BR")}
        </div>
      </div>
    </div>
  );
}

function AprovacoesPendentesBar({
  mensagens,
  onAprovar,
  podeAprovar,
}: {
  mensagens: ChatMensagem[];
  onAprovar: (id: string, decisao: "aprovada" | "recusada") => void;
  podeAprovar: boolean;
}) {
  const toolMessages = mensagens.filter((m) => m.role === "tool" && (m.content as any)?.data?.aguardando_aprovacao);

  if (toolMessages.length === 0) return null;

  return (
    <div className="border-t bg-amber-50 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-800 mb-2">
        <AlertCircle className="h-4 w-4" />
        Operações aguardando aprovação
      </div>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {toolMessages.map((msg) => {
          const content = msg.content as any;
          const aprovacaoId = content.data?.aprovacao_id;
          const ferramenta = content.name;
          const parametros = content.data?.parametros ?? content.arguments;

          return (
            <div key={msg.id} className="flex flex-wrap items-center gap-2 bg-white rounded border p-2">
              <Badge variant="outline">{ferramenta}</Badge>
              <pre className="text-xs text-muted-foreground flex-1 min-w-[200px] max-h-16 overflow-auto">
                {JSON.stringify(parametros, null, 2)}
              </pre>
              {podeAprovar && aprovacaoId && (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => onAprovar(aprovacaoId, "aprovada")}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onAprovar(aprovacaoId, "recusada")}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Recusar
                  </Button>
                </div>
              )}
              {!podeAprovar && (
                <Badge variant="secondary" className="text-xs">
                  Sem permissão para aprovar
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ToolBadge({ ferramenta }: { ferramenta: any }) {
  const riskColors: Record<string, string> = {
    baixo: "bg-emerald-100 text-emerald-800",
    medio: "bg-amber-100 text-amber-800",
    alto: "bg-red-100 text-red-800",
  };

  return (
    <div className="px-3 py-2 hover:bg-muted/50 border-b last:border-0">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{ferramenta.nome}</span>
        <Badge variant="secondary" className="text-xs">{ferramenta.categoria}</Badge>
        <Badge variant="outline" className={riskColors[ferramenta.risco]}>{ferramenta.risco}</Badge>
        {ferramenta.sensivel && (
          <Badge variant="destructive" className="text-xs gap-1">
            <AlertCircle className="h-3 w-3" /> Sensível
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-1 ml-6">{ferramenta.descricao}</p>
    </div>
  );
}
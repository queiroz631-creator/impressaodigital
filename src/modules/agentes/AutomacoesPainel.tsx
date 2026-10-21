import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Activity, History, Loader2, Pencil, Play, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/AppLayout";
import { listarAgentes, minhasPermissoesAgentes } from "@/lib/agentes/agentes.functions";
import {
  alterarEstadoAutomacao,
  executarAutomacaoManual,
  historicoAutomacao,
  listarAutomacoes,
  type AutomacaoItem,
  type ResultadoOperacao,
} from "@/lib/agentes/automacoes.functions";
import {
  ROTULOS_STATUS_AUTOMACAO,
  ROTULOS_TIPO_AUTOMACAO,
  TIPOS_AUTOMACAO,
  descreverAgendamento,
} from "@/lib/agentes/utils/automacoes";
import { ROTULOS_STATUS_TAREFA, rotulo } from "@/lib/agentes/utils/rotulos";
import DialogAutomacao from "./DialogAutomacao";

function formatar(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}

function corStatus(status: string | null): string {
  switch (status) {
    case "concluida":
      return "bg-emerald-600 hover:bg-emerald-600 text-white";
    case "falha":
    case "desativada_por_erro":
      return "bg-destructive text-destructive-foreground";
    case "enfileirada":
      return "bg-sky-600 hover:bg-sky-600 text-white";
    case "perdida":
    case "ignorada":
    case "cancelada":
      return "bg-amber-500 hover:bg-amber-500 text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default function AutomacoesPainel() {
  const qc = useQueryClient();
  const fnListar = useServerFn(listarAutomacoes);
  const fnAgentes = useServerFn(listarAgentes);
  const fnPermissoes = useServerFn(minhasPermissoesAgentes);
  const fnEstado = useServerFn(alterarEstadoAutomacao);
  const fnExecutar = useServerFn(executarAutomacaoManual);

  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [situacao, setSituacao] = useState("todas");
  const [agenteId, setAgenteId] = useState("todos");
  const [edicao, setEdicao] = useState<{ aberto: boolean; automacao: AutomacaoItem | null }>({
    aberto: false,
    automacao: null,
  });
  const [historicoId, setHistoricoId] = useState<string | null>(null);

  const permissoes = useQuery({ queryKey: ["agentes-permissoes"], queryFn: () => fnPermissoes() });
  const agentes = useQuery({ queryKey: ["agentes-lista"], queryFn: () => fnAgentes() });
  const automacoes = useQuery({
    queryKey: ["agentes-automacoes"],
    queryFn: () => fnListar(),
    refetchInterval: 30_000,
  });

  const nomeAgente = useMemo(
    () => new Map<string, string>((agentes.data ?? []).map((a): [string, string] => [a.id, a.nome])),
    [agentes.data],
  );
  const podeGerenciar = permissoes.data?.gerenciar ?? false;
  const podeExecutar = permissoes.data?.executar ?? false;

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (automacoes.data ?? []).filter((a) => {
      if (tipo !== "todos" && a.tipo_gatilho !== tipo) return false;
      if (situacao === "ativas" && !a.ativo) return false;
      if (situacao === "pausadas" && a.ativo) return false;
      if (situacao === "com_erro" && !(a.ultimo_status === "falha" || a.ultimo_status === "desativada_por_erro")) return false;
      if (agenteId !== "todos" && a.agente_id !== agenteId) return false;
      if (termo && !`${a.nome} ${a.descricao ?? ""}`.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [automacoes.data, busca, tipo, situacao, agenteId]);

  const [pendente, setPendente] = useState(false);

  async function alternar(id: string, ativo: boolean) {
    setPendente(true);
    try {
      const r: ResultadoOperacao = await fnEstado({ data: { id, ativo } });
      if (!r.ok) toast.error(r.erro ?? "Não foi possível alterar a automação.");
      else toast.success(ativo ? "Automação ativada." : "Automação pausada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao alterar a automação.");
    } finally {
      setPendente(false);
      void qc.invalidateQueries({ queryKey: ["agentes-automacoes"] });
    }
  }

  async function executar(id: string) {
    setPendente(true);
    try {
      const r: ResultadoOperacao = await fnExecutar({ data: { id } });
      if (!r.ok) toast.error(r.erro ?? "Não foi possível executar.");
      else toast.success("Execução solicitada. O worker vai processá-la em instantes.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao solicitar a execução.");
    } finally {
      setPendente(false);
      void qc.invalidateQueries({ queryKey: ["agentes-automacoes"] });
      void qc.invalidateQueries({ queryKey: ["automacao-historico"] });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Automações"
        subtitulo="Tarefas dos agentes executadas por agendamento, recorrência, evento ou sob demanda. O worker processa tudo fora do navegador."
        semPaddingHorizontal
      />

      <div className="flex flex-wrap items-center gap-2">
        {podeGerenciar && (
          <Button size="sm" onClick={() => setEdicao({ aberto: true, automacao: null })}>
            <Plus className="mr-2 h-4 w-4" />
            Nova automação
          </Button>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link to="/agentes/monitoramento">
            <Activity className="mr-2 h-4 w-4" />
            Monitoramento
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => void automacoes.refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="w-64"
          placeholder="Pesquisar por nome ou descrição"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS_AUTOMACAO.map((t) => (
              <SelectItem key={t} value={t}>
                {ROTULOS_TIPO_AUTOMACAO[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={situacao} onValueChange={setSituacao}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="ativas">Ativas</SelectItem>
            <SelectItem value="pausadas">Pausadas</SelectItem>
            <SelectItem value="com_erro">Com erro</SelectItem>
          </SelectContent>
        </Select>
        <Select value={agenteId} onValueChange={setAgenteId}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os agentes</SelectItem>
            {(agentes.data ?? []).map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {automacoes.isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!automacoes.isLoading && filtradas.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {(automacoes.data ?? []).length === 0
                ? "Nenhuma automação cadastrada."
                : "Nenhuma automação corresponde aos filtros."}
            </CardContent>
          </Card>
        )}

        {filtradas.map((a) => (
          <Card key={a.id}>
            <CardContent className="space-y-3 pt-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.nome}</span>
                    <Badge variant="outline">{ROTULOS_TIPO_AUTOMACAO[a.tipo_gatilho as keyof typeof ROTULOS_TIPO_AUTOMACAO] ?? a.tipo_gatilho}</Badge>
                    <Badge variant={a.ativo ? "default" : "secondary"}>{a.ativo ? "Ativa" : "Pausada"}</Badge>
                    {a.ultimo_status && (
                      <Badge className={corStatus(a.ultimo_status)}>
                        {rotulo(ROTULOS_STATUS_AUTOMACAO, a.ultimo_status)}
                      </Badge>
                    )}
                  </div>
                  {a.descricao && <p className="text-sm text-muted-foreground">{a.descricao}</p>}
                  <p className="text-xs text-muted-foreground">
                    Agente: {nomeAgente.get(a.agente_id) ?? "—"} · {descreverAgendamento(a)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {podeGerenciar && (
                    <div className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={a.ativo}
                        disabled={pendente}
                        onCheckedChange={(v) => void alternar(a.id, v)}
                        aria-label={a.ativo ? "Pausar automação" : "Ativar automação"}
                      />
                      <span>{a.ativo ? "Ativa" : "Pausada"}</span>
                    </div>
                  )}
                  {podeExecutar && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pendente}
                      onClick={() => void executar(a.id)}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Executar agora
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setHistoricoId(a.id)}>
                    <History className="mr-2 h-4 w-4" />
                    Histórico
                  </Button>
                  {podeGerenciar && (
                    <Button size="sm" variant="outline" onClick={() => setEdicao({ aberto: true, automacao: a })}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                <span>Próxima execução: {a.ativo ? formatar(a.proxima_execucao_em) : "—"}</span>
                <span>Última execução: {formatar(a.ultima_execucao_em)}</span>
                <span>
                  Falhas consecutivas: {a.falhas_consecutivas}/{a.desativar_apos_falhas} · Tentativas por execução:{" "}
                  {a.max_tentativas}
                </span>
              </div>
              {a.ultimo_erro && (
                <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{a.ultimo_erro}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <DialogAutomacao
        aberto={edicao.aberto}
        automacao={edicao.automacao}
        agentes={agentes.data ?? []}
        aoFechar={() => setEdicao({ aberto: false, automacao: null })}
        aoSalvar={() => void qc.invalidateQueries({ queryKey: ["agentes-automacoes"] })}
      />

      <DialogHistorico
        id={historicoId}
        nome={(automacoes.data ?? []).find((a) => a.id === historicoId)?.nome ?? ""}
        aoFechar={() => setHistoricoId(null)}
      />
    </div>
  );
}

function DialogHistorico({ id, nome, aoFechar }: { id: string | null; nome: string; aoFechar: () => void }) {
  const fn = useServerFn(historicoAutomacao);
  const historico = useQuery({
    queryKey: ["automacao-historico", id],
    queryFn: () => fn({ data: { id: id!, limite: 50 } }),
    enabled: !!id,
    refetchInterval: id ? 10_000 : false,
  });

  return (
    <Dialog open={!!id} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico — {nome}</DialogTitle>
          <DialogDescription>Execuções solicitadas para esta automação, com tentativas e erros.</DialogDescription>
        </DialogHeader>
        {historico.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (historico.data ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma execução registrada.</p>
        ) : (
          <div className="space-y-2">
            {(historico.data ?? []).map((t) => (
              <div key={t.id} className="space-y-1 rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{rotulo(ROTULOS_STATUS_TAREFA, t.status)}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {t.origem ?? "—"} · tentativas {t.tentativas}/{t.max_tentativas}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatar(t.criado_em)}</span>
                </div>
                {t.ultimo_erro && <p className="text-xs text-destructive">{t.ultimo_erro}</p>}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

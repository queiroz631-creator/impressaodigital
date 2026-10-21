import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Timer, Workflow } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/AppLayout";
import { minhasPermissoesAgentes } from "@/lib/agentes/agentes.functions";
import {
  atualizarAlerta,
  obterMonitoramento,
  type AlertaItem,
  type ResultadoOperacao,
} from "@/lib/agentes/automacoes.functions";
import { ROTULOS_STATUS_TAREFA, rotulo } from "@/lib/agentes/utils/rotulos";

const ATUALIZACAO_MS = 15_000;

function formatar(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}

function duracao(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
}

function corEstadoWorker(estado: string): string {
  switch (estado) {
    case "online":
      return "bg-emerald-600 hover:bg-emerald-600 text-white";
    case "ocupado":
      return "bg-sky-600 hover:bg-sky-600 text-white";
    case "inativo":
      return "bg-amber-500 hover:bg-amber-500 text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function corSeveridade(s: AlertaItem["severidade"]): string {
  if (s === "critico") return "bg-destructive text-destructive-foreground";
  if (s === "aviso") return "bg-amber-500 hover:bg-amber-500 text-white";
  return "bg-muted text-muted-foreground";
}

function Indicador({ titulo, valor, detalhe }: { titulo: string; valor: string | number; detalhe?: string }) {
  return (
    <Card>
      <CardContent className="space-y-1 pt-4">
        <p className="text-xs text-muted-foreground">{titulo}</p>
        <p className="text-2xl font-semibold">{valor}</p>
        {detalhe && <p className="text-xs text-muted-foreground">{detalhe}</p>}
      </CardContent>
    </Card>
  );
}

export default function MonitoramentoPainel() {
  const qc = useQueryClient();
  const fnMonitor = useServerFn(obterMonitoramento);
  const fnPermissoes = useServerFn(minhasPermissoesAgentes);
  const fnAlerta = useServerFn(atualizarAlerta);

  const permissoes = useQuery({ queryKey: ["agentes-permissoes"], queryFn: () => fnPermissoes() });
  const monitor = useQuery({
    queryKey: ["agentes-monitoramento"],
    queryFn: () => fnMonitor(),
    refetchInterval: ATUALIZACAO_MS,
  });

  const [pendente, setPendente] = useState(false);

  async function atualizar(id: string, status: "reconhecido" | "resolvido") {
    setPendente(true);
    try {
      const r: ResultadoOperacao = await fnAlerta({ data: { id, status } });
      if (!r.ok) toast.error(r.erro ?? "Não foi possível atualizar o alerta.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar o alerta.");
    } finally {
      setPendente(false);
      void qc.invalidateQueries({ queryKey: ["agentes-monitoramento"] });
    }
  }

  const m = monitor.data;
  const podeGerenciar = permissoes.data?.gerenciar ?? false;

  const totalExec = m ? m.execucoes_24h.concluidas + m.execucoes_24h.falhas : 0;
  const taxaFalhas = m && totalExec > 0 ? `${((m.execucoes_24h.falhas / totalExec) * 100).toFixed(1)}%` : "—";

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Monitoramento"
        subtitulo={`Workers, agentes, fila e alertas. Atualiza a cada ${ATUALIZACAO_MS / 1000} s. Um worker só é considerado ativo se enviou heartbeat nos últimos 90 s.`}
        semPaddingHorizontal
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void monitor.refetch()} disabled={monitor.isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${monitor.isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/agentes/automacoes">
            <Workflow className="mr-2 h-4 w-4" />
            Automações
          </Link>
        </Button>
        {m && <span className="text-xs text-muted-foreground">Atualizado em {formatar(m.atualizado_em)}</span>}
      </div>

      {monitor.isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {monitor.isError && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-destructive">
            {monitor.error instanceof Error ? monitor.error.message : "Não foi possível carregar o monitoramento."}
          </CardContent>
        </Card>
      )}

      {m && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Indicador titulo="Agentes ativos" valor={`${m.agentes_ativos}/${m.agentes_total}`} />
            <Indicador
              titulo="Workers"
              valor={`${m.workers_online + m.workers_ocupados}`}
              detalhe={`${m.workers_online} online · ${m.workers_ocupados} ocupado(s) · ${m.workers_inativos} inativo(s)`}
            />
            <Indicador
              titulo="Fila"
              valor={m.tarefas.aguardando}
              detalhe={`${m.tarefas.em_execucao} em execução${
                m.tarefas.mais_antiga_aguardando ? ` · mais antiga: ${formatar(m.tarefas.mais_antiga_aguardando)}` : ""
              }`}
            />
            <Indicador titulo="Aprovações pendentes" valor={m.aprovacoes_pendentes} />
            <Indicador titulo="Tarefas concluídas (24 h)" valor={m.tarefas.concluidas_24h} />
            <Indicador titulo="Tarefas com falha (24 h)" valor={m.tarefas.falhas_24h} />
            <Indicador
              titulo="Taxa de falhas (24 h)"
              valor={taxaFalhas}
              detalhe={totalExec > 0 ? `${m.execucoes_24h.falhas} de ${totalExec} execuções` : "Sem execuções finalizadas"}
            />
            <Indicador
              titulo="Tempo médio de execução"
              valor={duracao(m.tempo_medio_execucao_ms)}
              detalhe={`Última atividade: ${formatar(m.ultima_atividade)}`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4" />
                Alertas ativos ({m.alertas.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {m.alertas.length === 0 && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Nenhum alerta ativo.
                </p>
              )}
              {m.alertas.map((a) => (
                <div key={a.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-3 text-sm">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={corSeveridade(a.severidade)}>{a.severidade}</Badge>
                      <span className="font-medium">{a.titulo}</span>
                      {a.status === "reconhecido" && <Badge variant="outline">Reconhecido</Badge>}
                    </div>
                    {a.descricao && <p className="text-xs text-muted-foreground">{a.descricao}</p>}
                    <p className="text-xs text-muted-foreground">
                      Origem: {a.origem} · {formatar(a.criado_em)}
                    </p>
                  </div>
                  {podeGerenciar && (
                    <div className="flex gap-2">
                      {a.status === "aberto" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendente}
                          onClick={() => void atualizar(a.id, "reconhecido")}
                        >
                          Reconhecer
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pendente}
                        onClick={() => void atualizar(a.id, "resolvido")}
                      >
                        Resolver
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Workers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {m.workers.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum worker registrado nas últimas 24 h.</p>
                )}
                {m.workers.map((w) => (
                  <div key={w.worker_id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                    <Badge className={corEstadoWorker(w.estado)}>{w.estado}</Badge>
                    <span className="truncate font-mono text-xs">{w.worker_id}</span>
                    <span className="text-xs text-muted-foreground">
                      {w.hostname ?? "—"} · v{w.versao ?? "?"} · último sinal {formatar(w.ultimo_ping)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Agentes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {m.agentes.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                    <Badge variant={a.ativo ? "default" : "secondary"}>{a.ativo ? "Ativo" : "Desativado"}</Badge>
                    <span className="font-medium">{a.nome}</span>
                    <span className="text-xs text-muted-foreground">
                      fila {a.tarefas_aguardando} · executando {a.tarefas_em_execucao} · última atividade{" "}
                      {formatar(a.ultima_atividade)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Timer className="h-4 w-4" />
                Fila de tarefas recentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {m.tarefas_recentes.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma tarefa registrada.</p>
              )}
              {m.tarefas_recentes.map((t) => (
                <div key={t.id} className="space-y-1 rounded-md border p-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{rotulo(ROTULOS_STATUS_TAREFA, t.status)}</Badge>
                    <span className="font-medium">{t.agente_nome}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.tipo} · tentativas {t.tentativas}/{t.max_tentativas} · {formatar(t.criado_em)}
                    </span>
                  </div>
                  {t.ultimo_erro && <p className="text-xs text-destructive">{t.ultimo_erro}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

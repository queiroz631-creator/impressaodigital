import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/AppLayout";
import {
  listarAgentes,
  listarExecucoes,
  obterExecucao,
  type ExecucaoResumo,
} from "@/lib/agentes/agentes.functions";
import {
  ROTULOS_ORIGEM,
  ROTULOS_STATUS_APROVACAO,
  ROTULOS_STATUS_EXECUCAO,
  ROTULOS_STATUS_PASSO,
  corStatusExecucao,
  rotulo,
} from "@/lib/agentes/utils/rotulos";

const STATUS = [
  "todas",
  "pendente",
  "executando",
  "aguardando_aprovacao",
  "aguardando_reconciliacao",
  "concluida",
  "falha",
  "cancelada",
  "indeterminado",
];

export default function ExecucoesPainel() {
  const fnListar = useServerFn(listarExecucoes);
  const fnAgentes = useServerFn(listarAgentes);

  const [status, setStatus] = useState("todas");
  const [agenteId, setAgenteId] = useState("todos");
  const [selecionada, setSelecionada] = useState<string | null>(null);

  const agentes = useQuery({ queryKey: ["agentes-lista"], queryFn: () => fnAgentes() });
  const execucoes = useQuery({
    queryKey: ["agentes-execucoes", status, agenteId],
    queryFn: () =>
      fnListar({
        data: {
          status: status === "todas" ? undefined : status,
          agenteId: agenteId === "todos" ? undefined : agenteId,
          limite: 100,
        },
      }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Execuções dos agentes"
        subtitulo="Histórico de execuções, etapas e resultados. Nenhuma ferramenta é executada por esta tela."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "todas" ? "Todos os status" : rotulo(ROTULOS_STATUS_EXECUCAO, s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={agenteId} onValueChange={setAgenteId}>
          <SelectTrigger className="w-56">
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

        <Button variant="outline" size="sm" onClick={() => void execucoes.refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-2 pt-4">
          {execucoes.isLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!execucoes.isLoading && (execucoes.data ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma execução registrada.</p>
          )}
          {(execucoes.data ?? []).map((e) => (
            <LinhaExecucao key={e.id} execucao={e} aoAbrir={() => setSelecionada(e.id)} />
          ))}
        </CardContent>
      </Card>

      <DialogExecucao id={selecionada} aoFechar={() => setSelecionada(null)} />
    </div>
  );
}

function LinhaExecucao({ execucao, aoAbrir }: { execucao: ExecucaoResumo; aoAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={aoAbrir}
      className="flex w-full flex-wrap items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50"
    >
      <Badge className={corStatusExecucao(execucao.status)}>
        {rotulo(ROTULOS_STATUS_EXECUCAO, execucao.status)}
      </Badge>
      <span className="font-medium">{execucao.agente_nome}</span>
      <span className="text-xs text-muted-foreground">
        {rotulo(ROTULOS_ORIGEM, execucao.origem)} · {new Date(execucao.criado_em).toLocaleString("pt-BR")}
      </span>
      {execucao.erro && <span className="text-xs text-destructive">{execucao.erro}</span>}
    </button>
  );
}

function DialogExecucao({ id, aoFechar }: { id: string | null; aoFechar: () => void }) {
  const fnObter = useServerFn(obterExecucao);
  const detalhe = useQuery({
    queryKey: ["agentes-execucao", id],
    queryFn: () => fnObter({ data: { id: id! } }),
    enabled: !!id,
  });

  const execucao = detalhe.data?.execucao;

  return (
    <Dialog open={!!id} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalhe da execução</DialogTitle>
          <DialogDescription>
            {execucao
              ? `${rotulo(ROTULOS_ORIGEM, execucao.origem)} · ${new Date(execucao.criado_em).toLocaleString("pt-BR")}`
              : "Carregando…"}
          </DialogDescription>
        </DialogHeader>

        {detalhe.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !execucao ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Execução não encontrada.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={corStatusExecucao(execucao.status)}>
                {rotulo(ROTULOS_STATUS_EXECUCAO, execucao.status)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Profundidade {execucao.profundidade} · {execucao.modelo_usado ?? "modelo padrão"}
              </span>
            </div>

            <section className="space-y-2">
              <h4 className="text-sm font-medium">Etapas</h4>
              {(detalhe.data?.passos ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma etapa registrada.</p>
              )}
              {(detalhe.data?.passos ?? []).map((passo) => (
                <div key={passo.id} className="rounded-md border p-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">#{passo.ordem + 1}</span>
                    <Badge variant="secondary">{passo.tipo}</Badge>
                    <Badge variant="outline">{rotulo(ROTULOS_STATUS_PASSO, passo.status)}</Badge>
                    {passo.tentativas > 0 && (
                      <span className="text-xs text-muted-foreground">tentativas: {passo.tentativas}</span>
                    )}
                  </div>
                  {passo.descricao && <p className="mt-1 text-muted-foreground">{passo.descricao}</p>}
                  {passo.erro && <p className="mt-1 text-destructive">{passo.erro}</p>}
                </div>
              ))}
            </section>

            {(detalhe.data?.aprovacoes ?? []).length > 0 && (
              <section className="space-y-2">
                <h4 className="text-sm font-medium">Aprovações</h4>
                {(detalhe.data?.aprovacoes ?? []).map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                    <Badge variant="outline">{rotulo(ROTULOS_STATUS_APROVACAO, a.status)}</Badge>
                    {a.motivo && <span className="text-muted-foreground">{a.motivo}</span>}
                  </div>
                ))}
              </section>
            )}

            {(detalhe.data?.mensagens ?? []).length > 0 && (
              <section className="space-y-2">
                <h4 className="text-sm font-medium">Mensagens entre agentes</h4>
                {(detalhe.data?.mensagens ?? []).map((mensagem) => (
                  <pre
                    key={mensagem.id}
                    className="overflow-x-auto rounded-md bg-muted p-2 text-xs"
                  >
                    {JSON.stringify(mensagem.conteudo, null, 2)}
                  </pre>
                ))}
              </section>
            )}

            <section className="space-y-2">
              <h4 className="text-sm font-medium">Auditoria</h4>
              {(detalhe.data?.auditoria ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum registro.</p>
              )}
              {(detalhe.data?.auditoria ?? []).map((item) => (
                <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                  <span className="font-medium">{item.acao}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.criado_em).toLocaleString("pt-BR")}
                  </span>
                </div>
              ))}
            </section>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={aoFechar}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

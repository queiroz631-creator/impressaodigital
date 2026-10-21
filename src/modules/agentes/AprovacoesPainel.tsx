import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Loader2, RefreshCw, MessageSquare, Wrench, Zap, ShieldAlert, ScrollText, Settings, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/AppLayout";
import {
  decidirAprovacao,
  listarAprovacoes,
  minhasPermissoesAgentes,
  type AprovacaoResumo,
} from "@/lib/agentes/agentes.functions";
import { ROTULOS_STATUS_APROVACAO, rotulo } from "@/lib/agentes/utils/rotulos";

const ATALHOS = [
  { rota: "/agentes/chat", nome: "Chat Operacional", icone: MessageSquare },
  { rota: "/agentes/ferramentas", nome: "Ferramentas", icone: Wrench },
  { rota: "/agentes/execucoes", nome: "Execuções", icone: Zap },
  { rota: "/agentes/aprovacoes", nome: "Aprovações", icone: ShieldAlert },
  { rota: "/agentes/auditoria", nome: "Auditoria", icone: ScrollText },
  { rota: "/agentes/configuracoes", nome: "Configurações", icone: Settings },
] as const;

export default function AprovacoesPainel() {
  const qc = useQueryClient();
  const fnListar = useServerFn(listarAprovacoes);
  const fnPermissoes = useServerFn(minhasPermissoesAgentes);

  const [status, setStatus] = useState("pendente");
  const [decisao, setDecisao] = useState<{ aprovacao: AprovacaoResumo; tipo: "aprovada" | "recusada" } | null>(null);

  const permissoes = useQuery({ queryKey: ["agentes-permissoes"], queryFn: () => fnPermissoes() });
  const aprovacoes = useQuery({
    queryKey: ["agentes-aprovacoes", status],
    queryFn: () => fnListar({ data: { status: status as "pendente" | "aprovada" | "recusada" | "expirada" | "todas" } }),
  });

  const podeAprovar = permissoes.data?.aprovar ?? false;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Aprovações"
        subtitulo="Operações sensíveis aguardando decisão. A decisão apenas libera ou cancela a etapa — nada é executado aqui."
        semPaddingHorizontal
      />

      <div className="flex flex-wrap gap-2">
        {ATALHOS.map((atalho) => (
          <Button key={atalho.rota} variant="outline" size="sm" asChild>
            <Link to={atalho.rota}>
              <atalho.icone className="mr-2 h-4 w-4" />
              {atalho.nome}
            </Link>
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="aprovada">Aprovadas</SelectItem>
            <SelectItem value="recusada">Recusadas</SelectItem>
            <SelectItem value="expirada">Expiradas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => void aprovacoes.refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {!podeAprovar && (
        <p className="text-sm text-muted-foreground">
          Você pode visualizar, mas não tem permissão para decidir aprovações.
        </p>
      )}

      <Card>
        <CardContent className="space-y-3 pt-4">
          {aprovacoes.isLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!aprovacoes.isLoading && (aprovacoes.data ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma aprovação encontrada.</p>
          )}
          {(aprovacoes.data ?? []).map((a) => (
            <div key={a.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{rotulo(ROTULOS_STATUS_APROVACAO, a.status)}</Badge>
                <span className="font-medium">{a.agente_nome}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(a.solicitado_em).toLocaleString("pt-BR")}
                </span>
                {a.expira_em && (
                  <span className="text-xs text-muted-foreground">
                    expira em {new Date(a.expira_em).toLocaleString("pt-BR")}
                  </span>
                )}
              </div>
              <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
                {JSON.stringify(a.parametros, null, 2)}
              </pre>
              {a.motivo && <p className="text-sm text-muted-foreground">Motivo: {a.motivo}</p>}
              {a.status === "pendente" && podeAprovar && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setDecisao({ aprovacao: a, tipo: "aprovada" })}>
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setDecisao({ aprovacao: a, tipo: "recusada" })}
                  >
                    Recusar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <DialogDecisao
        dado={decisao}
        aoFechar={() => setDecisao(null)}
        aoConcluir={async () => {
          await qc.invalidateQueries({ queryKey: ["agentes-aprovacoes"] });
          await qc.invalidateQueries({ queryKey: ["agentes-metricas"] });
        }}
      />
    </div>
  );
}

function DialogDecisao({
  dado,
  aoFechar,
  aoConcluir,
}: {
  dado: { aprovacao: AprovacaoResumo; tipo: "aprovada" | "recusada" } | null;
  aoFechar: () => void;
  aoConcluir: () => Promise<void>;
}) {
  const fnDecidir = useServerFn(decidirAprovacao);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    if (!dado) return;
    setEnviando(true);
    try {
      const resp = await fnDecidir({
        data: { id: dado.aprovacao.id, decisao: dado.tipo, motivo: motivo.trim() },
      });
      if (!resp.ok) {
        toast.error(resp.erro ?? "Não foi possível registrar a decisão.");
        return;
      }
      toast.success(dado.tipo === "aprovada" ? "Aprovação registrada." : "Recusa registrada.");
      await aoConcluir();
      setMotivo("");
      aoFechar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog
      open={!!dado}
      onOpenChange={(v) => {
        if (!v) {
          setMotivo("");
          aoFechar();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dado?.tipo === "aprovada" ? "Aprovar operação" : "Recusar operação"}</DialogTitle>
          <DialogDescription>
            A decisão é registrada com seus dados e não executa a ferramenta. O agente só prossegue
            quando o worker estiver autorizado.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label htmlFor="aprov-motivo">Motivo (opcional)</Label>
          <Textarea
            id="aprov-motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button
            variant={dado?.tipo === "recusada" ? "destructive" : "default"}
            onClick={() => void confirmar()}
            disabled={enviando}
          >
            {dado?.tipo === "aprovada" ? "Aprovar" : "Recusar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

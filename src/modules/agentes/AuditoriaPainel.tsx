import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Loader2, RefreshCw, MessageSquare, Wrench, Zap, ShieldAlert, ScrollText, Settings, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/AppLayout";
import { listarAuditoria } from "@/lib/agentes/agentes.functions";

const ATALHOS = [
  { rota: "/agentes/chat", nome: "Chat Operacional", icone: MessageSquare },
  { rota: "/agentes/ferramentas", nome: "Ferramentas", icone: Wrench },
  { rota: "/agentes/execucoes", nome: "Execuções", icone: Zap },
  { rota: "/agentes/aprovacoes", nome: "Aprovações", icone: ShieldAlert },
  { rota: "/agentes/auditoria", nome: "Auditoria", icone: ScrollText },
  { rota: "/agentes/configuracoes", nome: "Configurações", icone: Settings },
] as const;

export default function AuditoriaPainel() {
  const fnListar = useServerFn(listarAuditoria);
  const auditoria = useQuery({ queryKey: ["agentes-auditoria"], queryFn: () => fnListar({ data: { limite: 100 } }) });

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Auditoria"
        subtitulo="Registro somente de inclusão das operações sensíveis da Central de Agentes."
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

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => void auditoria.refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-2 pt-4">
          {auditoria.isLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!auditoria.isLoading && (auditoria.data ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum registro de auditoria.</p>
          )}
          {(auditoria.data ?? []).map((item) => (
            <div key={item.id} className="space-y-1 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{item.acao}</Badge>
                {item.entidade && (
                  <span className="text-xs text-muted-foreground">
                    {item.entidade}
                    {item.entidade_id ? ` · ${item.entidade_id}` : ""}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {new Date(item.criado_em).toLocaleString("pt-BR")}
                </span>
              </div>
              {item.dados && Object.keys(item.dados as object).length > 0 && (
                <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
                  {JSON.stringify(item.dados, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

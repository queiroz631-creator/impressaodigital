import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ativarVersaoAgente,
  excluirVersaoAgente,
  listarVersoesAgente,
  type VersaoAgenteDetalhe,
} from "@/lib/agentes/agentes.functions";
import { ROTULOS_TIPO_VERSAO, rotulo } from "@/lib/agentes/utils/rotulos";

interface Props {
  aberto: boolean;
  agenteId: string | null;
  agenteNome: string;
  aoFechar: () => void;
}

export default function DialogVersoes({ aberto, agenteId, agenteNome, aoFechar }: Props) {
  const qc = useQueryClient();
  const fnListar = useServerFn(listarVersoesAgente);
  const fnAtivar = useServerFn(ativarVersaoAgente);
  const fnExcluir = useServerFn(excluirVersaoAgente);

  const versoes = useQuery({
    queryKey: ["agente-versoes", agenteId],
    queryFn: () => fnListar({ data: { agenteId: agenteId! } }),
    enabled: aberto && !!agenteId,
  });

  async function handleAtivar(versaoId: string) {
    const resp = await fnAtivar({ data: { versaoId } });
    if (!resp.ok) {
      toast.error(resp.erro ?? "Não foi possível ativar a versão.");
      return;
    }
    toast.success("Versão ativada.");
    await qc.invalidateQueries({ queryKey: ["agente-versoes", agenteId] });
    await qc.invalidateQueries({ queryKey: ["agentes-lista"] });
    await qc.invalidateQueries({ queryKey: ["agentes-metricas"] });
  }

  async function handleExcluir(versaoId: string) {
    if (!confirm("Excluir esta versão permanentemente?")) return;
    const resp = await fnExcluir({ data: { versaoId } });
    if (!resp.ok) {
      toast.error(resp.erro ?? "Não foi possível excluir a versão.");
      return;
    }
    toast.success("Versão excluída.");
    await qc.invalidateQueries({ queryKey: ["agente-versoes", agenteId] });
  }

  function formatJson(conteudo: unknown): string {
    try {
      return JSON.stringify(conteudo, null, 2);
    } catch {
      return String(conteudo);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Versões de {agenteNome}</DialogTitle>
          <DialogDescription>
            Histórico de prompts e configurações. Apenas uma versão por tipo pode estar ativa.
          </DialogDescription>
        </DialogHeader>

        {versoes.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (versoes.data ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma versão registrada.</p>
        ) : (
          <div className="space-y-3 py-2">
            {(versoes.data ?? []).map((v) => (
              <div key={v.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={v.tipo === "prompt" ? "default" : "secondary"}>
                    {rotulo(ROTULOS_TIPO_VERSAO, v.tipo)}
                  </Badge>
                  <Badge variant={v.ativo ? "default" : "outline"}>
                    {v.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    v{v.versao} · {new Date(v.criado_em).toLocaleString("pt-BR")}
                  </span>
                  {v.criado_por && (
                    <span className="text-xs text-muted-foreground">por {v.criado_por.slice(0, 8)}</span>
                  )}
                </div>
                {v.observacao && (
                  <p className="text-sm text-muted-foreground">{v.observacao}</p>
                )}
                <div className="max-h-40 overflow-auto rounded bg-muted p-2 text-xs font-mono">
                  {formatJson(v.conteudo)}
                </div>
                <div className="flex justify-end gap-2">
                  {!v.ativo && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleAtivar(v.id)}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Ativar
                    </Button>
                  )}
                  {!v.ativo && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleExcluir(v.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </Button>
                  )}
                  {v.ativo && (
                    <Badge variant="secondary" className="self-center">
                      Versão atual
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
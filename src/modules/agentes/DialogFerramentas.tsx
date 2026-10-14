import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  desvincularFerramenta,
  listarFerramentas,
  obterAgente,
  vincularFerramenta,
  type AgenteResumo,
} from "@/lib/agentes/agentes.functions";
import { ROTULOS_RISCO, rotulo } from "@/lib/agentes/utils/rotulos";

interface Props {
  aberto: boolean;
  agente: AgenteResumo | null;
  aoFechar: () => void;
}

export default function DialogFerramentas({ aberto, agente, aoFechar }: Props) {
  const qc = useQueryClient();
  const listar = useServerFn(listarFerramentas);
  const obter = useServerFn(obterAgente);
  const vincular = useServerFn(vincularFerramenta);
  const desvincular = useServerFn(desvincularFerramenta);

  const ferramentas = useQuery({
    queryKey: ["agentes-ferramentas"],
    queryFn: () => listar(),
    enabled: aberto,
  });

  const detalhe = useQuery({
    queryKey: ["agente-detalhe", agente?.id],
    queryFn: () => obter({ data: { id: agente!.id } }),
    enabled: aberto && !!agente?.id,
  });

  async function alternar(ferramentaId: string, marcar: boolean) {
    if (!agente) return;
    const resp = marcar
      ? await vincular({ data: { agenteId: agente.id, ferramentaId, ativo: true } })
      : await desvincular({ data: { agenteId: agente.id, ferramentaId } });
    if (!resp.ok) {
      toast.error(resp.erro ?? "Não foi possível atualizar o vínculo.");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["agente-detalhe", agente.id] });
    await qc.invalidateQueries({ queryKey: ["agentes-lista"] });
  }

  const vinculadas = new Set((detalhe.data?.vinculos ?? []).map((v) => v.ferramenta_id));

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ferramentas de {agente?.nome}</DialogTitle>
          <DialogDescription>
            Somente as ferramentas marcadas podem ser usadas por este agente. A execução continua
            exigindo permissão explícita e aprovação quando a ferramenta for sensível.
          </DialogDescription>
        </DialogHeader>

        {ferramentas.isLoading || detalhe.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2 py-2">
            {(ferramentas.data ?? []).map((f) => {
              const marcada = vinculadas.has(f.id);
              return (
                <label
                  key={f.id}
                  className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={marcada}
                    onCheckedChange={(v) => void alternar(f.id, v === true)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{f.nome}</span>
                      <code className="rounded bg-muted px-1 text-xs">{f.chave}</code>
                      <Badge variant={f.tipo === "acao" ? "default" : "secondary"}>{f.tipo}</Badge>
                      <Badge variant="outline">Risco {rotulo(ROTULOS_RISCO, f.risco)}</Badge>
                      {f.sensivel && (
                        <Badge variant="destructive" className="gap-1">
                          <ShieldAlert className="h-3 w-3" /> Sensível
                        </Badge>
                      )}
                      {f.efeito_externo && <Badge variant="outline">Efeito externo</Badge>}
                      {!f.ativo && <Badge variant="secondary">Inativa</Badge>}
                    </div>
                    {f.descricao && (
                      <p className="mt-1 text-sm text-muted-foreground">{f.descricao}</p>
                    )}
                  </div>
                </label>
              );
            })}
            {!ferramentas.data?.length && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma ferramenta cadastrada. Cadastre em “Ferramentas”.
              </p>
            )}
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

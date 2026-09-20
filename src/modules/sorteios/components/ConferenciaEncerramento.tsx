import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { brl, dataHoraBR } from "@/lib/format";
import {
  conferenciaEncerramentoSorteio,
  encerrarSorteio,
  reabrirSorteio,
} from "@/lib/sorteios.functions";
import { MENSAGEM_REABERTURA } from "../services/status";
import { IndicadorCard } from "./IndicadorCard";
import type { ConferenciaSorteio, Sorteio, TotaisConferencia } from "../types";

/**
 * Conferência para encerramento do sorteio.
 *
 * Somente leitura: os números vêm da função do banco `sorteio_conferencia`,
 * que não corrige nem recalcula nada. O botão só fica disponível quando a
 * conferência atual está aprovada, mas a decisão final é sempre do servidor,
 * que refaz a conferência dentro da transação de encerramento.
 */
export function ConferenciaEncerramento({ sorteio }: { sorteio: Sorteio }) {
  const qc = useQueryClient();
  const conferir = useServerFn(conferenciaEncerramentoSorteio);
  const encerrar = useServerFn(encerrarSorteio);
  const reabrir = useServerFn(reabrirSorteio);

  const encerrado = sorteio.status !== "ATIVO";

  const { data: conferencia, isLoading } = useQuery<ConferenciaSorteio>({
    queryKey: ["sorteio-conferencia", sorteio.id],
    queryFn: () => conferir({ data: { sorteioId: sorteio.id } }) as Promise<ConferenciaSorteio>,
    enabled: !encerrado,
  });

  const mutation = useMutation({
    mutationFn: () =>
      encerrar({ data: { sorteioId: sorteio.id } }) as Promise<{ resultado: string }>,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["sorteio", sorteio.id] });
      qc.invalidateQueries({ queryKey: ["sorteios"] });
      qc.invalidateQueries({ queryKey: ["sorteio-conferencia", sorteio.id] });
      toast.success(
        r.resultado === "ENCERRADO" ? "Sorteio encerrado." : "Este sorteio já estava encerrado.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reabertura = useMutation({
    mutationFn: () =>
      reabrir({ data: { sorteioId: sorteio.id } }) as Promise<{
        resultado: "REABERTO" | "IGNORADO";
        motivo?: string;
      }>,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["sorteio", sorteio.id] });
      qc.invalidateQueries({ queryKey: ["sorteios"] });
      qc.invalidateQueries({ queryKey: ["sorteio-conferencia", sorteio.id] });
      if (r.resultado === "REABERTO") {
        toast.success("Sorteio reaberto. A base voltou a aceitar movimentações.");
      } else {
        toast.error(MENSAGEM_REABERTURA[r.motivo ?? ""] ?? "Não foi possível reabrir o sorteio.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Depois de encerrado, os números vêm do retrato gravado no encerramento.
  const retrato = sorteio.conferencia_encerramento ?? null;
  const atual = encerrado ? retrato : (conferencia ?? null);
  const totais = atual?.totais;
  const pendencias = atual?.pendencias ?? [];
  const inconsistencias = atual?.inconsistencias ?? [];
  const aprovada = atual?.aprovada === true;

  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">
          {encerrado ? "Conferência do encerramento" : "Conferência para encerramento"}
        </CardTitle>
        {!encerrado && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={!aprovada || isLoading || mutation.isPending}>
                {mutation.isPending ? "Encerrando..." : "Encerrar sorteio"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tem certeza que deseja encerrar este sorteio?</AlertDialogTitle>
                <AlertDialogDescription>
                  Após o encerramento, novas notas, participações e cupons não poderão alterar a
                  base deste sorteio. Nada é apagado: todo o histórico continua disponível para
                  consulta.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction onClick={() => mutation.mutate()}>
                  Encerrar sorteio
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {encerrado && (
          <p className="text-sm">
            <span className="text-muted-foreground">Encerrado em: </span>
            {dataHoraBR(sorteio.encerrado_em ?? null)}
          </p>
        )}

        {isLoading && !encerrado && (
          <p className="text-sm text-muted-foreground">Conferindo a base do sorteio...</p>
        )}

        {totais && <Totais totais={totais} />}

        {!encerrado && atual && (
          <div
            className={
              aprovada
                ? "flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm font-medium"
                : "flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm font-medium text-destructive"
            }
          >
            {aprovada ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> Conferência aprovada
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4" /> Existem pendências
              </>
            )}
          </div>
        )}

        {pendencias.length > 0 && (
          <Lista titulo="Pendências (podem mudar a quantidade de cupons)" itens={pendencias} />
        )}
        {inconsistencias.length > 0 && (
          <Lista titulo="Inconsistências (a base não fecha)" itens={inconsistencias} />
        )}

        {encerrado && !retrato && (
          <p className="text-sm text-muted-foreground">
            Este sorteio foi encerrado sem retrato de conferência gravado.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Totais({ totais }: { totais: TotaisConferencia }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <IndicadorCard titulo="Participantes" valor={totais.participantes} />
      <IndicadorCard titulo="Concorrem ao sorteio" valor={totais.participantes_concorrentes} />
      <IndicadorCard titulo="Notas válidas" valor={totais.notas_validas} />
      <IndicadorCard titulo="Notas canceladas" valor={totais.notas_canceladas} />
      <IndicadorCard titulo="Notas pendentes" valor={totais.notas_pendentes} />
      <IndicadorCard titulo="Cupons ativos" valor={totais.cupons_ativos} />
      <IndicadorCard titulo="Cupons cancelados" valor={totais.cupons_cancelados} />
      <IndicadorCard titulo="Cupons utilizados" valor={totais.cupons_utilizados} />
      <IndicadorCard
        titulo="Saldo acumulado"
        valor={brl(totais.saldo_acumulado_centavos / 100)}
        descricao="Troco que ainda não completou um cupom"
      />
      <IndicadorCard
        titulo="Fontes pendentes"
        valor={totais.fontes_pendentes}
        descricao={brl(totais.fontes_pendentes_centavos / 100)}
      />
      <IndicadorCard
        titulo="Contribuições"
        valor={totais.contribuicoes}
        descricao={brl(totais.contribuicoes_centavos / 100)}
      />
      <IndicadorCard
        titulo="Valor em notas válidas"
        valor={brl(totais.valor_notas_validas_centavos / 100)}
      />
    </div>
  );
}

function Lista({
  titulo,
  itens,
}: {
  titulo: string;
  itens: { codigo: string; mensagem: string; quantidade: number }[];
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{titulo}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {itens.map((i) => (
          <li key={i.codigo}>{i.mensagem}</li>
        ))}
      </ul>
    </div>
  );
}

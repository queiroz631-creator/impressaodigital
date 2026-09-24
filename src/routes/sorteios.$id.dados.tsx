import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brl, dataHoraBR } from "@/lib/format";
import { alterarStatusSorteio, reabrirSorteio } from "@/lib/sorteios.functions";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { useSorteio } from "@/modules/sorteios/hooks/useSorteios";
import { StatusSorteioBadge } from "@/modules/sorteios/components/StatusSorteioBadge";
import { NavSorteio } from "@/modules/sorteios/components/NavSorteio";
import {
  ROTULO_TRANSICAO,
  transicoesManuais,
  MENSAGEM_REABERTURA,
  somenteConsulta,
} from "@/modules/sorteios/services/status";
import type { StatusSorteio } from "@/modules/sorteios/types";

export const Route = createFileRoute("/sorteios/$id/dados")({
  component: () => (
    <AppLayout permissao="sorteios.visualizar">
      <DadosSorteio />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Dados do sorteio | Calculadora de Impressão Digital" },
      {
        name: "description",
        content: "Situação, período e regras da campanha de sorteio.",
      },
      { property: "og:title", content: "Dados do sorteio | Calculadora de Impressão Digital" },
      { property: "og:description", content: "Dados da campanha de sorteio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function DadosSorteio() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: sorteio, isLoading, error } = useSorteio(id);
  const alterarStatus = useServerFn(alterarStatusSorteio);

  const mutation = useMutation({
    mutationFn: (status: StatusSorteio) => alterarStatus({ data: { id, status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sorteio", id] });
      qc.invalidateQueries({ queryKey: ["sorteios"] });
      toast.success("Situação atualizada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reabrir = useServerFn(reabrirSorteio);
  const mReabrir = useMutation({
    mutationFn: () =>
      reabrir({ data: { sorteioId: id } }) as Promise<{
        resultado: "REABERTO" | "IGNORADO";
        motivo?: string;
        status?: string;
      }>,
    onSuccess: (r) => {
      if (r.resultado === "REABERTO") {
        qc.invalidateQueries({ queryKey: ["sorteio", id] });
        qc.invalidateQueries({ queryKey: ["sorteios"] });
        toast.success(
          `Sorteio reaberto. Situação atual: ${r.status === "RASCUNHO" ? "Rascunho" : "Ativo"}.`,
        );
      } else {
        toast.error(MENSAGEM_REABERTURA[r.motivo ?? ""] ?? "Não foi possível reabrir o sorteio.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!sorteio) return null;

  const transicoes = transicoesManuais(sorteio.status);

  return (
    <>
      <PageHeader titulo="Dados do sorteio" subtitulo={sorteio.nome} />
      <NavSorteio id={id} />

      <Card className="mb-4">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            Dados do sorteio <StatusSorteioBadge status={sorteio.status} />
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {!somenteConsulta(sorteio.status) && (
              <Button asChild variant="outline" size="sm">
                <Link to="/sorteios/$id/editar" params={{ id }}>
                  Editar
                </Link>
              </Button>
            )}
            {sorteio.status === "CANCELADO" && (
              <ConfirmarAcao
                titulo="Reabrir sorteio cancelado?"
                descricao="Tem certeza que deseja reabrir este sorteio cancelado? Ele voltará para a situação anterior ao cancelamento (Ativo ou Rascunho) e poderá receber notas e participações novamente."
                rotuloConfirmar="Reabrir sorteio"
                onConfirmar={() => mReabrir.mutate()}
              >
                <Button size="sm" disabled={mReabrir.isPending}>
                  {mReabrir.isPending ? "Reabrindo..." : "Reabrir sorteio"}
                </Button>
              </ConfirmarAcao>
            )}
            {transicoes.map((status) => (
              <Button
                key={status}
                size="sm"
                variant={status === "CANCELADO" ? "destructive" : "default"}
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(status)}
              >
                {ROTULO_TRANSICAO[status]}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Início: </span>
            {dataHoraBR(sorteio.data_inicio)}
          </p>
          <p>
            <span className="text-muted-foreground">Fim: </span>
            {dataHoraBR(sorteio.data_fim)}
          </p>
          <p>
            <span className="text-muted-foreground">Data do sorteio: </span>
            {dataHoraBR(sorteio.data_sorteio)}
          </p>
          <p>
            <span className="text-muted-foreground">Valor por cupom: </span>
            {brl(sorteio.valor_por_cupom_centavos / 100)}
          </p>
          <p>
            <span className="text-muted-foreground">Limite de cupons: </span>
            {sorteio.quantidade_maxima_cupons ?? "Sem limite"}
          </p>
          {sorteio.descricao && <p className="sm:col-span-2">{sorteio.descricao}</p>}
        </CardContent>
      </Card>
    </>
  );
}

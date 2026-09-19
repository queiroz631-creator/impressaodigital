import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Users, FileText, Ticket, Trophy, Wallet, Gift, Coins } from "lucide-react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brl, dataHoraBR } from "@/lib/format";
import { alterarStatusSorteio, processarCuponsDoSorteio } from "@/lib/sorteios.functions";
import { useIndicadoresSorteio, useSorteio } from "@/modules/sorteios/hooks/useSorteios";
import { StatusSorteioBadge } from "@/modules/sorteios/components/StatusSorteioBadge";
import { IndicadorCard } from "@/modules/sorteios/components/IndicadorCard";
import { NavSorteio } from "@/modules/sorteios/components/NavSorteio";
import { ConferenciaEncerramento } from "@/modules/sorteios/components/ConferenciaEncerramento";
import {
  ROTULO_TRANSICAO,
  transicoesManuais,
  somenteConsulta,
} from "@/modules/sorteios/services/status";

import {
  ROTULO_STATUS_NOTA,
  ROTULO_STATUS_CUPOM,
  type StatusSorteio,
} from "@/modules/sorteios/types";

export const Route = createFileRoute("/sorteios/$id/")({
  component: () => (
    <AppLayout permissao="sorteios.visualizar">
      <PainelSorteio />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Painel do sorteio | Calculadora de Impressão Digital" },
      {
        name: "description",
        content: "Situação, período, participantes, notas e cupons da campanha de sorteio.",
      },
      { property: "og:title", content: "Painel do sorteio | Calculadora de Impressão Digital" },
      { property: "og:description", content: "Indicadores da campanha de sorteio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PainelSorteio() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: sorteio, isLoading, error } = useSorteio(id);
  const { data: indicadores } = useIndicadoresSorteio(id);
  const alterarStatus = useServerFn(alterarStatusSorteio);

  const processarCupons = useServerFn(processarCuponsDoSorteio);

  const mutation = useMutation({
    mutationFn: (status: StatusSorteio) => alterarStatus({ data: { id, status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sorteio", id] });
      qc.invalidateQueries({ queryKey: ["sorteios"] });
      toast.success("Situação atualizada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mCupons = useMutation({
    mutationFn: () => processarCupons({ data: { sorteioId: id } }),
    onSuccess: (resumo) => {
      qc.invalidateQueries({ queryKey: ["sorteio-indicadores", id] });
      qc.invalidateQueries({ queryKey: ["sorteio", id] });
      qc.invalidateQueries({ queryKey: ["sorteio-cupons", id] });
      qc.invalidateQueries({ queryKey: ["sorteio-notas", id] });
      qc.invalidateQueries({ queryKey: ["sorteio-participantes", id] });
      toast.success(
        resumo.processadas === 0
          ? "Nenhuma nota nova para processar."
          : `${resumo.processadas} nota(s) processada(s) e ${resumo.cupons} cupom(ns) gerado(s).`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!sorteio) return null;

  const transicoes = transicoesManuais(sorteio.status);

  return (
    <>
      <PageHeader titulo={sorteio.nome} subtitulo={`Sorteio nº ${sorteio.numero_sorteio}`} />
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

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <IndicadorCard
          titulo="Participantes"
          valor={indicadores?.participantes ?? 0}
          icone={<Users className="h-5 w-5" />}
        />
        <IndicadorCard
          titulo="Notas"
          valor={indicadores?.notas ?? 0}
          icone={<FileText className="h-5 w-5" />}
          descricao={
            indicadores
              ? `${indicadores.porStatusNota.VALIDA} ${ROTULO_STATUS_NOTA.VALIDA.toLowerCase()}(s) · ${indicadores.porStatusNota.PENDENTE} ${ROTULO_STATUS_NOTA.PENDENTE.toLowerCase()}(s)`
              : undefined
          }
        />
        <IndicadorCard
          titulo="Cupons"
          valor={indicadores?.cupons ?? 0}
          icone={<Ticket className="h-5 w-5" />}
          descricao={
            indicadores
              ? `${indicadores.porStatusCupom.ATIVO} ${ROTULO_STATUS_CUPOM.ATIVO.toLowerCase()}(s)`
              : undefined
          }
        />
        <IndicadorCard
          titulo="Valor em notas válidas"
          valor={brl((indicadores?.valorValidoCentavos ?? 0) / 100)}
          icone={<Wallet className="h-5 w-5" />}
        />
        <IndicadorCard
          titulo="Saldo acumulado"
          valor={brl((indicadores?.saldoCentavos ?? 0) / 100)}
          icone={<Coins className="h-5 w-5" />}
          descricao="Troco que ainda não completou um cupom"
        />
        <IndicadorCard
          titulo="Cupons cancelados"
          valor={indicadores?.porStatusCupom.CANCELADO ?? 0}
          icone={<Ticket className="h-5 w-5" />}
          descricao={`${indicadores?.porStatusCupom.UTILIZADO ?? 0} ${ROTULO_STATUS_CUPOM.UTILIZADO.toLowerCase()}(s)`}
        />
        <IndicadorCard
          titulo="Prêmios ativos"
          valor={indicadores?.premiosAtivos ?? 0}
          icone={<Gift className="h-5 w-5" />}
        />
        <IndicadorCard
          titulo="Ganhadores"
          valor={indicadores?.ganhadores ?? 0}
          icone={<Trophy className="h-5 w-5" />}
        />
      </div>

      {sorteio.status === "ATIVO" && (
        <Card className="mb-4">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Saldo e cupons</CardTitle>
            <Button size="sm" disabled={mCupons.isPending} onClick={() => mCupons.mutate()}>
              {mCupons.isPending ? "Processando..." : "Gerar cupons pendentes"}
            </Button>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {(indicadores?.notasAguardandoCupons ?? 0) === 0
              ? "Todas as notas válidas já foram convertidas em saldo e cupons."
              : `${indicadores?.notasAguardandoCupons} nota(s) válida(s) aguardando processamento.`}
          </CardContent>
        </Card>
      )}

      {(sorteio.status === "ATIVO" || sorteio.status === "ENCERRADO") && (
        <ConferenciaEncerramento sorteio={sorteio} />
      )}



      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ganhadores</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {(indicadores?.ganhadores ?? 0) === 0
            ? "Nenhum ganhador registrado. A realização do sorteio será feita em uma etapa futura."
            : `${indicadores?.ganhadores} ganhador(es) registrado(s).`}
        </CardContent>
      </Card>

      <div className="mt-4">
        <Button variant="outline" onClick={() => navigate({ to: "/sorteios" })}>
          Voltar para a lista
        </Button>
      </div>
    </>
  );
}

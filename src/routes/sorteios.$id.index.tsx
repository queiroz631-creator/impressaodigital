import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Users, FileText, Ticket, Trophy, Wallet, Gift, Coins, Eye, EyeOff } from "lucide-react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brl } from "@/lib/format";
import { processarCuponsDoSorteio } from "@/lib/sorteios.functions";
import { useIndicadoresSorteio, useSorteio } from "@/modules/sorteios/hooks/useSorteios";
import { IndicadorCard } from "@/modules/sorteios/components/IndicadorCard";
import { NavSorteio } from "@/modules/sorteios/components/NavSorteio";
import { SeletorHojeTodos, type ModoData } from "@/modules/sorteios/components/SeletorHojeTodos";
import {
  SeletorParticipantes,
  type ModoParticipantes,
} from "@/modules/sorteios/components/SeletorParticipantes";

import { ROTULO_STATUS_NOTA, ROTULO_STATUS_CUPOM } from "@/modules/sorteios/types";

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
  const [modoData, setModoData] = useState<ModoData>("HOJE");
  const [modoParticipantes, setModoParticipantes] = useState<ModoParticipantes>("CONCORREM");
  const [mostrarValorNotas, setMostrarValorNotas] = useState(false);
  const { data: indicadores } = useIndicadoresSorteio(id, modoData, modoParticipantes);
  const processarCupons = useServerFn(processarCuponsDoSorteio);

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

  return (
    <>
      <PageHeader titulo={sorteio.nome} subtitulo={`Sorteio nº ${sorteio.numero_sorteio}`} />
      <NavSorteio id={id} />

      <SeletorHojeTodos modo={modoData} onChange={setModoData} />
      <SeletorParticipantes modo={modoParticipantes} onChange={setModoParticipantes} />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <IndicadorCard
          titulo={modoData === "HOJE" ? "Participantes hoje" : "Participantes"}
          valor={indicadores?.participantes ?? 0}
          icone={<Users className="h-5 w-5" />}
        />
        <IndicadorCard
          titulo={modoData === "HOJE" ? "Notas hoje" : "Notas"}
          valor={indicadores?.notas ?? 0}
          icone={<FileText className="h-5 w-5" />}
          descricao={
            indicadores
              ? `${indicadores.porStatusNota.VALIDA} ${ROTULO_STATUS_NOTA.VALIDA.toLowerCase()}(s) · ${indicadores.porStatusNota.PENDENTE} ${ROTULO_STATUS_NOTA.PENDENTE.toLowerCase()}(s)`
              : undefined
          }
        />
        <IndicadorCard
          titulo={modoData === "HOJE" ? "Cupons hoje" : "Cupons"}
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
          valor={mostrarValorNotas ? brl((indicadores?.valorValidoCentavos ?? 0) / 100) : "R$ ••••••"}
          icone={<Wallet className="h-5 w-5" />}
          acao={
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={mostrarValorNotas ? "Ocultar valor em notas válidas" : "Mostrar valor em notas válidas"}
              title={mostrarValorNotas ? "Ocultar valor" : "Mostrar valor"}
              onClick={() => setMostrarValorNotas((atual) => !atual)}
            >
              {mostrarValorNotas ? <EyeOff /> : <Eye />}
            </Button>
          }
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

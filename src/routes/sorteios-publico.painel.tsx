import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Info, Receipt, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginaPrivada } from "@/modules/sorteios/components/publico/PaginaPrivada";
import { obterPainelParticipante } from "@/lib/sorteios-publico.functions";
import { brl, dataBR } from "@/lib/format";

const META_PRIVADA = [
  { title: "Meu painel | Portal de Sorteios" },
  { name: "robots", content: "noindex, nofollow" },
];

export const Route = createFileRoute("/sorteios-publico/painel")({
  component: PainelPortal,
  head: () => ({ meta: META_PRIVADA }),
});

function PainelPortal() {
  const painelFn = useServerFn(obterPainelParticipante);
  const painel = useQuery({
    queryKey: ["portal-painel"],
    queryFn: () => painelFn({}),
    retry: false,
  });

  return (
    <PaginaPrivada titulo="Meu painel">
      {(contexto) => (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Olá,</p>
              <p className="text-lg font-semibold">{contexto.nome}</p>
            </CardContent>
          </Card>

          {!painel.data ? (
            <Skeleton className="h-40 w-full" />
          ) : !painel.data.ok ? (
            <p className="text-sm text-muted-foreground">{painel.data.mensagem}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Resumo rotulo="Notas registradas" valor={String(painel.data.dados.total_notas)} />
                <Resumo rotulo="Em análise" valor={String(painel.data.dados.notas_pendentes)} />
                <Resumo rotulo="Cupons ativos" valor={String(painel.data.dados.total_cupons)} />
                <Resumo
                  rotulo="Saldo acumulado"
                  valor={brl(painel.data.dados.saldo_centavos / 100)}
                />
              </div>

              {painel.data.dados.acoesBloqueadas ? (
                <p className="text-sm text-muted-foreground text-center">
                  Este sorteio não está recebendo novas notas no momento.
                </p>
              ) : (
                <Button asChild className="w-full h-12 text-base">
                  <Link to="/sorteios-publico/notas">Registrar nota</Link>
                </Button>
              )}

              <div className="grid gap-2">
                <AtalhoLink to="/sorteios-publico/notas" Icone={Receipt} rotulo="Minhas notas" />
                <AtalhoLink to="/sorteios-publico/cupons" Icone={Ticket} rotulo="Meus cupons" />
                <AtalhoLink
                  to="/sorteios-publico/informacoes"
                  Icone={Info}
                  rotulo="Informações do sorteio"
                />
              </div>

              <Card>
                <CardContent className="pt-6 space-y-1 text-sm">
                  <p className="font-semibold text-foreground">
                    Sorteio nº {painel.data.dados.sorteio.numero_sorteio} —{" "}
                    {painel.data.dados.sorteio.nome}
                  </p>
                  <p className="text-muted-foreground">
                    Período: {dataBR(painel.data.dados.sorteio.data_inicio)} a{" "}
                    {dataBR(painel.data.dados.sorteio.data_fim)}
                  </p>
                  <p className="text-muted-foreground">
                    Sorteio em {dataBR(painel.data.dados.sorteio.data_sorteio)}
                  </p>
                  <p className="text-muted-foreground">
                    Cada {brl(painel.data.dados.sorteio.valor_por_cupom_centavos / 100)} em compras
                    dá direito a 1 cupom.
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </PaginaPrivada>
  );
}

function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{rotulo}</p>
        <p className="text-2xl font-bold text-foreground">{valor}</p>
      </CardContent>
    </Card>
  );
}

function AtalhoLink({ to, rotulo, Icone }: { to: string; rotulo: string; Icone: typeof Receipt }) {
  return (
    <Button asChild variant="outline" className="w-full h-12 justify-start text-base">
      <Link to={to}>
        <Icone className="h-5 w-5" />
        {rotulo}
      </Link>
    </Button>
  );
}

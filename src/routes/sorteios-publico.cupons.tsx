import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginaPrivada } from "@/modules/sorteios/components/publico/PaginaPrivada";
import { listarMeusCupons } from "@/lib/sorteios-publico.functions";
import { dataHoraBR } from "@/lib/format";

const META_PRIVADA = [
  { title: "Meus cupons | Portal de Sorteios" },
  { name: "robots", content: "noindex, nofollow" },
];

export const Route = createFileRoute("/sorteios-publico/cupons")({
  component: CuponsPortal,
  head: () => ({ meta: META_PRIVADA }),
});

function CuponsPortal() {
  const listarFn = useServerFn(listarMeusCupons);
  const cupons = useQuery({
    queryKey: ["portal-cupons"],
    queryFn: () => listarFn({}),
    retry: false,
  });

  return (
    <PaginaPrivada
      titulo="Meus cupons"
      subtitulo="Seus cupons são gerados após a análise das notas."
    >
      {() =>
        !cupons.data ? (
          <Skeleton className="h-32 w-full" />
        ) : !cupons.data.ok ? (
          <p className="text-sm text-muted-foreground">{cupons.data.mensagem}</p>
        ) : cupons.data.dados.cupons.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Você ainda não possui cupons neste sorteio.
          </p>
        ) : (
          <div className="space-y-3">
            {cupons.data.dados.cupons.map((cupom) => (
              <Card key={cupom.id}>
                <CardContent className="pt-6 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-lg font-semibold truncate">{cupom.numero}</p>
                    <p className="text-xs text-muted-foreground">{dataHoraBR(cupom.gerado_em)}</p>
                  </div>
                  {cupom.status === "CANCELADO" ? (
                    <Badge variant="outline">Cancelado</Badge>
                  ) : cupom.status === "UTILIZADO" ? (
                    <Badge variant="secondary">Utilizado</Badge>
                  ) : (
                    <Badge>Ativo</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )
      }
    </PaginaPrivada>
  );
}

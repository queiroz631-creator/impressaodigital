import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, Gift } from "lucide-react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { brl, dataBR } from "@/lib/format";
import { useListaSorteios } from "@/modules/sorteios/hooks/useSorteios";
import { StatusSorteioBadge } from "@/modules/sorteios/components/StatusSorteioBadge";
import { somenteConsulta } from "@/modules/sorteios/services/status";

export const Route = createFileRoute("/sorteios/")({
  component: () => (
    <AppLayout permissao="sorteios.visualizar">
      <ListaSorteios />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Sorteios | Calculadora de Impressão Digital" },
      {
        name: "description",
        content:
          "Administre campanhas de sorteio: situação, período, valor por cupom, participantes, notas e cupons.",
      },
      { property: "og:title", content: "Sorteios | Calculadora de Impressão Digital" },
      {
        property: "og:description",
        content: "Administração das campanhas de sorteio da loja.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ListaSorteios() {
  const navigate = useNavigate();
  const { data: sorteios, isLoading, error } = useListaSorteios();

  return (
    <>
      <PageHeader titulo="Sorteios" subtitulo="Campanhas de sorteio da loja" />

      <div className="mb-4 flex justify-end">
        <Button onClick={() => navigate({ to: "/sorteios/novo" })}>
          <Plus className="mr-2 h-4 w-4" /> Novo sorteio
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {!isLoading && (sorteios?.length ?? 0) === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Gift className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Nenhum sorteio cadastrado</p>
            <p className="text-sm text-muted-foreground">
              Crie o primeiro sorteio para começar a cadastrar termos e prêmios.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {(sorteios ?? []).map((s) => (
          <Card key={s.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Nº {s.numero_sorteio}
                  </span>
                  <span className="truncate font-semibold">{s.nome}</span>
                  <StatusSorteioBadge status={s.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {dataBR(s.data_inicio)} a {dataBR(s.data_fim)} · sorteio em{" "}
                  {dataBR(s.data_sorteio)} · {brl(s.valor_por_cupom_centavos / 100)} por cupom
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.participantes} participante(s) · {s.notas} nota(s) · {s.cupons} cupom(ns)
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/sorteios/$id" params={{ id: s.id }}>
                    Abrir
                  </Link>
                </Button>
                {!somenteConsulta(s.status) && (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/sorteios/$id/editar" params={{ id: s.id }}>
                      Editar
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useSorteio } from "@/modules/sorteios/hooks/useSorteios";
import { NavSorteio } from "@/modules/sorteios/components/NavSorteio";
import { PainelSortear } from "@/modules/sorteios/components/PainelSortear";

export const Route = createFileRoute("/sorteios/$id/sortear")({
  component: () => (
    <AppLayout permissao="sorteios.visualizar">
      <SortearSorteio />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Sortear | Calculadora de Impressão Digital" },
      {
        name: "description",
        content:
          "Apuração do cupom vencedor do sorteio, com prêmios, sorteio no servidor e histórico de ganhadores.",
      },
      { property: "og:title", content: "Sortear | Calculadora de Impressão Digital" },
      {
        property: "og:description",
        content: "Apuração dos prêmios e registro dos ganhadores da campanha de sorteio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SortearSorteio() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: sorteio, isLoading, error } = useSorteio(id);

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!sorteio) return null;

  return (
    <>
      <PageHeader titulo={sorteio.nome} subtitulo={`Sorteio nº ${sorteio.numero_sorteio}`} />
      <NavSorteio id={id} />

      <PainelSortear sorteio={sorteio} />

      <div className="mt-4">
        <Button
          variant="outline"
          onClick={() => navigate({ to: "/sorteios/$id", params: { id } })}
        >
          Voltar para o painel
        </Button>
      </div>
    </>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useSorteio } from "@/modules/sorteios/hooks/useSorteios";
import { NavSorteio } from "@/modules/sorteios/components/NavSorteio";
import { ConferenciaEncerramento } from "@/modules/sorteios/components/ConferenciaEncerramento";

export const Route = createFileRoute("/sorteios/$id/encerramento")({
  component: () => (
    <AppLayout permissao="sorteios.visualizar">
      <EncerramentoSorteio />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Encerramento do sorteio | Calculadora de Impressão Digital" },
      {
        name: "description",
        content: "Conferência da base do sorteio antes do encerramento, com pendências e retrato congelado.",
      },
      { property: "og:title", content: "Encerramento do sorteio | Calculadora de Impressão Digital" },
      { property: "og:description", content: "Conferência e encerramento da campanha de sorteio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function EncerramentoSorteio() {
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

      {sorteio.status === "ATIVO" || sorteio.status === "ENCERRADO" ? (
        <ConferenciaEncerramento sorteio={sorteio} />
      ) : (
        <p className="text-sm text-muted-foreground">
          A conferência de encerramento está disponível apenas enquanto o sorteio está ativo ou
          depois de encerrado.
        </p>
      )}

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

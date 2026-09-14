import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { atualizarSorteio } from "@/lib/sorteios.functions";
import { FormularioSorteio } from "@/modules/sorteios/components/FormularioSorteio";
import { NavSorteio } from "@/modules/sorteios/components/NavSorteio";
import { useSorteio } from "@/modules/sorteios/hooks/useSorteios";
import { podeEditarCriticos, somenteConsulta } from "@/modules/sorteios/services/status";
import type { DadosSorteio } from "@/modules/sorteios/validations/sorteio";

export const Route = createFileRoute("/sorteios/$id/editar")({
  component: () => (
    <AppLayout permissao="sorteios.visualizar">
      <EditarSorteio />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Editar sorteio | Calculadora de Impressão Digital" },
      {
        name: "description",
        content: "Altere os dados da campanha de sorteio respeitando a proteção de dados críticos.",
      },
      { property: "og:title", content: "Editar sorteio | Calculadora de Impressão Digital" },
      { property: "og:description", content: "Edição de campanha de sorteio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function EditarSorteio() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: sorteio, isLoading, error } = useSorteio(id);
  const atualizar = useServerFn(atualizarSorteio);

  const mutation = useMutation({
    mutationFn: (dados: DadosSorteio) => atualizar({ data: { id, dados } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sorteio", id] });
      qc.invalidateQueries({ queryKey: ["sorteios"] });
      toast.success("Sorteio atualizado.");
      navigate({ to: "/sorteios/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!sorteio) return null;

  const movimentacoes = sorteio.participantes + sorteio.notas + sorteio.cupons;
  const bloqueado = !podeEditarCriticos(sorteio.status, movimentacoes);

  return (
    <>
      <PageHeader titulo="Editar sorteio" subtitulo={`Sorteio nº ${sorteio.numero_sorteio}`} />
      <NavSorteio id={id} />

      {somenteConsulta(sorteio.status) ? (
        <p className="text-sm text-muted-foreground">
          Este sorteio está somente para consulta e não pode ser alterado.
        </p>
      ) : (
        <FormularioSorteio
          sorteio={sorteio}
          criticosBloqueados={bloqueado}
          salvando={mutation.isPending}
          onSalvar={(dados) => mutation.mutate(dados)}
          onCancelar={() => navigate({ to: "/sorteios/$id", params: { id } })}
        />
      )}
    </>
  );
}

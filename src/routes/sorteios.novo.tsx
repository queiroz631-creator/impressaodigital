import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { criarSorteio } from "@/lib/sorteios.functions";
import { FormularioSorteio } from "@/modules/sorteios/components/FormularioSorteio";
import type { DadosSorteio } from "@/modules/sorteios/validations/sorteio";

export const Route = createFileRoute("/sorteios/novo")({
  component: () => (
    <AppLayout permissao="sorteios.visualizar">
      <NovoSorteio />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Novo sorteio | Calculadora de Impressão Digital" },
      {
        name: "description",
        content: "Cadastre um novo sorteio com período, valor por cupom e limite de cupons.",
      },
      { property: "og:title", content: "Novo sorteio | Calculadora de Impressão Digital" },
      { property: "og:description", content: "Cadastro de campanha de sorteio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function NovoSorteio() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const criar = useServerFn(criarSorteio);

  const mutation = useMutation({
    mutationFn: (dados: DadosSorteio) => criar({ data: dados }),
    onSuccess: (resultado) => {
      qc.invalidateQueries({ queryKey: ["sorteios"] });
      toast.success("Sorteio criado como rascunho.");
      navigate({ to: "/sorteios/$id", params: { id: resultado.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader titulo="Novo sorteio" subtitulo="O sorteio começa como rascunho" />
      <FormularioSorteio
        salvando={mutation.isPending}
        onSalvar={(dados) => mutation.mutate(dados)}
        onCancelar={() => navigate({ to: "/sorteios" })}
      />
    </>
  );
}

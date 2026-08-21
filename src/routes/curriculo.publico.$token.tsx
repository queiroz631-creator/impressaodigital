import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

import { FormularioCurriculo } from "@/components/curriculo/FormularioCurriculo";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { carregarCurriculoPublico, salvarCurriculoPublico } from "@/lib/curriculo.functions";
import type { CurriculoCompleto, PayloadEtapa } from "@/lib/curriculo";

export const Route = createFileRoute("/curriculo/publico/$token")({
  head: () => ({
    meta: [
      { title: "Preencha seu currículo" },
      { name: "description", content: "Preencha os dados do seu currículo profissional em poucos passos." },
      { property: "og:title", content: "Preencha seu currículo" },
      { property: "og:description", content: "Formulário rápido para montar o seu currículo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CurriculoPublico,
});

function CurriculoPublico() {
  const { token } = Route.useParams();
  const carregar = useServerFn(carregarCurriculoPublico);
  const salvar = useServerFn(salvarCurriculoPublico);
  const [concluido, setConcluido] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["curriculo-publico", token],
    retry: false,
    queryFn: () => carregar({ data: { token } }),
  });

  const conteudo = () => {
    if (isLoading) return <Skeleton className="h-72 w-full" />;

    if (error || !data) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="font-medium">Este link expirou. Solicite um novo link ao atendimento.</p>
          </CardContent>
        </Card>
      );
    }

    if (concluido) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <p className="text-lg font-semibold">Currículo enviado com sucesso!</p>
            <p className="text-sm text-muted-foreground">
              Obrigado. Nossa equipe já pode preparar a impressão do seu currículo.
            </p>
          </CardContent>
        </Card>
      );
    }

    const dados: CurriculoCompleto = {
      curriculo: data.curriculo as CurriculoCompleto["curriculo"],
      telefones: data.telefones,
      cursos: data.cursos,
      experiencias: data.experiencias,
      habilidades: data.habilidades,
    };

    return (
      <FormularioCurriculo
        dados={dados}
        catalogoHabilidades={data.catalogoHabilidades}
        objetivosSugeridos={data.objetivosSugeridos}
        modo="publico"
        salvar={async (payload: PayloadEtapa) => {
          await salvar({ data: { token, payload } });
        }}
        onFinalizado={() => setConcluido(true)}
      />
    );
  };

  return (
    <div className="min-h-screen bg-muted/40 py-8">
      <div className="mx-auto w-full max-w-3xl px-4">
        <header className="mb-6 text-center">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">
            {data?.empresaNome ?? ""}
          </p>
          <h1 className="text-2xl font-extrabold">Preencha seu currículo</h1>
        </header>
        {conteudo()}
      </div>
    </div>
  );
}

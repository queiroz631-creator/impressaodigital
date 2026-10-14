import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import ExecucoesPainel from "@/modules/agentes/ExecucoesPainel";

export const Route = createFileRoute("/agentes/execucoes")({
  component: () => (
    <AppLayout permissao="agentes.visualizar">
      <ExecucoesPainel />
    </AppLayout>
  ),
  head: () => ({
    meta: [{ title: "Execuções dos agentes | Calculadora de Impressão Digital" }],
  }),
});

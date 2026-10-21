import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import AutomacoesPainel from "@/modules/agentes/AutomacoesPainel";

export const Route = createFileRoute("/agentes/automacoes")({
  component: () => (
    <AppLayout permissao="agentes.visualizar">
      <AutomacoesPainel />
    </AppLayout>
  ),
  head: () => ({
    meta: [{ title: "Automações dos agentes | Calculadora de Impressão Digital" }],
  }),
});

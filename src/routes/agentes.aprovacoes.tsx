import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import AprovacoesPainel from "@/modules/agentes/AprovacoesPainel";

export const Route = createFileRoute("/agentes/aprovacoes")({
  component: () => (
    <AppLayout permissao="agentes.visualizar">
      <AprovacoesPainel />
    </AppLayout>
  ),
  head: () => ({
    meta: [{ title: "Aprovações | Calculadora de Impressão Digital" }],
  }),
});

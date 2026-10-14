import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import FerramentasPainel from "@/modules/agentes/FerramentasPainel";

export const Route = createFileRoute("/agentes/ferramentas")({
  component: () => (
    <AppLayout permissao="agentes.visualizar">
      <FerramentasPainel />
    </AppLayout>
  ),
  head: () => ({
    meta: [{ title: "Ferramentas dos agentes | Calculadora de Impressão Digital" }],
  }),
});

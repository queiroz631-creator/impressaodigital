import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import MonitoramentoPainel from "@/modules/agentes/MonitoramentoPainel";

export const Route = createFileRoute("/agentes/monitoramento")({
  component: () => (
    <AppLayout permissao="agentes.visualizar">
      <MonitoramentoPainel />
    </AppLayout>
  ),
  head: () => ({
    meta: [{ title: "Monitoramento dos agentes | Calculadora de Impressão Digital" }],
  }),
});

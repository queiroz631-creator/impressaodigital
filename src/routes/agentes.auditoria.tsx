import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import AuditoriaPainel from "@/modules/agentes/AuditoriaPainel";

export const Route = createFileRoute("/agentes/auditoria")({
  component: () => (
    <AppLayout permissao="agentes.visualizar">
      <AuditoriaPainel />
    </AppLayout>
  ),
  head: () => ({
    meta: [{ title: "Auditoria dos agentes | Calculadora de Impressão Digital" }],
  }),
});

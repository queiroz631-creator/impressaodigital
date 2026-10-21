import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/agentes")({
  component: () => (
    <AppLayout permissao="agentes.visualizar">
      <Outlet />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Central de Agentes | Calculadora de Impressão Digital" },
      {
        name: "description",
        content:
          "Cadastre e gerencie agentes de IA, ferramentas autorizadas, execuções, aprovações e auditoria.",
      },
      { property: "og:title", content: "Central de Agentes | Calculadora de Impressão Digital" },
      {
        property: "og:description",
        content: "Central de Agentes de IA do sistema de impressão digital.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import ConfiguracoesPainel from "@/modules/agentes/ConfiguracoesPainel";

export const Route = createFileRoute("/agentes/configuracoes")({
  component: () => (
    <AppLayout permissao="agentes.gerenciar">
      <ConfiguracoesPainel />
    </AppLayout>
  ),
  head: () => ({
    meta: [{ title: "Configurações da Central | Calculadora de Impressão Digital" }],
  }),
});
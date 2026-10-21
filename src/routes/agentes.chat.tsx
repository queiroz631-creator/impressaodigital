import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import ChatOperacional from "@/modules/agentes/ChatOperacional";

export const Route = createFileRoute("/agentes/chat")({
  component: () => (
    <AppLayout permissao="agentes.executar">
      <ChatOperacional />
    </AppLayout>
  ),
  head: () => ({
    meta: [{ title: "Chat do Agente Operacional | Calculadora de Impressão Digital" }],
  }),
});
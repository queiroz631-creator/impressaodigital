import { createFileRoute } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import ConexoesPainel from "@/modules/comunicacao/conexoes/ConexoesPainel";

export const Route = createFileRoute("/conexoes")({
  component: () => (
    <AppLayout permissao="conexoes.gerenciar">
      <Conexoes />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Conexões de WhatsApp | Calculadora de Impressão Digital" },
      {
        name: "description",
        content:
          "Cadastre e gerencie várias conexões de WhatsApp independentes, com número, credenciais e bot próprios.",
      },
      { property: "og:title", content: "Conexões de WhatsApp | Calculadora de Impressão Digital" },
      {
        property: "og:description",
        content: "Conexões de WhatsApp independentes, cada uma com seu número e seu bot.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Conexoes() {
  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Conexões de WhatsApp"
        descricao="Números independentes, cada um com credenciais e bot próprios."
      />
      <ConexoesPainel />
    </div>
  );
}

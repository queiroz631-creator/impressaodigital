import { createFileRoute } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { ConfiguracaoBot } from "@/components/ConfiguracaoBot";

export const Route = createFileRoute("/bot")({
  component: () => (
    <AppLayout>
      <PageHeader
        titulo="CONFIGURAÇÃO DO BOT"
        subtitulo="Atendimento automático do WhatsApp: horários, menu, respostas e mensagens."
      />
      <ConfiguracaoBot />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Configuração do Bot | Impressão Digital" },
      {
        name: "description",
        content: "Configure o atendimento automático do WhatsApp: horários, menu, palavras-chave e mensagens.",
      },
      { property: "og:title", content: "Configuração do Bot | Impressão Digital" },
      { property: "og:description", content: "Atendimento automático do WhatsApp da gráfica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

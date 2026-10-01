import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { TrabalhosPagina } from "@/modules/foto-express/paginas/TrabalhosPagina";

export const Route = createFileRoute("/foto-express/")({
  component: () => <AppLayout permissao="foto_express.visualizar"><TrabalhosPagina /></AppLayout>,
  head: () => ({ meta: [
    { title: "FOTO EXPRESS — Trabalhos | Impressão Digital" },
    { name: "description", content: "Gerencie trabalhos e fotos para impressão no FOTO EXPRESS." },
    { property: "og:title", content: "FOTO EXPRESS — Trabalhos | Impressão Digital" },
    { property: "og:description", content: "Trabalhos de fotos para impressão." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});
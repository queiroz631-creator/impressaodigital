import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { TrabalhosPagina } from "@/modules/foto-express/paginas/TrabalhosPagina";

export const Route = createFileRoute("/foto-express/")({
  component: () => <AppLayout permissao="foto_express.visualizar"><TrabalhosPagina /></AppLayout>,
  head: () => ({ meta: [
    { title: "FOTO EXPRESS — Álbuns | Impressão Digital" },
    { name: "description", content: "Gerencie álbuns e fotos para impressão no FOTO EXPRESS." },
    { property: "og:title", content: "FOTO EXPRESS — Álbuns | Impressão Digital" },
    { property: "og:description", content: "Álbuns de fotos para impressão." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});
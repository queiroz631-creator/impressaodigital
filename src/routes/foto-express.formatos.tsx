import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { FormatosPagina } from "@/modules/foto-express/paginas/FormatosPagina";

export const Route = createFileRoute("/foto-express/formatos")({
  component: () => <AppLayout permissao="foto_express.visualizar"><FormatosPagina /></AppLayout>,
  head: () => ({ meta: [
    { title: "Formatos | FOTO EXPRESS" },
    { name: "description", content: "Cadastre e organize os formatos de impressão de fotos." },
    { property: "og:title", content: "Formatos | FOTO EXPRESS" },
    { property: "og:description", content: "Formatos disponíveis para impressão fotográfica." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});
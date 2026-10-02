import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { PapeisPagina } from "@/modules/foto-express/paginas/PapeisPagina";

export const Route = createFileRoute("/foto-express/papeis")({
  component: () => <AppLayout permissao="foto_express.visualizar"><PapeisPagina /></AppLayout>,
  head: () => ({ meta: [
    { title: "Papéis | FOTO EXPRESS" },
    { name: "description", content: "Cadastre os papéis usados na montagem de fotos." },
    { property: "og:title", content: "Papéis | FOTO EXPRESS" },
    { property: "og:description", content: "Configurações reutilizáveis de papel para montagem fotográfica." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});
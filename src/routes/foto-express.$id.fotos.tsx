import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { GaleriaPagina } from "@/modules/foto-express/paginas/GaleriaPagina";

export const Route = createFileRoute("/foto-express/$id/fotos")({
  component: Pagina,
  head: () => ({ meta: [
    { title: "Fotos do trabalho | FOTO EXPRESS" },
    { name: "description", content: "Envie, selecione e configure fotos do trabalho." },
    { property: "og:title", content: "Fotos do trabalho | FOTO EXPRESS" },
    { property: "og:description", content: "Galeria do trabalho de impressão fotográfica." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

function Pagina() {
  const { id } = Route.useParams();
  return <AppLayout permissao="foto_express.visualizar"><GaleriaPagina trabalhoId={id} /></AppLayout>;
}
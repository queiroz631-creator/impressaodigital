import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { RevisaoPagina } from "@/modules/foto-express/revisao/RevisaoPagina";

export const Route = createFileRoute("/foto-express/$id/revisao")({
  component: Pagina,
  head: () => ({ meta: [
    { title: "Revisão e montagem | FOTO EXPRESS" },
    { name: "description", content: "Revise as fotos e organize automaticamente as folhas de impressão." },
    { property: "og:title", content: "Revisão e montagem | FOTO EXPRESS" },
    { property: "og:description", content: "Conferência e montagem de folhas do trabalho fotográfico." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});
function Pagina() { const { id } = Route.useParams(); return <AppLayout permissao="foto_express.visualizar"><RevisaoPagina trabalhoId={id} /></AppLayout>; }
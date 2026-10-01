import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { EditorFotoPagina } from "@/modules/foto-express/editor/EditorFotoPagina";

export const Route = createFileRoute("/foto-express/$trabalhoId/fotos/$itemId/editar")({
  component: Pagina,
  head: () => ({ meta: [
    { title: "Editar foto | FOTO EXPRESS" },
    { name: "description", content: "Editor não destrutivo de foto do FOTO EXPRESS." },
    { property: "og:title", content: "Editar foto | FOTO EXPRESS" },
    { property: "og:description", content: "Ajuste o enquadramento da foto sem modificar o original." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

function Pagina() {
  const { trabalhoId, itemId } = Route.useParams();
  return <AppLayout permissao="foto_express.visualizar"><EditorFotoPagina trabalhoId={trabalhoId} itemId={itemId} /></AppLayout>;
}
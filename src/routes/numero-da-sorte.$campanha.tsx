import { createFileRoute } from "@tanstack/react-router";
import { PaginaPublicaNumeroSorte } from "@/modules/numero-sorte/publico/PaginaPublicaNumeroSorte";

export const Route = createFileRoute("/numero-da-sorte/$campanha")({
  component: function Pagina() {
    const { campanha } = Route.useParams();
    return <PaginaPublicaNumeroSorte numero={campanha} />;
  },
  head: () => ({
    meta: [
      { title: "Nº da Sorte | Queiroz Papelaria" },
      { name: "description", content: "Participe da campanha Nº da Sorte e descubra se seu número foi premiado." },
      { property: "og:title", content: "Nº da Sorte | Queiroz Papelaria" },
      { property: "og:description", content: "Informe seu número da sorte e veja se você ganhou." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

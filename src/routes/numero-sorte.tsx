import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { NumeroSortePagina } from "@/modules/numero-sorte/paginas/NumeroSortePagina";

export const Route = createFileRoute("/numero-sorte")({
  component: () => (
    <AppLayout permissao="numero_sorte.visualizar">
      <NumeroSortePagina />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Nº da Sorte | Calculadora de Impressão Digital" },
      { name: "description", content: "Campanhas de números premiados: campanhas, prêmios e números gerados." },
      { property: "og:title", content: "Nº da Sorte | Calculadora de Impressão Digital" },
      { property: "og:description", content: "Gestão das campanhas Nº da Sorte da loja." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

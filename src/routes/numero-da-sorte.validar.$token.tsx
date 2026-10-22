import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { RetiradaPainel } from "@/modules/numero-sorte/retirada/RetiradaPainel";

function Pagina() {
  const { token } = Route.useParams();
  const { data: campanhas = [] } = useQuery({
    queryKey: ["ns-campanhas-retirada"],
    queryFn: async () => (await supabase.from("numero_sorte_campanhas").select("id, numero, nome").order("numero", { ascending: false })).data ?? [],
  });
  return (
    <AppLayout permissao="numero_sorte.retiradas.validar">
      <PageHeader titulo="Retirada de prêmio" subtitulo="Nº da Sorte" />
      <RetiradaPainel campanhas={campanhas} tokenInicial={token} />
    </AppLayout>
  );
}

// Abrir este link nunca entrega o prêmio: exige login, permissão e confirmação.
export const Route = createFileRoute("/numero-da-sorte/validar/$token")({
  ssr: false,
  component: Pagina,
  head: () => ({
    meta: [
      { title: "Validar retirada | Nº da Sorte" },
      { name: "description", content: "Validação de comprovante de prêmio do Nº da Sorte pela equipe da loja." },
      { property: "og:title", content: "Validar retirada | Nº da Sorte" },
      { property: "og:description", content: "Área restrita da equipe da loja." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

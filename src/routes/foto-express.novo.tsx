import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { NovoTrabalhoPagina } from "@/modules/foto-express/paginas/NovoTrabalhoPagina";

export const Route = createFileRoute("/foto-express/novo")({
  component: () => <AppLayout permissao="foto_express.trabalhos.criar"><NovoTrabalhoPagina /></AppLayout>,
  head: () => ({ meta: [
    { title: "Novo álbum | FOTO EXPRESS" },
    { name: "description", content: "Crie um novo álbum e envie fotos para impressão." },
    { property: "og:title", content: "Novo álbum | FOTO EXPRESS" },
    { property: "og:description", content: "Criação de álbum de fotos para impressão." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});
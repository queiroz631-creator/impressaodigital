import { createFileRoute } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsuariosPainel } from "@/components/usuarios/UsuariosPainel";
import { PerfisPainel } from "@/components/usuarios/PerfisPainel";

export const Route = createFileRoute("/usuarios")({
  component: () => (
    <AppLayout permissao="usuarios.visualizar">
      <Usuarios />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Usuários e Perfis | Calculadora de Impressão Digital" },
      {
        name: "description",
        content:
          "Gerencie atendentes, perfis de acesso e permissões por módulo do sistema de impressão.",
      },
      { property: "og:title", content: "Usuários e Perfis | Calculadora de Impressão Digital" },
      {
        property: "og:description",
        content: "Controle de usuários, perfis de acesso e permissões por módulo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Usuarios() {
  return (
    <>
      <PageHeader
        titulo="Usuários"
        subtitulo="Atendentes, perfis de acesso e permissões por módulo"
      />

      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="perfis">Perfis</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-4">
          <UsuariosPainel />
        </TabsContent>

        <TabsContent value="perfis" className="mt-4">
          <PerfisPainel />
        </TabsContent>
      </Tabs>
    </>
  );
}

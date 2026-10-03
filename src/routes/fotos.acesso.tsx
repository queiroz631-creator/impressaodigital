import { createFileRoute } from "@tanstack/react-router";
import { LayoutPortalFotos } from "@/modules/foto-express/portal/LayoutPortalFotos";
import { FormularioAcessoFotos } from "@/modules/foto-express/portal/FormularioAcessoFotos";
import { META_FOTOS_PRIVADA } from "@/modules/foto-express/portal/meta";
export const Route=createFileRoute("/fotos/acesso")({component:Acesso,head:()=>({meta:META_FOTOS_PRIVADA})});
function Acesso(){return <LayoutPortalFotos><main className="mx-auto grid min-h-[calc(100dvh-65px)] max-w-5xl place-items-center px-4 py-10"><div className="w-full max-w-md"><div className="mb-6 text-center"><p className="text-sm font-semibold uppercase text-primary">Portal de Fotos</p><h1 className="mt-2 font-serif text-4xl">Entre para começar</h1><p className="mt-2 text-muted-foreground">Use seu CPF e telefone para acessar seus trabalhos.</p></div><FormularioAcessoFotos/></div></main></LayoutPortalFotos>}
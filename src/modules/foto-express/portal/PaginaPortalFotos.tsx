import type { ReactNode } from "react";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Skeleton } from "@/components/ui/skeleton";
import { obterContextoFotos } from "@/lib/foto-express-portal.functions";
import { LayoutPortalFotos } from "./LayoutPortalFotos";

export function PaginaPortalFotos({ children }: { children: (contexto: { nome: string }) => ReactNode }) {
  const navigate = useNavigate(); const buscar = useServerFn(obterContextoFotos);
  const contexto = useQuery({ queryKey: ["foto-portal","contexto"], queryFn: () => buscar({}), retry: false });
  useEffect(() => { if (contexto.data && !contexto.data.ok && contexto.data.codigo === "SESSAO") void navigate({ to: "/fotos/acesso" }); }, [contexto.data, navigate]);
  return <LayoutPortalFotos autenticado><main className="mx-auto min-w-0 max-w-6xl overflow-x-hidden px-3 py-5 sm:px-6 sm:py-7">{contexto.data?.ok ? children(contexto.data.dados) : <div className="space-y-4"><Skeleton className="h-9 w-56"/><Skeleton className="h-48 w-full"/></div>}</main></LayoutPortalFotos>;
}
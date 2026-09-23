import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import logoSorteios from "@/assets/logo-queiroz-sorteios.png.asset.json";
import { logoPortalPublica } from "@/lib/sorteio-logo.functions";
import { NavInferior } from "./NavInferior";

/**
 * Casca visual do portal público do participante — sem nenhum elemento da
 * área administrativa (sem sidebar, menus ou atalhos internos).
 */
export function LayoutPublico({
  children,
  autenticado = false,
  titulo,
  subtitulo,
}: {
  children: ReactNode;
  /** Exibe a navegação inferior (somente telas do participante). */
  autenticado?: boolean;
  titulo?: string | undefined;
  subtitulo?: string | undefined;
}) {
  const { data: logo } = useQuery({
    queryKey: ["sorteios", "logo-portal"],
    queryFn: () => logoPortalPublica(),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="tema-portal-sorteios min-h-screen bg-muted/40 flex flex-col">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto w-full max-w-md px-4 py-5 flex items-center gap-3">
          <img
            src={logo?.url ?? logoSorteios.url}
            alt="Queiroz Papelaria"
            className="h-11 w-11 rounded-full bg-white object-contain"
            onError={(e) => {
              e.currentTarget.src = logoSorteios.url;
            }}
          />
          <div className="min-w-0">
            <p className="font-semibold leading-tight truncate">Portal de Sorteios</p>
            <p className="text-xs opacity-80">Queiroz Papelaria</p>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full mx-auto max-w-md px-4 py-6 pb-28">
        {(titulo || subtitulo) && (
          <div className="mb-4">
            {titulo && <h1 className="text-xl font-bold text-foreground">{titulo}</h1>}
            {subtitulo && <p className="text-sm text-muted-foreground mt-1">{subtitulo}</p>}
          </div>
        )}
        {children}
      </main>

      {autenticado && <NavInferior />}
    </div>
  );
}

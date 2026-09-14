import type { ReactNode } from "react";
import logoImpressao from "@/assets/logo-impressao.png";
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
  return (
    <div className="min-h-screen bg-muted/40 flex flex-col">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto w-full max-w-md px-4 py-5 flex items-center gap-3">
          <img
            src={logoImpressao}
            alt="Queiroz Papelaria"
            className="h-10 w-10 rounded-full bg-primary-foreground object-contain"
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

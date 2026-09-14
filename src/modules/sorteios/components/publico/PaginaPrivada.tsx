import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutPublico } from "./LayoutPublico";
import { useContextoPortal } from "@/modules/sorteios/hooks/usePortalParticipante";

/**
 * Envolve as telas do participante: valida a sessão antes de renderizar
 * qualquer dado e aplica o layout público com navegação inferior.
 */
export function PaginaPrivada({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: (contexto: {
    nome: string;
    saldo_centavos: number;
    acoesBloqueadas: boolean;
  }) => ReactNode;
}) {
  const contexto = useContextoPortal();

  if (!contexto.data || !contexto.data.ok) {
    const erro = contexto.data && !contexto.data.ok ? contexto.data : null;
    const redirecionando =
      erro?.codigo === "SESSAO" || erro?.codigo === "SORTEIO_INDISPONIVEL";
    return (
      <LayoutPublico autenticado>
        {erro && !redirecionando ? (
          <p className="text-sm text-muted-foreground">{erro.mensagem}</p>
        ) : (
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        )}
      </LayoutPublico>
    );
  }

  return (
    <LayoutPublico autenticado titulo={titulo} subtitulo={subtitulo}>
      {children(contexto.data.dados)}
    </LayoutPublico>
  );
}

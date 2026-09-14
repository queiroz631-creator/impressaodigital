import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

/** Indicador numérico calculado no banco (zero quando não há dados). */
export function IndicadorCard({
  titulo,
  valor,
  icone,
  descricao,
}: {
  titulo: string;
  valor: ReactNode;
  icone?: ReactNode;
  descricao?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        {icone && <div className="text-primary">{icone}</div>}
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase text-muted-foreground">{titulo}</p>
          <p className="text-xl font-bold">{valor}</p>
          {descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

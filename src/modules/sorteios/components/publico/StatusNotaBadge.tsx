import { Badge } from "@/components/ui/badge";

const ESTILO: Record<
  string,
  { rotulo: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDENTE: { rotulo: "Pendente", variant: "secondary" },
  VALIDA: { rotulo: "Válida", variant: "default" },
  INVALIDA: { rotulo: "Inválida", variant: "destructive" },
  CANCELADA: { rotulo: "Cancelada", variant: "outline" },
};

export function StatusNotaBadge({ status }: { status: string }) {
  const estilo = ESTILO[status] ?? { rotulo: status, variant: "outline" as const };
  return <Badge variant={estilo.variant}>{estilo.rotulo}</Badge>;
}

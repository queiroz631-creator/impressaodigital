import { Badge } from "@/components/ui/badge";

const CINZA = "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300";

const ESTILO: Record<string, { rotulo: string; classes: string }> = {
  PENDENTE: {
    rotulo: "Pendente",
    classes: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  },
  VALIDA: {
    rotulo: "Válida",
    classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  INVALIDA: {
    rotulo: "Inválida",
    classes: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  },
  CANCELADA: { rotulo: "Cancelada", classes: CINZA },
};

/** Selo de situação da nota no portal: verde, vermelho, laranja ou cinza. */
export function StatusNotaBadge({ status }: { status: string }) {
  const estilo = ESTILO[status] ?? { rotulo: status, classes: CINZA };
  return (
    <Badge variant="outline" className={estilo.classes}>
      {estilo.rotulo}
    </Badge>
  );
}

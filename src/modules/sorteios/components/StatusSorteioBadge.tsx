import { Badge } from "@/components/ui/badge";
import { ROTULO_STATUS_SORTEIO, type StatusSorteio } from "../types";

const CLASSES: Record<StatusSorteio, string> = {
  RASCUNHO: "bg-muted text-muted-foreground",
  ATIVO: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  ENCERRADO: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  CANCELADO: "bg-destructive/10 text-destructive",
  SORTEADO: "bg-primary/10 text-primary",
};

/** Selo de situação do sorteio, com as cores do tema. */
export function StatusSorteioBadge({ status }: { status: StatusSorteio }) {
  return (
    <Badge variant="outline" className={CLASSES[status]}>
      {ROTULO_STATUS_SORTEIO[status]}
    </Badge>
  );
}

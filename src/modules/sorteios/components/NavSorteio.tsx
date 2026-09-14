import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const ABAS = [
  { rotulo: "Painel", to: "/sorteios/$id" as const },
  { rotulo: "Termos", to: "/sorteios/$id/termos" as const },
  { rotulo: "Prêmios", to: "/sorteios/$id/premios" as const },
  { rotulo: "Participantes", to: "/sorteios/$id/participantes" as const },
  { rotulo: "Notas", to: "/sorteios/$id/notas" as const },
  { rotulo: "Cupons", to: "/sorteios/$id/cupons" as const },
];

/** Navegação entre as telas de um sorteio. */
export function NavSorteio({ id }: { id: string }) {
  return (
    <nav className="mb-4 flex flex-wrap gap-2 overflow-x-auto">
      {ABAS.map((aba) => (
        <Link
          key={aba.to}
          to={aba.to}
          params={{ id }}
          activeOptions={{ exact: true }}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-accent",
            "data-[status=active]:border-primary data-[status=active]:bg-primary/10 data-[status=active]:text-primary",
          )}
        >
          {aba.rotulo}
        </Link>
      ))}
    </nav>
  );
}

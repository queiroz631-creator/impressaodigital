import { Button } from "@/components/ui/button";

export type ModoData = "HOJE" | "TODOS";

/**
 * Seletor Hoje/Todos no estilo do filtro da tela de Orçamentos:
 * o botão ativo aparece destacado. "Hoje" é o padrão das telas do sorteio.
 */
export function SeletorHojeTodos({
  modo,
  onChange,
}: {
  modo: ModoData;
  onChange: (modo: ModoData) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Button
        size="sm"
        variant={modo === "HOJE" ? "default" : "outline"}
        onClick={() => onChange("HOJE")}
      >
        Hoje
      </Button>
      <Button
        size="sm"
        variant={modo === "TODOS" ? "default" : "outline"}
        onClick={() => onChange("TODOS")}
      >
        Todos
      </Button>
    </div>
  );
}

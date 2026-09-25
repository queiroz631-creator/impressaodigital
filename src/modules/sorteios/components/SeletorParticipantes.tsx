import { Button } from "@/components/ui/button";

export type ModoParticipantes = "CONCORREM" | "TODOS";

export function SeletorParticipantes({
  modo,
  onChange,
}: {
  modo: ModoParticipantes;
  onChange: (modo: ModoParticipantes) => void;
}) {
  return (
    <div className="mb-4 space-y-1">
      <p className="text-xs font-medium text-muted-foreground">Participantes considerados</p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={modo === "CONCORREM" ? "default" : "outline"}
          onClick={() => onChange("CONCORREM")}
        >
          Concorrem
        </Button>
        <Button
          size="sm"
          variant={modo === "TODOS" ? "default" : "outline"}
          onClick={() => onChange("TODOS")}
        >
          Todos os participantes
        </Button>
      </div>
    </div>
  );
}
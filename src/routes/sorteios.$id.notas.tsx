import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brl, dataHoraBR } from "@/lib/format";
import { NavSorteio } from "@/modules/sorteios/components/NavSorteio";
import { useNotasSorteio, useSorteio } from "@/modules/sorteios/hooks/useSorteios";
import { ROTULO_STATUS_NOTA, type StatusNota } from "@/modules/sorteios/types";

export const Route = createFileRoute("/sorteios/$id/notas")({
  component: () => (
    <AppLayout permissao="sorteios.visualizar">
      <NotasSorteio />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Notas do sorteio | Calculadora de Impressão Digital" },
      {
        name: "description",
        content: "Notas cadastradas no sorteio com situação, valores e cupons gerados.",
      },
      { property: "og:title", content: "Notas do sorteio | Calculadora de Impressão Digital" },
      { property: "og:description", content: "Notas registradas na campanha de sorteio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const FILTROS: (StatusNota | "TODAS")[] = ["TODAS", "PENDENTE", "VALIDA", "INVALIDA", "CANCELADA"];

const CLASSE_STATUS: Record<StatusNota, string> = {
  PENDENTE: "bg-muted text-muted-foreground",
  VALIDA: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  INVALIDA: "bg-destructive/10 text-destructive",
  CANCELADA: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
};

function NotasSorteio() {
  const { id } = Route.useParams();
  const { data: sorteio } = useSorteio(id);
  const { data: notas, isLoading } = useNotasSorteio(id);
  const [filtro, setFiltro] = useState<StatusNota | "TODAS">("TODAS");

  const filtradas = useMemo(
    () => (notas ?? []).filter((n) => filtro === "TODAS" || n.status === filtro),
    [notas, filtro],
  );

  return (
    <>
      <PageHeader titulo="Notas" subtitulo={sorteio?.nome} />
      <NavSorteio id={id} />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filtro === f ? "default" : "outline"}
            onClick={() => setFiltro(f)}
          >
            {f === "TODAS" ? "Todas" : ROTULO_STATUS_NOTA[f]}
          </Button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isLoading && filtradas.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {(notas?.length ?? 0) === 0
              ? "Nenhuma nota cadastrada neste sorteio."
              : "Nenhuma nota com esta situação."}
          </CardContent>
        </Card>
      )}

      {filtradas.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participante</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Validação</TableHead>
                  <TableHead className="text-right">Cupons</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">{n.participanteNome}</TableCell>
                    <TableCell>{n.numero}</TableCell>
                    <TableCell className="text-right">{brl(n.valor_centavos / 100)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={CLASSE_STATUS[n.status]}>
                        {ROTULO_STATUS_NOTA[n.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{dataHoraBR(n.cadastrado_em)}</TableCell>
                    <TableCell>{n.validado_em ? dataHoraBR(n.validado_em) : "—"}</TableCell>
                    <TableCell className="text-right">{n.cupons_gerados}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}

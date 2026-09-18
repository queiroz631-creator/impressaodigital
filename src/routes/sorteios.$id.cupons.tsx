import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { useCuponsSorteio, useSorteio } from "@/modules/sorteios/hooks/useSorteios";
import {
  ROTULO_STATUS_CUPOM,
  ROTULO_STATUS_NOTA,
  type StatusCupom,
} from "@/modules/sorteios/types";

export const Route = createFileRoute("/sorteios/$id/cupons")({
  component: () => (
    <AppLayout permissao="sorteios.visualizar">
      <CuponsSorteio />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Cupons do sorteio | Calculadora de Impressão Digital" },
      {
        name: "description",
        content: "Cupons do sorteio com participante, nota de origem, valor base e situação.",
      },
      { property: "og:title", content: "Cupons do sorteio | Calculadora de Impressão Digital" },
      { property: "og:description", content: "Cupons emitidos na campanha de sorteio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const FILTROS: (StatusCupom | "TODOS")[] = ["TODOS", "ATIVO", "CANCELADO", "UTILIZADO"];

const CLASSE_STATUS: Record<StatusCupom, string> = {
  ATIVO: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  CANCELADO: "bg-destructive/10 text-destructive",
  UTILIZADO: "bg-primary/10 text-primary",
};

function semAcento(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function mascararCpf(cpf: string | null) {
  const d = (cpf ?? "").replace(/\D/g, "");
  if (d.length !== 11) return cpf ?? "—";
  return `${d.slice(0, 3)}.***.***-${d.slice(9)}`;
}

function CuponsSorteio() {
  const { id } = Route.useParams();
  const { data: sorteio } = useSorteio(id);
  const { data: cupons, isLoading } = useCuponsSorteio(id);
  const [filtro, setFiltro] = useState<StatusCupom | "TODOS">("TODOS");
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const termo = semAcento(busca.trim());
    const digitos = busca.replace(/\D/g, "");
    return (cupons ?? []).filter((c) => {
      if (filtro !== "TODOS" && c.status !== filtro) return false;
      if (!termo && !digitos) return true;
      const porNome = termo ? semAcento(c.participanteNome).includes(termo) : false;
      const porCpf = digitos
        ? (c.participanteCpf ?? "").replace(/\D/g, "").includes(digitos)
        : false;
      const porCupom = termo ? semAcento(c.numero).includes(termo) : false;
      const porNota = digitos ? c.notaNumero.replace(/\D/g, "").includes(digitos) : false;
      return porNome || porCpf || porCupom || porNota;
    });
  }, [cupons, filtro, busca]);

  return (
    <>
      <PageHeader titulo="Cupons" subtitulo={sorteio?.nome ?? ""} />
      <NavSorteio id={id} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="max-w-sm flex-1 min-w-[220px]">
          <Input
            placeholder="Buscar por cliente, CPF, nº do cupom ou nº da nota"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        {FILTROS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filtro === f ? "default" : "outline"}
            onClick={() => setFiltro(f)}
          >
            {f === "TODOS" ? "Todos" : ROTULO_STATUS_CUPOM[f]}
          </Button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isLoading && filtrados.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {(cupons?.length ?? 0) === 0
              ? "Nenhum cupom neste sorteio."
              : "Nenhum cupom encontrado para esta busca."}
          </CardContent>
        </Card>
      )}

      {filtrados.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Participante</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Nota de origem</TableHead>
                  <TableHead className="text-right">Valor da nota</TableHead>
                  <TableHead className="text-right">Valor base</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Geração</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-medium">{c.numero}</TableCell>
                    <TableCell>{c.participanteNome}</TableCell>
                    <TableCell>{mascararCpf(c.participanteCpf)}</TableCell>
                    <TableCell>
                      <span className="font-mono">{c.notaNumero}</span>
                      {c.notaStatus && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {ROTULO_STATUS_NOTA[c.notaStatus]}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.notaValorCentavos === null ? "—" : brl(c.notaValorCentavos / 100)}
                    </TableCell>
                    <TableCell className="text-right">{brl(c.valor_base_centavos / 100)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={CLASSE_STATUS[c.status]}>
                        {ROTULO_STATUS_CUPOM[c.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{dataHoraBR(c.gerado_em)}</TableCell>
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

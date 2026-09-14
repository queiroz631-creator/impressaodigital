import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { definirElegibilidadeParticipante } from "@/lib/sorteios.functions";
import { NavSorteio } from "@/modules/sorteios/components/NavSorteio";
import { somenteConsulta } from "@/modules/sorteios/services/status";
import { useParticipantesSorteio, useSorteio } from "@/modules/sorteios/hooks/useSorteios";
import { mascararCpf, mascararTelefone } from "@/modules/sorteios/validations/sorteio";


export const Route = createFileRoute("/sorteios/$id/participantes")({
  component: () => (
    <AppLayout permissao="sorteios.visualizar">
      <ParticipantesSorteio />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Participantes do sorteio | Calculadora de Impressão Digital" },
      {
        name: "description",
        content: "Participantes do sorteio com saldo, notas, cupons e situação de sincronização.",
      },
      {
        property: "og:title",
        content: "Participantes do sorteio | Calculadora de Impressão Digital",
      },
      { property: "og:description", content: "Lista de participantes da campanha de sorteio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ROTULO_SINC: Record<string, string> = {
  PENDENTE: "Pendente",
  SINCRONIZADO: "Sincronizado",
  ERRO: "Erro",
};

function semAcento(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function ParticipantesSorteio() {
  const { id } = Route.useParams();
  const { data: sorteio } = useSorteio(id);
  const { data: participantes, isLoading } = useParticipantesSorteio(id);
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const termo = semAcento(busca.trim());
    const digitos = busca.replace(/\D/g, "");
    if (!termo && !digitos) return participantes ?? [];
    return (participantes ?? []).filter((p) => {
      const porNome = termo ? semAcento(p.nome).includes(termo) : false;
      const porCpf = digitos ? (p.cpf ?? "").replace(/\D/g, "").includes(digitos) : false;
      return porNome || porCpf;
    });
  }, [participantes, busca]);

  return (
    <>
      <PageHeader titulo="Participantes" subtitulo={sorteio?.nome ?? ""} />
      <NavSorteio id={id} />

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Buscar por nome ou CPF"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isLoading && filtrados.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {(participantes?.length ?? 0) === 0
              ? "Nenhum participante neste sorteio."
              : "Nenhum participante encontrado para a busca."}
          </CardContent>
        </Card>
      )}

      {filtrados.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participante</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Notas</TableHead>
                  <TableHead className="text-right">Cupons</TableHead>
                  <TableHead>Sincronização</TableHead>
                  <TableHead>Participação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell>{mascararCpf(p.cpf)}</TableCell>
                    <TableCell>{mascararTelefone(p.telefone)}</TableCell>
                    <TableCell className="text-right">{brl(p.saldo_centavos / 100)}</TableCell>
                    <TableCell className="text-right">{p.notas}</TableCell>
                    <TableCell className="text-right">{p.cupons}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ROTULO_SINC[p.sincronizacao_status] ?? p.sincronizacao_status}
                      </Badge>
                    </TableCell>
                    <TableCell>{dataHoraBR(p.criado_em)}</TableCell>
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

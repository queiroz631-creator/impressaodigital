import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dices, Eye, PartyPopper, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { dataHoraBR } from "@/lib/format";
import {
  dadosCompletosGanhador,
  realizarSorteio,
  resumoApuracaoSorteio,
} from "@/lib/sorteios.functions";
import { IndicadorCard } from "./IndicadorCard";
import { RoletaCupons } from "./RoletaCupons";
import type {
  ApuracaoSorteio,
  GanhadorApuracao,
  PremioApuracao,
  ResultadoApuracao,
  Sorteio,
} from "../types";

type Sorteado = Extract<ResultadoApuracao, { resultado: "SORTEADO" }>;

/**
 * Apuração do cupom vencedor.
 *
 * O servidor decide tudo: prêmio, unidade e cupom vencedor vêm da função do
 * banco `sorteio_realizar`, em uma única transação. Esta tela apenas mostra o
 * resumo, dispara a operação e apresenta o resultado já registrado.
 */
export function PainelSortear({ sorteio }: { sorteio: Sorteio }) {
  const qc = useQueryClient();
  const resumir = useServerFn(resumoApuracaoSorteio);
  const sortear = useServerFn(realizarSorteio);

  const [ultimo, setUltimo] = useState<Sorteado | null>(null);
  const [animando, setAnimando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);

  const { data: apuracao, isLoading } = useQuery<ApuracaoSorteio>({
    queryKey: ["sorteio-apuracao", sorteio.id],
    queryFn: () => resumir({ data: { sorteioId: sorteio.id } }) as Promise<ApuracaoSorteio>,
  });

  const mutation = useMutation({
    mutationFn: () => sortear({ data: { sorteioId: sorteio.id } }) as Promise<Sorteado>,
    onSuccess: (r) => {
      setUltimo(r);
      setAnimando(true);
      setModalAberto(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const encerrado = sorteio.status === "ENCERRADO";
  const sorteadoTotal = sorteio.status === "SORTEADO";
  const totais = apuracao?.totais;
  const premios = apuracao?.premios ?? [];
  const ganhadores = apuracao?.ganhadores ?? [];
  const numeros = apuracao?.numeros_amostra ?? [];
  const podeSortear = apuracao?.pode_sortear === true && encerrado;

  if (!encerrado && !sorteadoTotal) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sortear</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Este sorteio ainda não está encerrado.</p>
        </CardContent>
      </Card>
    );
  }

  function finalizarAnimacao() {
    setAnimando(false);
    qc.invalidateQueries({ queryKey: ["sorteio-apuracao", sorteio.id] });
    qc.invalidateQueries({ queryKey: ["sorteio", sorteio.id] });
    qc.invalidateQueries({ queryKey: ["sorteio-indicadores", sorteio.id] });
    qc.invalidateQueries({ queryKey: ["sorteios"] });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Sortear</CardTitle>
          {podeSortear && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={mutation.isPending || animando}>
                  <Dices className="mr-2 h-4 w-4" />
                  {mutation.isPending || animando ? "Sorteando..." : "Realizar sorteio"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Tem certeza que deseja realizar o sorteio?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Após realizar o sorteio, o resultado ficará registrado no histórico e não
                    poderá ser alterado por esta tela.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => mutation.mutate()}>
                    Realizar sorteio
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando apuração...</p>}

          {totais && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <IndicadorCard
                titulo="Participantes concorrentes"
                valor={totais.participantes_concorrentes}
              />
              <IndicadorCard titulo="Cupons concorrentes" valor={totais.cupons_concorrentes} />
              <IndicadorCard titulo="Prêmios cadastrados" valor={totais.premios_cadastrados} />
              <IndicadorCard
                titulo="Prêmios já sorteados"
                valor={totais.unidades_sorteadas}
                descricao={`de ${totais.unidades_total}`}
              />
              <IndicadorCard titulo="Prêmios disponíveis" valor={totais.unidades_disponiveis} />
            </div>
          )}

          {sorteadoTotal && (
            <p className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm font-medium">
              <PartyPopper className="h-4 w-4 text-primary" /> Todos os prêmios deste sorteio já
              foram sorteados.
            </p>
          )}

          {encerrado && !podeSortear && !isLoading && (
            <p className="text-sm text-muted-foreground">
              {totais && totais.unidades_disponiveis === 0
                ? "Não há prêmio disponível para sortear."
                : "Não há cupom ou participante elegível para sortear."}
            </p>
          )}
        </CardContent>
      </Card>

      <ListaPremios premios={premios} />

      {ultimo && (
        <Dialog
          open={modalAberto}
          onOpenChange={(aberto) => {
            if (!animando) setModalAberto(aberto);
          }}
        >
          <DialogContent
            className={`w-[calc(100%-2rem)] max-w-2xl ${animando ? "[&>button]:hidden" : ""}`}
            onEscapeKeyDown={(evento) => {
              if (animando) evento.preventDefault();
            }}
            onInteractOutside={(evento) => {
              if (animando) evento.preventDefault();
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {animando ? "Sorteando cupom" : "🎉 Ganhador"}
              </DialogTitle>
              <DialogDescription className="text-base">{ultimo.premio_nome}</DialogDescription>
            </DialogHeader>
            {animando ? (
            <RoletaCupons
              numeros={numeros}
              vencedor={ultimo.numero_cupom}
              onFim={finalizarAnimacao}
            />
            ) : (
              <>
                <ResultadoGanhador resultado={ultimo} destaque />
                <DialogFooter>
                  <Button size="lg" onClick={() => setModalAberto(false)}>Fechar</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}

      {ultimo && !animando && <CardGanhador resultado={ultimo} />}

      <Historico ganhadores={ganhadores} />
    </div>
  );
}

function ListaPremios({ premios }: { premios: PremioApuracao[] }) {
  if (premios.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Prêmios</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {premios.map((p, i) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {i + 1}º Prêmio — {p.nome}
                {p.quantidade > 1 && (
                  <span className="text-muted-foreground"> ({p.quantidade} unidades)</span>
                )}
              </p>
              {p.descricao && (
                <p className="text-xs text-muted-foreground">{p.descricao}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {p.quantidade > 1 && (
                <span className="text-xs text-muted-foreground">
                  {p.sorteados}/{p.quantidade} sorteados
                </span>
              )}
              {!p.ativo ? (
                <Badge variant="outline">Inativo</Badge>
              ) : p.disponivel ? (
                <Badge variant="secondary">Disponível</Badge>
              ) : (
                <Badge>Já sorteado</Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CardGanhador({ resultado }: { resultado: Sorteado }) {
  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-primary" /> Ganhador
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResultadoGanhador resultado={resultado} />
      </CardContent>
    </Card>
  );
}

function dadoProtegido(final4: string | null) {
  return final4 ? `•••• ${final4}` : "—";
}

function ResultadoGanhador({ resultado, destaque = false }: { resultado: Sorteado; destaque?: boolean }) {
  const linhas = (
    <>
      <Linha
        rotulo="Prêmio"
        valor={
          resultado.premio_quantidade > 1
            ? `${resultado.premio_nome} (unidade ${resultado.unidade} de ${resultado.premio_quantidade})`
            : resultado.premio_nome
        }
        grande={destaque}
      />
      <Linha rotulo="Participante" valor={resultado.participante_nome ?? "—"} grande={destaque} />
      <Linha rotulo="CPF" valor={dadoProtegido(resultado.cpf_final4)} grande={destaque} />
      <Linha
        rotulo="Telefone"
        valor={dadoProtegido(resultado.telefone_final4)}
        grande={destaque}
      />
      <Linha rotulo="Data" valor={dataHoraBR(resultado.sorteado_em)} grande={destaque} />
    </>
  );

  if (destaque) {
    return (
      <div className="space-y-5 rounded-xl border border-primary/30 bg-primary/5 p-6">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Cupom vencedor
          </p>
          <p className="mt-1 font-mono text-4xl font-bold tabular-nums tracking-wider text-primary sm:text-5xl">
            {resultado.numero_cupom}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">{linhas}</div>
      </div>
    );
  }

  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <Linha rotulo="Cupom" valor={resultado.numero_cupom} />
      {linhas}
    </div>
  );
}

function Linha({
  rotulo,
  valor,
  grande = false,
}: {
  rotulo: string;
  valor: string;
  grande?: boolean;
}) {
  return (
    <p className={grande ? "text-base" : undefined}>
      <span className="text-muted-foreground">{rotulo}: </span>
      <span className={grande ? "text-lg font-semibold" : "font-medium"}>{valor}</span>
    </p>
  );
}

function Historico({ ganhadores }: { ganhadores: GanhadorApuracao[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico dos ganhadores</CardTitle>
      </CardHeader>
      <CardContent>
        {ganhadores.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum prêmio sorteado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2">Prêmio</th>
                  <th className="p-2">Cupom</th>
                  <th className="p-2">Participante</th>
                   <th className="p-2">CPF</th>
                   <th className="p-2">Telefone</th>
                  <th className="p-2">Data/Hora</th>
                  <th className="p-2">Situação</th>
                </tr>
              </thead>
              <tbody>
                {ganhadores.map((g) => (
                  <tr key={g.id} className="border-b last:border-0">
                    <td className="p-2">
                      {g.premio_nome ?? "—"}
                      {(g.premio_quantidade ?? 1) > 1 && g.unidade
                        ? ` (unidade ${g.unidade})`
                        : ""}
                    </td>
                    <td className="p-2 font-mono tabular-nums">{g.numero_cupom}</td>
                    <td className="p-2">{g.participante_nome ?? "—"}</td>
                    <td className="p-2 whitespace-nowrap">{dadoProtegido(g.cpf_final4)}</td>
                    <td className="p-2 whitespace-nowrap">{dadoProtegido(g.telefone_final4)}</td>
                    <td className="p-2 whitespace-nowrap">{dataHoraBR(g.sorteado_em)}</td>
                    <td className="p-2">
                      <Badge variant="secondary">{g.cupom_status ?? "—"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginaPrivada } from "@/modules/sorteios/components/publico/PaginaPrivada";
import { StatusNotaBadge } from "@/modules/sorteios/components/publico/StatusNotaBadge";
import {
  corrigirMinhaNota,
  listarMinhasNotas,
  registrarNotaParticipante,
} from "@/lib/sorteios-publico.functions";
import { centavosDeTexto, textoDeCentavos } from "@/modules/sorteios/validations/sorteio";
import { brl, dataHoraBR } from "@/lib/format";

/** Formata o campo de valor durante a digitação no padrão moeda brasileira.
 *  1 → 1,00 | 1234 → 1.234,00 | 1234,56 → 1.234,56
 */
function formatarMoedaDigitando(valor: string): string {
  if (!valor) return "";
  const temVirgula = valor.includes(",");
  const digitos = valor.replace(/\D/g, "");
  if (!digitos) return "";
  if (!temVirgula) {
    const inteiro = digitos.replace(/^0+/, "") || "0";
    return `${Number(inteiro).toLocaleString("pt-BR")},00`;
  }
  const partes = valor.split(",");
  const depois = partes[partes.length - 1]
    .replace(/\D/g, "")
    .padEnd(2, "0")
    .slice(0, 2);
  const antes = partes
    .slice(0, -1)
    .join("")
    .replace(/\D/g, "");
  const inteiro = antes.replace(/^0+/, "") || "0";
  return `${Number(inteiro).toLocaleString("pt-BR")},${depois}`;
}

const META_PRIVADA = [
  { title: "Minhas notas | Portal de Sorteios" },
  { name: "robots", content: "noindex, nofollow" },
];

export const Route = createFileRoute("/sorteios-publico/notas")({
  component: NotasPortal,
  head: () => ({ meta: META_PRIVADA }),
});

function NotasPortal() {
  const queryClient = useQueryClient();
  const listarFn = useServerFn(listarMinhasNotas);
  const registrarFn = useServerFn(registrarNotaParticipante);
  const corrigirFn = useServerFn(corrigirMinhaNota);

  const notas = useQuery({
    queryKey: ["portal-notas"],
    queryFn: () => listarFn({}),
    retry: false,
  });

  const [numero, setNumero] = useState("");
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [corrigindo, setCorrigindo] = useState<string | null>(null);

  async function atualizar() {
    await queryClient.invalidateQueries({ queryKey: ["portal-notas"] });
    await queryClient.invalidateQueries({ queryKey: ["portal-painel"] });
  }

  async function salvar() {
    setErro("");
    const centavos = centavosDeTexto(valor);
    if (!numero.trim()) {
      setErro("Informe o número da nota.");
      return;
    }
    if (!centavos || centavos <= 0) {
      setErro("Informe o valor da nota.");
      return;
    }
    setEnviando(true);
    try {
      const dados = { numero: numero.trim(), valor_centavos: centavos };
      const resultado = corrigindo
        ? await corrigirFn({ data: { ...dados, nota_id: corrigindo } })
        : await registrarFn({ data: dados });
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
      toast.success(
        corrigindo ? "Nota corrigida! Está em análise." : "Nota registrada! Está em análise.",
      );
      setNumero("");
      setValor("");
      setCorrigindo(null);
      await atualizar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PaginaPrivada titulo="Minhas notas" subtitulo="Registre suas notas e acompanhe a análise.">
      {(contexto) => (
        <div className="space-y-4">
          {contexto.acoesBloqueadas ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Este sorteio não está recebendo novas notas no momento.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <p className="text-sm font-semibold">
                  {corrigindo ? "Corrigir nota" : "Registrar nova nota"}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="numero">Número da nota</Label>
                  <Input
                    id="numero"
                    className="h-12 text-lg"
                    inputMode="numeric"
                    placeholder="Somente o número da nota"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valor">Valor da nota (R$)</Label>
                  <Input
                    id="valor"
                    className="h-12 text-lg"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                  />
                </div>
                {erro && <p className="text-sm text-destructive">{erro}</p>}
                <Button
                  className="w-full h-12 text-base"
                  disabled={enviando}
                  onClick={() => void salvar()}
                >
                  {enviando && <Loader2 className="h-5 w-5 animate-spin" />}
                  {corrigindo ? "Salvar correção" : "Registrar nota"}
                </Button>
                {corrigindo && (
                  <button
                    type="button"
                    className="w-full text-sm text-muted-foreground underline"
                    onClick={() => {
                      setCorrigindo(null);
                      setNumero("");
                      setValor("");
                      setErro("");
                    }}
                  >
                    Cancelar correção
                  </button>
                )}
              </CardContent>
            </Card>
          )}

          {!notas.data ? (
            <Skeleton className="h-32 w-full" />
          ) : !notas.data.ok ? (
            <p className="text-sm text-muted-foreground">{notas.data.mensagem}</p>
          ) : notas.data.dados.notas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Você ainda não registrou nenhuma nota neste sorteio.
            </p>
          ) : (
            <div className="space-y-3">
              {notas.data.dados.notas.map((nota) => (
                <Card key={nota.id}>
                  <CardContent className="pt-6 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">Nota {nota.numero}</p>
                        <p className="text-sm text-muted-foreground">
                          {brl(nota.valor_centavos / 100)} · {dataHoraBR(nota.cadastrado_em)}
                        </p>
                      </div>
                      <StatusNotaBadge status={nota.status} />
                    </div>
                    {nota.status === "INVALIDA" && (
                      <>
                        {nota.motivo_invalidez && (
                          <p className="text-sm text-destructive">{nota.motivo_invalidez}</p>
                        )}
                        {!contexto.acoesBloqueadas && (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              setCorrigindo(nota.id);
                              setNumero(nota.numero);
                              setValor(textoDeCentavos(nota.valor_centavos));
                              setErro("");
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                            Corrigir nota
                          </Button>
                        )}
                      </>
                    )}
                    {nota.status === "CANCELADA" && (
                      <p className="text-sm text-muted-foreground">
                        Esta nota foi cancelada e não pode mais ser alterada.
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </PaginaPrivada>
  );
}

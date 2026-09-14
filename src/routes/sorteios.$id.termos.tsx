import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Star } from "lucide-react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dataHoraBR } from "@/lib/format";
import { definirTermosAtual, salvarTermos } from "@/lib/sorteios.functions";
import { NavSorteio } from "@/modules/sorteios/components/NavSorteio";
import { useSorteio, useTermosSorteio } from "@/modules/sorteios/hooks/useSorteios";
import { somenteConsulta } from "@/modules/sorteios/services/status";
import { esquemaTermos, type DadosTermos } from "@/modules/sorteios/validations/sorteio";
import type { SorteioTermos } from "@/modules/sorteios/types";

export const Route = createFileRoute("/sorteios/$id/termos")({
  component: () => (
    <AppLayout permissao="sorteios.visualizar">
      <TermosSorteio />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Termos do sorteio | Calculadora de Impressão Digital" },
      {
        name: "description",
        content: "Versões do regulamento do sorteio: regras, como participar, validade e prêmios.",
      },
      { property: "og:title", content: "Termos do sorteio | Calculadora de Impressão Digital" },
      { property: "og:description", content: "Regulamento e versões dos termos do sorteio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const CAMPOS_TEXTO: { chave: keyof DadosTermos; rotulo: string }[] = [
  { chave: "regras", rotulo: "Regras" },
  { chave: "como_participar", rotulo: "Como participar" },
  { chave: "validade", rotulo: "Validade" },
  { chave: "como_sera_realizado", rotulo: "Como será realizado o sorteio" },
  { chave: "premios", rotulo: "Prêmios" },
  { chave: "informacoes", rotulo: "Informações adicionais" },
  { chave: "outras_condicoes", rotulo: "Outras condições" },
];

function vazios(proximaVersao: number): Record<string, string> {
  return {
    versao: String(proximaVersao),
    titulo: "",
    regras: "",
    como_participar: "",
    validade: "",
    como_sera_realizado: "",
    premios: "",
    informacoes: "",
    outras_condicoes: "",
  };
}

function TermosSorteio() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: sorteio } = useSorteio(id);
  const { data: termos, isLoading } = useTermosSorteio(id);
  const salvar = useServerFn(salvarTermos);
  const definirAtual = useServerFn(definirTermosAtual);

  const [editando, setEditando] = useState<string | null>(null);
  const [valores, setValores] = useState<Record<string, string> | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});

  const consulta = sorteio ? somenteConsulta(sorteio.status) : true;
  const proximaVersao = (termos?.[0]?.versao ?? 0) + 1;

  const mSalvar = useMutation({
    mutationFn: (payload: { termosId: string | null; dados: DadosTermos }) =>
      salvar({ data: { sorteioId: id, termosId: payload.termosId, dados: payload.dados } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sorteio-termos", id] });
      setEditando(null);
      setValores(null);
      toast.success("Termos salvos.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mAtual = useMutation({
    mutationFn: (termosId: string) => definirAtual({ data: { sorteioId: id, termosId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sorteio-termos", id] });
      toast.success("Versão atual definida.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function abrirNovo() {
    setEditando("novo");
    setValores(vazios(proximaVersao));
    setErros({});
  }

  function abrirEdicao(t: SorteioTermos) {
    setEditando(t.id);
    setErros({});
    setValores({
      versao: String(t.versao),
      titulo: t.titulo ?? "",
      regras: t.regras ?? "",
      como_participar: t.como_participar ?? "",
      validade: t.validade ?? "",
      como_sera_realizado: t.como_sera_realizado ?? "",
      premios: t.premios ?? "",
      informacoes: t.informacoes ?? "",
      outras_condicoes: t.outras_condicoes ?? "",
    });
  }

  function enviar() {
    if (!valores) return;
    const resultado = esquemaTermos.safeParse({
      ...valores,
      versao: Number(valores["versao"]),
    });
    if (!resultado.success) {
      const mapa: Record<string, string> = {};
      for (const issue of resultado.error.issues) {
        const chave = String(issue.path[0] ?? "geral");
        if (!mapa[chave]) mapa[chave] = issue.message;
      }
      setErros(mapa);
      return;
    }
    setErros({});
    mSalvar.mutate({ termosId: editando === "novo" ? null : editando, dados: resultado.data });
  }

  return (
    <>
      <PageHeader titulo="Termos do sorteio" subtitulo={sorteio?.nome ?? ""} />
      <NavSorteio id={id} />

      {!consulta && (
        <div className="mb-4 flex justify-end">
          <Button onClick={abrirNovo} disabled={editando !== null}>
            <Plus className="mr-2 h-4 w-4" /> Nova versão
          </Button>
        </div>
      )}

      {editando && valores && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>
              {editando === "novo" ? "Nova versão dos termos" : "Editar versão"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="versao">Versão *</Label>
                <Input
                  id="versao"
                  type="number"
                  min={1}
                  value={valores["versao"]}
                  onChange={(e) => setValores({ ...valores, versao: e.target.value })}
                />
                {erros["versao"] && (
                  <p className="mt-1 text-xs text-destructive">{erros["versao"]}</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="titulo">Título</Label>
                <Input
                  id="titulo"
                  value={valores["titulo"]}
                  onChange={(e) => setValores({ ...valores, titulo: e.target.value })}
                />
              </div>
            </div>

            {CAMPOS_TEXTO.map((campo) => (
              <div key={campo.chave}>
                <Label htmlFor={campo.chave}>{campo.rotulo}</Label>
                <Textarea
                  id={campo.chave}
                  rows={4}
                  value={valores[campo.chave] ?? ""}
                  onChange={(e) => setValores({ ...valores, [campo.chave]: e.target.value })}
                />
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <Button onClick={enviar} disabled={mSalvar.isPending}>
                {mSalvar.isPending ? "Salvando..." : "Salvar versão"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditando(null);
                  setValores(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isLoading && (termos?.length ?? 0) === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma versão de termos cadastrada.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {(termos ?? []).map((t) => (
          <Card key={t.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">Versão {t.versao}</span>
                  {t.titulo && <span className="text-sm text-muted-foreground">{t.titulo}</span>}
                  {t.atual && (
                    <Badge className="bg-primary/10 text-primary" variant="outline">
                      Atual
                    </Badge>
                  )}
                </div>
                {!consulta && (
                  <div className="flex gap-2">
                    {!t.atual && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={mAtual.isPending}
                        onClick={() => mAtual.mutate(t.id)}
                      >
                        <Star className="mr-2 h-4 w-4" /> Definir como atual
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => abrirEdicao(t)}>
                      Editar
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Criada em {dataHoraBR(t.criado_em)}
                {t.publicado_em ? ` · publicada em ${dataHoraBR(t.publicado_em)}` : ""}
              </p>
              {t.regras && <p className="line-clamp-3 whitespace-pre-line text-sm">{t.regras}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

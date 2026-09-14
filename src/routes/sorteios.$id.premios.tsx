import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { alternarPremio, salvarPremio } from "@/lib/sorteios.functions";
import { NavSorteio } from "@/modules/sorteios/components/NavSorteio";
import { usePremiosSorteio, useSorteio } from "@/modules/sorteios/hooks/useSorteios";
import { somenteConsulta } from "@/modules/sorteios/services/status";
import { esquemaPremio, type DadosPremio } from "@/modules/sorteios/validations/sorteio";
import type { SorteioPremio } from "@/modules/sorteios/types";

export const Route = createFileRoute("/sorteios/$id/premios")({
  component: () => (
    <AppLayout permissao="sorteios.visualizar">
      <PremiosSorteio />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Prêmios do sorteio | Calculadora de Impressão Digital" },
      {
        name: "description",
        content: "Cadastre os prêmios do sorteio com quantidade, ordem de apresentação e situação.",
      },
      { property: "og:title", content: "Prêmios do sorteio | Calculadora de Impressão Digital" },
      { property: "og:description", content: "Prêmios da campanha de sorteio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Valores = { nome: string; descricao: string; quantidade: string; ordem: string; ativo: boolean };

const VAZIO: Valores = { nome: "", descricao: "", quantidade: "1", ordem: "0", ativo: true };

function PremiosSorteio() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: sorteio } = useSorteio(id);
  const { data: premios, isLoading } = usePremiosSorteio(id);
  const salvar = useServerFn(salvarPremio);
  const alternar = useServerFn(alternarPremio);

  const [editando, setEditando] = useState<string | null>(null);
  const [valores, setValores] = useState<Valores>(VAZIO);
  const [erros, setErros] = useState<Record<string, string>>({});

  const consulta = sorteio ? somenteConsulta(sorteio.status) : true;

  const mSalvar = useMutation({
    mutationFn: (payload: { premioId: string | null; dados: DadosPremio }) =>
      salvar({ data: { sorteioId: id, premioId: payload.premioId, dados: payload.dados } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sorteio-premios", id] });
      qc.invalidateQueries({ queryKey: ["sorteio-indicadores", id] });
      setEditando(null);
      toast.success("Prêmio salvo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mAlternar = useMutation({
    mutationFn: (payload: { premioId: string; ativo: boolean }) =>
      alternar({ data: { sorteioId: id, ...payload } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sorteio-premios", id] });
      qc.invalidateQueries({ queryKey: ["sorteio-indicadores", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function abrirEdicao(p: SorteioPremio) {
    setEditando(p.id);
    setErros({});
    setValores({
      nome: p.nome,
      descricao: p.descricao ?? "",
      quantidade: String(p.quantidade),
      ordem: String(p.ordem),
      ativo: p.ativo,
    });
  }

  function enviar() {
    const resultado = esquemaPremio.safeParse({
      nome: valores.nome,
      descricao: valores.descricao,
      quantidade: Number(valores.quantidade),
      ordem: Number(valores.ordem || 0),
      ativo: valores.ativo,
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
    mSalvar.mutate({ premioId: editando === "novo" ? null : editando, dados: resultado.data });
  }

  return (
    <>
      <PageHeader titulo="Prêmios do sorteio" subtitulo={sorteio?.nome} />
      <NavSorteio id={id} />

      {!consulta && (
        <div className="mb-4 flex justify-end">
          <Button
            onClick={() => {
              setEditando("novo");
              setValores(VAZIO);
              setErros({});
            }}
            disabled={editando !== null}
          >
            <Plus className="mr-2 h-4 w-4" /> Novo prêmio
          </Button>
        </div>
      )}

      {editando && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>{editando === "novo" ? "Novo prêmio" : "Editar prêmio"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={valores.nome}
                  onChange={(e) => setValores({ ...valores, nome: e.target.value })}
                />
                {erros["nome"] && <p className="mt-1 text-xs text-destructive">{erros["nome"]}</p>}
              </div>
              <div>
                <Label htmlFor="quantidade">Quantidade *</Label>
                <Input
                  id="quantidade"
                  type="number"
                  min={1}
                  value={valores.quantidade}
                  onChange={(e) => setValores({ ...valores, quantidade: e.target.value })}
                />
                {erros["quantidade"] && (
                  <p className="mt-1 text-xs text-destructive">{erros["quantidade"]}</p>
                )}
              </div>
              <div>
                <Label htmlFor="ordem">Ordem</Label>
                <Input
                  id="ordem"
                  type="number"
                  min={0}
                  value={valores.ordem}
                  onChange={(e) => setValores({ ...valores, ordem: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  rows={3}
                  value={valores.descricao}
                  onChange={(e) => setValores({ ...valores, descricao: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="ativo"
                  checked={valores.ativo}
                  onCheckedChange={(v) => setValores({ ...valores, ativo: v })}
                />
                <Label htmlFor="ativo">Ativo</Label>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={enviar} disabled={mSalvar.isPending}>
                {mSalvar.isPending ? "Salvando..." : "Salvar prêmio"}
              </Button>
              <Button variant="outline" onClick={() => setEditando(null)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isLoading && (premios?.length ?? 0) === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhum prêmio cadastrado.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {(premios ?? []).map((p) => (
          <Card key={p.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">#{p.ordem}</span>
                  <span className="font-semibold">{p.nome}</span>
                  <Badge variant="outline">{p.quantidade}x</Badge>
                  {!p.ativo && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Inativo
                    </Badge>
                  )}
                </div>
                {p.descricao && (
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                    {p.descricao}
                  </p>
                )}
              </div>
              {!consulta && (
                <div className="flex shrink-0 items-center gap-3">
                  <Switch
                    checked={p.ativo}
                    disabled={mAlternar.isPending}
                    onCheckedChange={(v) => mAlternar.mutate({ premioId: p.id, ativo: v })}
                    aria-label="Ativar ou desativar prêmio"
                  />
                  <Button size="sm" variant="outline" onClick={() => abrirEdicao(p)}>
                    Editar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

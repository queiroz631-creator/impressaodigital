import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, FileText, Loader2 } from "lucide-react";

import {
  atualizarLinkOrcamento,
  carregarLinkOrcamento,
  confirmarLinkOrcamento,
} from "@/lib/link.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/orcamento/$token")({
  component: PaginaLinkOrcamento,
  head: () => ({
    meta: [
      { title: "Seu orçamento de impressão" },
      { name: "description", content: "Confira os detalhes do seu orçamento de impressão e confirme o pedido." },
      { property: "og:title", content: "Seu orçamento de impressão" },
      { property: "og:description", content: "Confira os detalhes do seu orçamento e confirme o pedido." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PaginaLinkOrcamento() {
  const { token } = Route.useParams();
  const carregar = useServerFn(carregarLinkOrcamento);
  const atualizar = useServerFn(atualizarLinkOrcamento);
  const confirmar = useServerFn(confirmarLinkOrcamento);

  const consulta = useQuery({
    queryKey: ["link-orcamento", token],
    queryFn: () => carregar({ data: { token } }),
  });

  const dados = consulta.data;

  const [material, setMaterial] = useState<string>("");
  const [copias, setCopias] = useState(1);
  const [frenteVerso, setFrenteVerso] = useState(false);
  const [acabamentos, setAcabamentos] = useState<string[]>([]);

  useEffect(() => {
    const o = dados?.orcamento;
    if (!o) return;
    setMaterial(o.materialId ?? "");
    setCopias(o.copiasPorArquivo);
    setFrenteVerso(o.frenteVerso);
    setAcabamentos(o.acabamentosSelecionados);
  }, [dados?.orcamento]);

  const salvar = useMutation({
    mutationFn: () =>
      atualizar({
        data: {
          token,
          materialId: material || null,
          copiasPorArquivo: copias,
          frenteVerso,
          acabamentoIds: acabamentos,
        },
      }),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(r.motivo ?? "Não foi possível atualizar.");
        return;
      }
      consulta.refetch();
      toast.success("Orçamento atualizado.");
    },
    onError: () => toast.error("Não foi possível atualizar o orçamento."),
  });

  const aprovar = useMutation({
    mutationFn: () => confirmar({ data: { token } }),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(r.motivo ?? "Não foi possível confirmar.");
        return;
      }
      consulta.refetch();
      toast.success("Pedido confirmado! 🎉");
    },
    onError: () => toast.error("Não foi possível confirmar o pedido."),
  });

  if (consulta.isLoading) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!dados?.ok || !dados.orcamento || !dados.permissoes || !dados.opcoes) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-base">Orçamento indisponível</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {dados?.motivo ?? "Este link não está disponível."}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { orcamento: o, permissoes: p, opcoes, empresa } = dados;
  const podeEditar = !o.confirmado && (p.material || p.copias || p.frenteVerso || p.acabamento);

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="mx-auto grid max-w-2xl gap-4 px-4">
        <header className="text-center">
          <h1 className="text-xl font-bold">{empresa?.nome}</h1>
          <p className="text-sm text-muted-foreground">
            Orçamento <strong>{o.numero}</strong> — {o.clienteNome}
          </p>
        </header>

        {o.confirmado && (
          <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" />
            Pedido confirmado. Em breve entraremos em contato.
          </div>
        )}

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Resumo do trabalho</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <Info rotulo="Formato" valor={o.formato} />
              <Info rotulo="Tipo" valor={o.tipoServico === "especial" ? "Especial" : "Simples"} />
              <Info rotulo="Arquivos" valor={String(o.quantidadeArquivos)} />
              <Info rotulo="Páginas" valor={String(o.paginasTotal)} />
              <Info rotulo="Cópias por arquivo" valor={String(o.copiasPorArquivo)} />
              <Info rotulo="Frente e verso" valor={o.frenteVerso ? "Sim" : "Não"} />
            </div>

            {o.arquivos.length > 0 && (
              <div className="grid gap-1 rounded-md border p-2">
                {o.arquivos.map((a, i) => (
                  <div key={`${a.nome}-${i}`} className="flex items-center gap-2 text-xs">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{a.nome}</span>
                    <span className="ml-auto text-muted-foreground">{a.paginas} pág.</span>
                  </div>
                ))}
              </div>
            )}

            {p.mostrarPrecos && (
              <div className="flex items-center justify-between rounded-md bg-primary/10 px-3 py-2">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-bold text-primary">{moeda(o.valorTotal)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {podeEditar && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Ajustar meu pedido</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm">
              {p.material && (
                <div className="grid gap-1.5">
                  <Label>Material / papel</Label>
                  <Select value={material} onValueChange={setMaterial}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha o material" />
                    </SelectTrigger>
                    <SelectContent>
                      {opcoes.materiais.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {p.copias && (
                <div className="grid gap-1.5">
                  <Label>Cópias de cada arquivo</Label>
                  <Input
                    type="number"
                    min={1}
                    value={copias}
                    onChange={(e) => setCopias(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>
              )}

              {p.frenteVerso && (
                <label className="flex items-center justify-between gap-4">
                  <span>Imprimir em frente e verso</span>
                  <Switch checked={frenteVerso} onCheckedChange={setFrenteVerso} />
                </label>
              )}

              {p.acabamento && opcoes.acabamentos.length > 0 && (
                <div className="grid gap-2">
                  <Label>Acabamentos</Label>
                  {opcoes.acabamentos.map((a) => (
                    <label key={a.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={acabamentos.includes(a.id)}
                        onCheckedChange={(v) =>
                          setAcabamentos((atual) =>
                            v === true ? [...atual, a.id] : atual.filter((id) => id !== a.id),
                          )
                        }
                      />
                      <span>{a.nome}</span>
                    </label>
                  ))}
                </div>
              )}

              <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                {salvar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Recalcular meu orçamento
              </Button>
            </CardContent>
          </Card>
        )}

        {p.confirmacao && !o.confirmado && (
          <Button size="lg" onClick={() => aprovar.mutate()} disabled={aprovar.isPending}>
            {aprovar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar pedido
          </Button>
        )}

        {empresa?.telefone && (
          <p className="text-center text-xs text-muted-foreground">
            Dúvidas? Fale com a gente: {empresa.telefone}
          </p>
        )}
      </div>
    </div>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="font-medium">{valor}</p>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, Circle, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useTrabalhos } from "../hooks/useFotoExpress";

const STATUS: Record<string, { nome: string; cor: string; ponto: string }> = {
  RASCUNHO: { nome: "Rascunho", cor: "border-muted-foreground/30 bg-muted text-muted-foreground", ponto: "fill-muted-foreground text-muted-foreground" },
  EM_EDICAO: { nome: "Em edição", cor: "border-chart-1/30 bg-chart-1/10 text-chart-1", ponto: "fill-chart-1 text-chart-1" },
  PRONTO_IMPRESSAO: { nome: "Pronto para impressão", cor: "border-chart-4/35 bg-chart-4/15 text-foreground", ponto: "fill-chart-4 text-chart-4" },
  IMPRESSO: { nome: "Impresso", cor: "border-chart-2/35 bg-chart-2/15 text-foreground", ponto: "fill-chart-2 text-chart-2" },
  FINALIZADO: { nome: "Finalizado", cor: "border-success/35 bg-success/15 text-success", ponto: "fill-success text-success" },
};
const dataHora = (valor: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(valor));

export function TrabalhosPagina() {
  const { data = [], isLoading, error } = useTrabalhos();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("TODOS");
  const finalizar = useMutation({
    mutationFn: async (id: string) => {
      const { data: atualizado, error: erro } = await supabase.from("foto_express_trabalhos").update({ status: "FINALIZADO" }).eq("id", id).eq("status", "IMPRESSO").select("id").maybeSingle();
      if (erro) throw erro;
      if (!atualizado) throw new Error("Este trabalho não está mais disponível para finalização.");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["foto-express", "trabalhos"] });
      toast.success("Trabalho finalizado.");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleUpperCase("pt-BR");
    return data.filter((trabalho) => (status === "TODOS" || trabalho.status === status) && (!termo || String(trabalho.numero).includes(termo) || trabalho.cliente_nome.includes(termo) || trabalho.cliente_telefone.includes(termo)));
  }, [busca, data, status]);

  return <>
    <PageHeader titulo="FOTO EXPRESS" subtitulo="Trabalhos de fotos para impressão" />
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="grid flex-1 gap-2 sm:max-w-2xl sm:grid-cols-[1fr_210px]">
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por número, nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
        <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os status</SelectItem>{Object.entries(STATUS).map(([valor, item]) => <SelectItem key={valor} value={valor}><span className="flex items-center gap-2"><Circle className={`h-2.5 w-2.5 ${item.ponto}`} aria-hidden="true" />{item.nome}</span></SelectItem>)}</SelectContent></Select>
      </div>
      <Button asChild><Link to="/foto-express/novo"><Plus className="mr-2 h-4 w-4" />Novo trabalho</Link></Button>
    </div>
    {isLoading && <p className="text-sm text-muted-foreground">Carregando trabalhos...</p>}
    {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
    {!isLoading && filtrados.length === 0 && <Card><CardContent className="flex flex-col items-center gap-3 p-12 text-center"><Camera className="h-10 w-10 text-muted-foreground" /><p className="font-semibold">Nenhum trabalho encontrado</p><p className="text-sm text-muted-foreground">Crie um novo trabalho para enviar e preparar as fotos.</p></CardContent></Card>}
    <div className="grid gap-3">{filtrados.map((trabalho) => { const statusVisual = STATUS[trabalho.status]; return <Card key={trabalho.id}><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><span className="font-bold">#{String(trabalho.numero).padStart(6, "0")}</span><Badge variant="outline" className={statusVisual?.cor}>{statusVisual?.nome ?? trabalho.status}</Badge></div><p className="truncate font-medium">{trabalho.cliente_nome || "CLIENTE NÃO INFORMADO"}</p><p className="text-xs text-muted-foreground">{trabalho.cliente_telefone || "Sem telefone"} · {trabalho.foto_express_itens[0]?.count ?? 0} foto(s)</p><p className="text-xs text-muted-foreground">Criado em {dataHora(trabalho.criado_em)} · alterado em {dataHora(trabalho.atualizado_em)}</p></div><div className="flex flex-wrap gap-2">{trabalho.status === "IMPRESSO" && <Button type="button" variant="outline" disabled={finalizar.isPending} onClick={() => finalizar.mutate(trabalho.id)}><CheckCircle2 className="mr-2 h-4 w-4" />Finalizar</Button>}<Button asChild variant="outline"><Link to="/foto-express/$id/fotos" params={{ id: trabalho.id }}>Abrir trabalho</Link></Button></div></CardContent></Card>; })}</div>
  </>;
}

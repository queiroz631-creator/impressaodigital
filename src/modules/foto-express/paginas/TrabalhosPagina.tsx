import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Camera, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTrabalhos } from "../hooks/useFotoExpress";

const STATUS: Record<string, string> = { RASCUNHO: "Rascunho", EM_EDICAO: "Em edição", PRONTO_IMPRESSAO: "Pronto para impressão", IMPRESSO: "Impresso", FINALIZADO: "Finalizado" };
const dataHora = (valor: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(valor));

export function TrabalhosPagina() {
  const { data = [], isLoading, error } = useTrabalhos();
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("TODOS");
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleUpperCase("pt-BR");
    return data.filter((trabalho) => (status === "TODOS" || trabalho.status === status) && (!termo || String(trabalho.numero).includes(termo) || trabalho.cliente_nome.includes(termo) || trabalho.cliente_telefone.includes(termo)));
  }, [busca, data, status]);

  return <>
    <PageHeader titulo="FOTO EXPRESS" subtitulo="Trabalhos de fotos para impressão" />
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="grid flex-1 gap-2 sm:max-w-2xl sm:grid-cols-[1fr_210px]">
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por número, nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
        <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os status</SelectItem>{Object.entries(STATUS).map(([valor, nome]) => <SelectItem key={valor} value={valor}>{nome}</SelectItem>)}</SelectContent></Select>
      </div>
      <Button asChild><Link to="/foto-express/novo"><Plus className="mr-2 h-4 w-4" />Novo trabalho</Link></Button>
    </div>
    {isLoading && <p className="text-sm text-muted-foreground">Carregando trabalhos...</p>}
    {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
    {!isLoading && filtrados.length === 0 && <Card><CardContent className="flex flex-col items-center gap-3 p-12 text-center"><Camera className="h-10 w-10 text-muted-foreground" /><p className="font-semibold">Nenhum trabalho encontrado</p><p className="text-sm text-muted-foreground">Crie um novo trabalho para enviar e preparar as fotos.</p></CardContent></Card>}
    <div className="grid gap-3">{filtrados.map((trabalho) => <Card key={trabalho.id}><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><span className="font-bold">#{String(trabalho.numero).padStart(6, "0")}</span><Badge variant="outline">{STATUS[trabalho.status] ?? trabalho.status}</Badge></div><p className="truncate font-medium">{trabalho.cliente_nome || "CLIENTE NÃO INFORMADO"}</p><p className="text-xs text-muted-foreground">{trabalho.cliente_telefone || "Sem telefone"} · {trabalho.foto_express_itens[0]?.count ?? 0} foto(s)</p><p className="text-xs text-muted-foreground">Criado em {dataHora(trabalho.criado_em)} · alterado em {dataHora(trabalho.atualizado_em)}</p></div><Button asChild variant="outline"><Link to="/foto-express/$id/fotos" params={{ id: trabalho.id }}>Abrir trabalho</Link></Button></CardContent></Card>)}</div>
  </>;
}

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listarClientesPortalFotos } from "@/lib/foto-express-clientes.functions";

const data = (v: string | null) => (v ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(v)) : "—");
const cpfFmt = (v: string) => (v.length === 11 ? `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}` : v || "—");
const nascFmt = (v: string | null) => (v ? v.split("-").reverse().join("/") : "—");

export function ClientesPortalLista() {
  const listar = useServerFn(listarClientesPortalFotos);
  const q = useQuery({ queryKey: ["foto-express", "clientes-portal"], queryFn: () => listar() });
  const [busca, setBusca] = useState("");
  const filtrados = useMemo(() => {
    const t = busca.trim().toLocaleUpperCase("pt-BR");
    const d = busca.replace(/\D/g, "");
    return (q.data ?? []).filter((c) => !t || c.nome.toLocaleUpperCase("pt-BR").includes(t) || (d && (c.cpf.includes(d) || c.telefone.replace(/\D/g, "").includes(d))));
  }, [busca, q.data]);

  return <div className="space-y-4">
    <div className="relative sm:max-w-2xl"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por nome, CPF ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
    {q.isLoading && <p className="text-sm text-muted-foreground">Carregando clientes...</p>}
    {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
    {!q.isLoading && !q.error && filtrados.length === 0 && <Card><CardContent className="flex flex-col items-center gap-3 p-12 text-center"><Users className="h-10 w-10 text-muted-foreground" /><p className="font-semibold">Nenhum cliente cadastrado no portal ainda</p><p className="text-sm text-muted-foreground">Os clientes aparecem aqui assim que entram ou se cadastram pelo portal de fotos.</p></CardContent></Card>}
    <div className="grid gap-3">{filtrados.map((c) => <Card key={c.id}><CardContent className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0 space-y-1">
        <p className="truncate font-semibold">{c.nome || "SEM NOME"}</p>
        <p className="text-xs text-muted-foreground">CPF {cpfFmt(c.cpf)} · {c.telefone || "Sem telefone"} · Nascimento {nascFmt(c.dataNascimento)}</p>
        <p className="text-xs text-muted-foreground">Primeiro acesso {data(c.primeiroAcesso)} · último acesso {data(c.ultimoAcesso)}</p>
      </div>
      <Badge variant="secondary" className="justify-self-start sm:justify-self-end">{c.albuns} álbum(ns) pelo portal</Badge>
    </CardContent></Card>)}</div>
  </div>;
}

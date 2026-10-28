import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { listarClientesPortalFotos, type ClientePortalFotos } from "@/lib/foto-express-clientes.functions";

const dataHora = (v: string | null) => (v ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(v)) : "—");
const cpfFmt = (v: string) => (v.length === 11 ? `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}` : v || "—");
const nascFmt = (v: string | null) => (v ? v.split("-").reverse().join("/") : "—");

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="truncate font-medium">{valor || "—"}</p>
    </div>
  );
}

export function ClientesPortalLista() {
  const listar = useServerFn(listarClientesPortalFotos);
  const q = useQuery({ queryKey: ["foto-express", "clientes-portal"], queryFn: () => listar() });
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<ClientePortalFotos | null>(null);
  const filtrados = useMemo(() => {
    const t = busca.trim().toLocaleUpperCase("pt-BR");
    const d = busca.replace(/\D/g, "");
    return (q.data ?? []).filter((c) => !t || c.nome.toLocaleUpperCase("pt-BR").includes(t) || (d && (c.cpf.includes(d) || c.telefone.replace(/\D/g, "").includes(d))));
  }, [busca, q.data]);

  return (
    <div className="space-y-4">
      <div className="relative sm:max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome, CPF ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      {q.isLoading && <p className="text-sm text-muted-foreground">Carregando clientes...</p>}
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
      {!q.isLoading && !q.error && filtrados.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">Nenhum cliente cadastrado no portal ainda</p>
            <p className="text-sm text-muted-foreground">Os clientes aparecem aqui assim que entram ou se cadastram pelo portal de fotos.</p>
          </CardContent>
        </Card>
      )}
      {filtrados.length > 0 && (
        <Card>
          <CardContent className="divide-y p-0">
            {filtrados.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3 sm:px-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.nome || "SEM NOME"}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.telefone || "Sem telefone"} · {c.albuns} álbum(ns) pelo portal</p>
                </div>
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => setAberto(c)}>
                  Ver detalhes
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <Dialog open={!!aberto} onOpenChange={(abre) => !abre && setAberto(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{aberto?.nome || "SEM NOME"}</DialogTitle>
            <DialogDescription>Dados do cliente cadastrado pelo portal de fotos.</DialogDescription>
          </DialogHeader>
          {aberto && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo rotulo="CPF" valor={cpfFmt(aberto.cpf)} />
                <Campo rotulo="Telefone" valor={aberto.telefone} />
                <Campo rotulo="Nascimento" valor={nascFmt(aberto.dataNascimento)} />
                <Campo rotulo="E-mail" valor={aberto.email} />
                <Campo rotulo="Primeiro acesso" valor={dataHora(aberto.primeiroAcesso)} />
                <Campo rotulo="Último acesso" valor={dataHora(aberto.ultimoAcesso)} />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{aberto.albuns} álbum(ns) criado(s) pelo portal</Badge>
              </div>
              {!!aberto.observacao && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Observação</p>
                    <p className="whitespace-pre-wrap text-sm">{aberto.observacao}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

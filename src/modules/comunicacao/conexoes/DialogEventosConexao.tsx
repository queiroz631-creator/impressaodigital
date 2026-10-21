import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { listarEventosConexao, type EventoConexao } from "@/lib/whatsapp-provedores.functions";
import { rotuloStatusEvento } from "./rotulos";

interface Props {
  conexaoId: string | null;
  nome: string;
  onFechar: () => void;
}

export default function DialogEventosConexao({ conexaoId, nome, onFechar }: Props) {
  const listar = useServerFn(listarEventosConexao);
  const [somenteErros, setSomenteErros] = useState(false);

  const { data = [], isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["whatsapp-eventos", conexaoId, somenteErros],
    queryFn: () => listar({ data: { conexaoId: conexaoId!, somenteErros, limite: 50 } }),
    enabled: Boolean(conexaoId),
    retry: false,
  });

  return (
    <Dialog open={Boolean(conexaoId)} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Eventos — {nome}</DialogTitle>
          <DialogDescription>
            Últimos 50 eventos recebidos do provedor. Só metadados: sem telefone nem texto.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={somenteErros} onCheckedChange={setSomenteErros} />
            Somente erros
          </label>
          <Button size="sm" variant="outline" disabled={isFetching} onClick={() => void refetch()}>
            {isFetching ? "Atualizando..." : "Atualizar"}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="py-6 text-center text-sm text-destructive">
            Não foi possível carregar os eventos.
          </p>
        ) : data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum evento registrado.</p>
        ) : (
          <ul className="divide-y rounded border text-sm">
            {(data as EventoConexao[]).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div>
                  <p className="font-medium">{e.tipo}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.recebido_em).toLocaleString("pt-BR")}
                    {e.tentativas > 1 ? ` · ${e.tentativas} tentativas` : ""}
                  </p>
                  {e.erro && <p className="text-xs text-destructive">{e.erro}</p>}
                </div>
                <Badge variant={e.status === "erro" ? "destructive" : "outline"}>
                  {rotuloStatusEvento(e.status)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

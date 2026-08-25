import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizarTelefone } from "@/lib/whatsapp-comum";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

type Numero = {
  id: string;
  telefone: string;
  nome: string | null;
  permitido: boolean;
  ativo: boolean;
  observacao: string | null;
};

/** Exibe o telefone normalizado em formato legível. */
function formatarTelefone(valor: string) {
  const d = valor.replace(/\D/g, "");
  const local = d.startsWith("55") ? d.slice(2) : d;
  if (local.length < 10) return valor;
  const ddd = local.slice(0, 2);
  const resto = local.slice(2);
  const meio = resto.length > 8 ? resto.slice(0, 5) : resto.slice(0, 4);
  return `(${ddd}) ${meio}-${resto.slice(meio.length)}`;
}

/**
 * Controla para quais números o bot responde.
 * Modo "todos": responde a todos, menos os bloqueados.
 * Modo "somente_liberados": responde apenas aos liberados e ativos.
 */
export function NumerosPainel() {
  const queryClient = useQueryClient();
  const [novoTelefone, setNovoTelefone] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoPermitido, setNovoPermitido] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const config = useQuery({
    queryKey: ["whatsapp-config-numeros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_config")
        .select("id, modo_numeros")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const numeros = useQuery({
    queryKey: ["bot-numeros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bot_numeros")
        .select("id, telefone, nome, permitido, ativo, observacao")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Numero[];
    },
  });

  const modo = config.data?.modo_numeros ?? "todos";

  async function alterarModo(valor: string) {
    const id = config.data?.id;
    if (!id) return;
    const { error } = await supabase.from("whatsapp_config").update({ modo_numeros: valor }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Modo de operação atualizado.");
    await queryClient.invalidateQueries({ queryKey: ["whatsapp-config-numeros"] });
  }

  async function adicionar() {
    const telefone = normalizarTelefone(novoTelefone);
    if (!telefone) { toast.error("Informe um número válido com DDD."); return; }
    setSalvando(true);
    const { error } = await supabase.from("bot_numeros").insert({
      telefone,
      nome: novoNome.trim() || null,
      permitido: novoPermitido,
      ativo: true,
    });
    setSalvando(false);
    if (error) {
      toast.error(error.code === "23505" ? "Esse número já está na lista." : error.message);
      return;
    }
    setNovoTelefone("");
    setNovoNome("");
    await queryClient.invalidateQueries({ queryKey: ["bot-numeros"] });
    toast.success("Número adicionado.");
  }

  async function atualizar(n: Numero, dados: Partial<Numero>) {
    const { error } = await supabase.from("bot_numeros").update(dados).eq("id", n.id);
    if (error) { toast.error(error.message); return; }
    await queryClient.invalidateQueries({ queryKey: ["bot-numeros"] });
  }

  async function excluir(n: Numero) {
    const { error } = await supabase.from("bot_numeros").delete().eq("id", n.id);
    if (error) { toast.error(error.message); return; }
    await queryClient.invalidateQueries({ queryKey: ["bot-numeros"] });
    toast.success("Número removido.");
  }

  if (config.isLoading || numeros.isLoading) return <Skeleton className="h-64" />;

  const lista = numeros.data ?? [];

  return (
    <div className="grid gap-4">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="h-4 w-4" /> Modo de operação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={modo} onValueChange={(v) => void alterarModo(v)} className="gap-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
              <RadioGroupItem value="todos" id="modo-todos" className="mt-1" />
              <span>
                <span className="block font-medium">Todos os números</span>
                <span className="block text-sm text-muted-foreground">
                  O bot responde a todos, exceto os números marcados como bloqueados abaixo.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
              <RadioGroupItem value="somente_liberados" id="modo-liberados" className="mt-1" />
              <span>
                <span className="block font-medium">Somente liberados (modo teste)</span>
                <span className="block text-sm text-muted-foreground">
                  O bot responde apenas aos números liberados e ativos na lista abaixo.
                </span>
              </span>
            </label>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Adicionar número</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
          <div className="grid gap-1">
            <Label htmlFor="numero-telefone">Telefone (com DDD)</Label>
            <Input
              id="numero-telefone"
              value={novoTelefone}
              placeholder="(27) 99999-9999"
              onChange={(e) => setNovoTelefone(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="numero-nome">Nome / observação</Label>
            <Input
              id="numero-nome"
              value={novoNome}
              placeholder="Ex.: celular da loja"
              onChange={(e) => setNovoNome(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 pb-1">
            <Switch id="numero-permitido" checked={novoPermitido} onCheckedChange={setNovoPermitido} />
            <Label htmlFor="numero-permitido">{novoPermitido ? "Liberado" : "Bloqueado"}</Label>
          </div>
          <Button onClick={() => void adicionar()} disabled={salvando}>
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Números cadastrados ({lista.length})</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {lista.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum número cadastrado. No modo "Todos os números" o bot responde a qualquer contato.
            </p>
          ) : (
            lista.map((n) => (
              <div
                key={n.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-40">
                  <p className="font-medium">{formatarTelefone(n.telefone)}</p>
                  <p className="text-sm text-muted-foreground">{n.nome || "Sem identificação"}</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <Badge variant={n.permitido ? "default" : "destructive"}>
                    {n.permitido ? "Liberado" : "Bloqueado"}
                  </Badge>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={n.permitido}
                      onCheckedChange={(v) => void atualizar(n, { permitido: v })}
                    />
                    <span className="text-sm">Liberar bot</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch checked={n.ativo} onCheckedChange={(v) => void atualizar(n, { ativo: v })} />
                    <span className="text-sm">{n.ativo ? "Regra ativa" : "Regra inativa"}</span>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Excluir número">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover número?</AlertDialogTitle>
                        <AlertDialogDescription>
                          A regra de {formatarTelefone(n.telefone)} será apagada e o número passa a seguir o
                          modo de operação escolhido.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void excluir(n)}>Remover</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

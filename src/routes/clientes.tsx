import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Pencil, Plus, Search, Trash2, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppLayout, PageHeader } from "@/components/AppLayout";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { normalizarTelefone } from "@/lib/whatsapp-comum";
import { brl, dataHoraBR } from "@/lib/format";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes | Impressão Digital" },
      { name: "description", content: "Cadastre, consulte e edite os dados dos clientes da gráfica." },
      { property: "og:title", content: "Clientes" },
      { property: "og:description", content: "Cadastro completo de clientes com currículos, orçamentos e pedidos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppLayout>
      <Clientes />
    </AppLayout>
  ),
});

const POR_PAGINA = 20;

type Cliente = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  observacao: string | null;
  created_at: string;
};

type FormCliente = { nome: string; telefone: string; email: string; observacao: string };

const FORM_VAZIO: FormCliente = { nome: "", telefone: "", email: "", observacao: "" };

function Clientes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);

  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormCliente>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [excluir, setExcluir] = useState<Cliente | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["clientes", busca, pagina],
    queryFn: async () => {
      let q = supabase
        .from("clientes")
        .select("id, nome, telefone, email, observacao, created_at", { count: "exact" })
        .order("nome");

      const termo = busca.trim();
      if (termo) {
        const like = `%${termo}%`;
        q = q.or(`nome.ilike.${like},telefone.ilike.${like},email.ilike.${like}`);
      }

      const { data: linhas, error, count } = await q.range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
      if (error) throw error;
      return { linhas: (linhas ?? []) as Cliente[], total: count ?? 0 };
    },
  });

  const totalPaginas = Math.max(1, Math.ceil((data?.total ?? 0) / POR_PAGINA));

  const { data: detalhe, isLoading: carregandoDetalhe } = useQuery({
    queryKey: ["cliente-detalhe", detalheId],
    enabled: !!detalheId,
    queryFn: async () => {
      const id = detalheId!;
      const [cli, cur, orc, ped] = await Promise.all([
        supabase.from("clientes").select("id, nome, telefone, email, observacao, created_at").eq("id", id).maybeSingle(),
        supabase.from("curriculos").select("id, nome_completo, status, updated_at").eq("cliente_id", id).order("updated_at", { ascending: false }),
        supabase.from("orcamentos").select("id, numero, valor_total, status, created_at").eq("cliente_id", id).order("created_at", { ascending: false }).limit(20),
        supabase.from("pedidos").select("id, numero, valor_total, status, created_at").eq("cliente_id", id).order("created_at", { ascending: false }).limit(20),
      ]);
      if (cli.error) throw cli.error;
      return {
        cliente: cli.data as Cliente | null,
        curriculos: cur.data ?? [],
        orcamentos: orc.data ?? [],
        pedidos: ped.data ?? [],
      };
    },
  });

  const abrirNovo = () => {
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setFormAberto(true);
  };

  const abrirEdicao = (c: Cliente) => {
    setEditandoId(c.id);
    setForm({
      nome: c.nome ?? "",
      telefone: c.telefone ?? "",
      email: c.email ?? "",
      observacao: c.observacao ?? "",
    });
    setFormAberto(true);
  };

  const salvar = async () => {
    if (form.nome.trim().length < 2) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    setSalvando(true);
    try {
      const registro = {
        nome: form.nome.trim(),
        telefone: form.telefone.trim() || null,
        telefone_normalizado: form.telefone.trim() ? normalizarTelefone(form.telefone) || null : null,
        email: form.email.trim() || null,
        observacao: form.observacao.trim() || null,
      };

      if (editandoId) {
        const { error } = await supabase.from("clientes").update(registro).eq("id", editandoId);
        if (error) throw new Error(error.message);
        toast.success("Cliente atualizado.");
      } else {
        const { error } = await supabase.from("clientes").insert(registro);
        if (error) throw new Error(error.message);
        toast.success("Cliente cadastrado.");
      }

      setFormAberto(false);
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
      if (editandoId) await queryClient.invalidateQueries({ queryKey: ["cliente-detalhe", editandoId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar o cliente.");
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    setExcluindo(true);
    try {
      const [cur, orc, ped] = await Promise.all([
        supabase.from("curriculos").select("id", { count: "exact", head: true }).eq("cliente_id", excluir.id),
        supabase.from("orcamentos").select("id", { count: "exact", head: true }).eq("cliente_id", excluir.id),
        supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("cliente_id", excluir.id),
      ]);

      const vinculos: string[] = [];
      if ((cur.count ?? 0) > 0) vinculos.push(`${cur.count} currículo(s)`);
      if ((orc.count ?? 0) > 0) vinculos.push(`${orc.count} orçamento(s)`);
      if ((ped.count ?? 0) > 0) vinculos.push(`${ped.count} pedido(s)`);

      if (vinculos.length > 0) {
        toast.error(`Não é possível excluir: o cliente possui ${vinculos.join(", ")} vinculado(s).`);
        return;
      }

      const { error } = await supabase.from("clientes").delete().eq("id", excluir.id);
      if (error) throw new Error(error.message);
      toast.success("Cliente excluído.");
      setExcluir(null);
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir o cliente.");
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <>
      <PageHeader titulo="CLIENTES" subtitulo="Consulte e gerencie os dados cadastrais dos clientes" />

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="busca-cliente">Pesquisar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="busca-cliente"
                className="pl-9"
                placeholder="Nome, telefone ou e-mail"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPagina(0);
                }}
              />
            </div>
          </div>
          <Button onClick={abrirNovo}>
            <Plus className="mr-1 h-4 w-4" /> NOVO CLIENTE
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (data?.linhas.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
              <Users className="h-8 w-8" />
              <p>Nenhum cliente encontrado.</p>
            </div>
          ) : (
            <>
              {/* TABELA (desktop) */}
              <table className="hidden w-full text-sm md:table">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Nome</th>
                    <th className="p-3">Telefone</th>
                    <th className="p-3">E-mail</th>
                    <th className="p-3">Cadastrado em</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.linhas.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="p-3 font-medium">{c.nome}</td>
                      <td className="p-3">{c.telefone || "-"}</td>
                      <td className="p-3">{c.email || "-"}</td>
                      <td className="p-3">{dataHoraBR(c.created_at)}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setDetalheId(c.id)}>
                            <Eye className="mr-1 h-4 w-4" /> Ver
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => abrirEdicao(c)}>
                            <Pencil className="mr-1 h-4 w-4" /> Editar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setExcluir(c)}>
                            <Trash2 className="mr-1 h-4 w-4" /> Excluir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* CARDS (mobile) */}
              <div className="space-y-2 p-3 md:hidden">
                {data?.linhas.map((c) => (
                  <div key={c.id} className="rounded-lg border p-3">
                    <p className="font-semibold">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">{c.telefone || "sem telefone"}</p>
                    <p className="text-xs text-muted-foreground">{c.email || "sem e-mail"}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setDetalheId(c.id)}>
                        <Eye className="mr-1 h-4 w-4" /> Ver
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => abrirEdicao(c)}>
                        <Pencil className="mr-1 h-4 w-4" /> Editar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setExcluir(c)}>
                        <Trash2 className="mr-1 h-4 w-4" /> Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {(data?.total ?? 0) > POR_PAGINA && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {pagina + 1} de {totalPaginas} — {data?.total} clientes
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagina + 1 >= totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      {/* NOVO / EDITAR */}
      <Dialog open={formAberto} onOpenChange={setFormAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="c-nome">Nome *</Label>
              <Input id="c-nome" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="c-tel">Telefone</Label>
              <Input
                id="c-tel"
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="c-email">E-mail</Label>
              <Input id="c-email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="c-obs">Observação</Label>
              <Textarea
                id="c-obs"
                rows={3}
                value={form.observacao}
                onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DETALHES */}
      <Dialog open={!!detalheId} onOpenChange={(v) => !v && setDetalheId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detalhe?.cliente?.nome ?? "Cliente"}</DialogTitle>
          </DialogHeader>

          {carregandoDetalhe || !detalhe?.cliente ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="space-y-5 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <p><span className="text-muted-foreground">Telefone:</span> {detalhe.cliente.telefone || "-"}</p>
                <p><span className="text-muted-foreground">E-mail:</span> {detalhe.cliente.email || "-"}</p>
                <p className="sm:col-span-2">
                  <span className="text-muted-foreground">Cadastrado em:</span> {dataHoraBR(detalhe.cliente.created_at)}
                </p>
                {detalhe.cliente.observacao && (
                  <p className="sm:col-span-2">
                    <span className="text-muted-foreground">Observação:</span> {detalhe.cliente.observacao}
                  </p>
                )}
              </div>

              <div>
                <h3 className="mb-2 font-semibold">Currículos ({detalhe.curriculos.length})</h3>
                {detalhe.curriculos.length === 0 ? (
                  <p className="text-muted-foreground">Nenhum currículo vinculado.</p>
                ) : (
                  <div className="space-y-2">
                    {detalhe.curriculos.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="flex w-full items-center justify-between rounded-lg border p-2 text-left hover:bg-muted/50"
                        onClick={() => navigate({ to: "/curriculos/$id", params: { id: c.id } })}
                      >
                        <span>{c.nome_completo || "Currículo"}</span>
                        <Badge variant={c.status === "completo" ? "default" : "secondary"}>
                          {c.status === "completo" ? "Completo" : "Rascunho"}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-2 font-semibold">Pedidos ({detalhe.pedidos.length})</h3>
                {detalhe.pedidos.length === 0 ? (
                  <p className="text-muted-foreground">Nenhum pedido vinculado.</p>
                ) : (
                  <div className="space-y-1">
                    {detalhe.pedidos.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg border p-2">
                        <span>
                          #{p.numero} — {dataHoraBR(p.created_at)}
                        </span>
                        <span className="flex items-center gap-2">
                          <Badge variant="secondary">{p.status}</Badge>
                          <strong>{brl(Number(p.valor_total ?? 0))}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-2 font-semibold">Orçamentos ({detalhe.orcamentos.length})</h3>
                {detalhe.orcamentos.length === 0 ? (
                  <p className="text-muted-foreground">Nenhum orçamento vinculado.</p>
                ) : (
                  <div className="space-y-1">
                    {detalhe.orcamentos.map((o) => (
                      <div key={o.id} className="flex items-center justify-between rounded-lg border p-2">
                        <span>
                          #{o.numero} — {dataHoraBR(o.created_at)}
                        </span>
                        <span className="flex items-center gap-2">
                          <Badge variant="secondary">{o.status}</Badge>
                          <strong>{brl(Number(o.valor_total ?? 0))}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            {detalhe?.cliente && (
              <Button
                variant="outline"
                onClick={() => {
                  const c = detalhe.cliente!;
                  setDetalheId(null);
                  abrirEdicao(c);
                }}
              >
                <Pencil className="mr-1 h-4 w-4" /> Editar
              </Button>
            )}
            <Button onClick={() => setDetalheId(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EXCLUIR */}
      <AlertDialog open={!!excluir} onOpenChange={(v) => !v && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              O cadastro de {excluir?.nome} será excluído permanentemente. Clientes com currículos,
              orçamentos ou pedidos vinculados não podem ser excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={excluindo}
              onClick={(e) => {
                e.preventDefault();
                void confirmarExclusao();
              }}
            >
              {excluindo ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

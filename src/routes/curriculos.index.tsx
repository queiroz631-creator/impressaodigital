import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileUser, Link2, Plus, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppLayout, PageHeader } from "@/components/AppLayout";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { cpfValido, formatarCpf, formatarTelefone, somenteNumeros } from "@/lib/curriculo";
import { normalizarTelefone } from "@/lib/whatsapp-comum";
import { dataBR, dataHoraBR } from "@/lib/format";
import { gerarLinkNovoCurriculo } from "@/lib/curriculo.functions";

export const Route = createFileRoute("/curriculos/")({
  head: () => ({
    meta: [
      { title: "Currículo Vitae | Impressão Digital" },
      { name: "description", content: "Cadastre, edite e envie currículos profissionais dos clientes." },
      { property: "og:title", content: "Currículo Vitae" },
      { property: "og:description", content: "Gerencie os currículos cadastrados dos clientes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppLayout>
      <Curriculos />
    </AppLayout>
  ),
});

const POR_PAGINA = 20;

function Curriculos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [ordem, setOrdem] = useState("updated_at");
  const [pagina, setPagina] = useState(0);

  const [novoAberto, setNovoAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [criando, setCriando] = useState(false);

  const gerarNovoLink = useServerFn(gerarLinkNovoCurriculo);
  const [linkNovoAberto, setLinkNovoAberto] = useState(false);
  const [linkNovoUrl, setLinkNovoUrl] = useState("");
  const [linkNovoExpira, setLinkNovoExpira] = useState("");
  const [gerandoLink, setGerandoLink] = useState(false);

  async function abrirLinkNovoCurriculo() {
    setGerandoLink(true);
    try {
      const r = await gerarNovoLink();
      setLinkNovoUrl(r.url);
      setLinkNovoExpira(r.expiraEm);
      setLinkNovoAberto(true);
      await navigator.clipboard.writeText(r.url);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível gerar o link.");
    } finally {
      setGerandoLink(false);
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["curriculos", busca, filtro, ordem, pagina],
    queryFn: async () => {
      let q = supabase
        .from("curriculos")
        .select("id, nome_completo, cpf, telefone_principal, data_nascimento, status, updated_at", {
          count: "exact",
        });

      if (filtro !== "todos") q = q.eq("status", filtro);
      const termo = busca.trim();
      if (termo) {
        const numeros = somenteNumeros(termo);
        const partes = [`nome_completo.ilike.%${termo}%`];
        if (numeros) partes.push(`cpf.ilike.%${numeros}%`, `telefone_principal.ilike.%${numeros}%`);
        q = q.or(partes.join(","));
      }

      q = q.order(ordem, { ascending: ordem !== "updated_at" });
      q = q.range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);

      const { data: linhas, count, error } = await q;
      if (error) throw error;
      return { linhas: linhas ?? [], total: count ?? 0 };
    },
  });

  const totalPaginas = useMemo(
    () => Math.max(1, Math.ceil((data?.total ?? 0) / POR_PAGINA)),
    [data?.total],
  );

  const criar = async () => {
    const cpfNumeros = somenteNumeros(cpf);
    if (!nome.trim()) {
      toast.error("Informe o nome completo.");
      return;
    }
    if (!cpfValido(cpfNumeros)) {
      toast.error("CPF inválido.");
      return;
    }
    if (normalizarTelefone(telefone).length < 10) {
      toast.error("Informe um telefone válido.");
      return;
    }

    setCriando(true);
    try {
      const { data: existente } = await supabase
        .from("curriculos")
        .select("id")
        .eq("cpf", cpfNumeros)
        .maybeSingle();

      if (existente) {
        toast.error("Este CPF já possui um currículo cadastrado.");
        navigate({ to: "/curriculos/$id", params: { id: existente.id } });
        return;
      }

      const telNormalizado = normalizarTelefone(telefone);
      const { data: cliente } = await supabase
        .from("clientes")
        .select("id")
        .eq("telefone_normalizado", telNormalizado)
        .maybeSingle();

      let clienteId = cliente?.id ?? null;
      if (!clienteId) {
        const { data: novo, error: erroCliente } = await supabase
          .from("clientes")
          .insert({
            nome: nome.trim(),
            telefone: formatarTelefone(telefone),
            telefone_normalizado: telNormalizado,
          })
          .select("id")
          .single();
        if (erroCliente) throw erroCliente;
        clienteId = novo.id;
      }

      const { data: curriculo, error } = await supabase
        .from("curriculos")
        .insert({
          cliente_id: clienteId,
          cpf: cpfNumeros,
          nome_completo: nome.trim(),
          telefone_principal: formatarTelefone(telefone),
          status: "rascunho",
        })
        .select("id")
        .single();
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["curriculos"] });
      setNovoAberto(false);
      setNome("");
      setCpf("");
      setTelefone("");
      navigate({ to: "/curriculos/$id", params: { id: curriculo.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o currículo.");
    } finally {
      setCriando(false);
    }
  };

  return (
    <>
      <PageHeader titulo="CURRÍCULO VITAE" subtitulo="Gerencie os currículos cadastrados dos clientes" />

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="busca">Pesquisar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="busca"
                className="pl-9"
                placeholder="Nome, telefone ou CPF"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPagina(0);
                }}
              />
            </div>
          </div>

          <div className="w-full sm:w-44">
            <Label>Situação</Label>
            <Select
              value={filtro}
              onValueChange={(v) => {
                setFiltro(v);
                setPagina(0);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="rascunho">Rascunhos</SelectItem>
                <SelectItem value="completo">Completos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-52">
            <Label>Ordenar por</Label>
            <Select value={ordem} onValueChange={setOrdem}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated_at">Última alteração</SelectItem>
                <SelectItem value="nome_completo">Nome</SelectItem>
                <SelectItem value="data_nascimento">Data de nascimento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => setNovoAberto(true)}>
            <Plus className="mr-1 h-4 w-4" /> NOVO CURRÍCULO
          </Button>
          <Button variant="outline" onClick={abrirLinkNovoCurriculo} disabled={gerandoLink}>
            <Link2 className="mr-1 h-4 w-4" /> LINK PARA NOVO CURRÍCULO
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (data?.linhas.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
              <FileUser className="h-8 w-8" />
              <p>Nenhum currículo encontrado.</p>
            </div>
          ) : (
            <>
              {/* TABELA (desktop) */}
              <table className="hidden w-full text-sm md:table">
                <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Nome</th>
                    <th className="p-3">Telefone</th>
                    <th className="p-3">Nascimento</th>
                    <th className="p-3">Última alteração</th>
                    <th className="p-3">Situação</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.linhas.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="p-3 font-medium">{c.nome_completo || "-"}</td>
                      <td className="p-3">{c.telefone_principal || "-"}</td>
                      <td className="p-3">{dataBR(c.data_nascimento)}</td>
                      <td className="p-3">{dataHoraBR(c.updated_at)}</td>
                      <td className="p-3">
                        <Badge variant={c.status === "completo" ? "default" : "secondary"}>
                          {c.status === "completo" ? "Completo" : "Rascunho"}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate({ to: "/curriculos/$id", params: { id: c.id } })}
                        >
                          Abrir
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* CARDS (mobile) */}
              <div className="space-y-2 p-3 md:hidden">
                {data?.linhas.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate({ to: "/curriculos/$id", params: { id: c.id } })}
                    className="w-full rounded-lg border p-3 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{c.nome_completo || "-"}</p>
                      <Badge variant={c.status === "completo" ? "default" : "secondary"}>
                        {c.status === "completo" ? "Completo" : "Rascunho"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.telefone_principal} • {dataHoraBR(c.updated_at)}
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {(data?.total ?? 0) > POR_PAGINA && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {pagina + 1} de {totalPaginas} — {data?.total} currículos
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

      <Dialog open={novoAberto} onOpenChange={setNovoAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo currículo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="n-nome">Nome completo *</Label>
              <Input id="n-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="n-cpf">CPF *</Label>
              <Input
                id="n-cpf"
                value={cpf}
                onChange={(e) => setCpf(formatarCpf(e.target.value))}
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <Label htmlFor="n-tel">Telefone *</Label>
              <Input
                id="n-tel"
                value={telefone}
                onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={criar} disabled={criando}>
              Criar currículo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

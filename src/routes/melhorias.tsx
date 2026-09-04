import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { dataHoraBR } from "@/lib/format";

export const Route = createFileRoute("/melhorias")({
  component: () => (
    <AppLayout>
      <Melhorias />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Melhorias | Calculadora de Impressão Digital" },
      {
        name: "description",
        content: "Cadastre melhorias do sistema e indique em qual tela cada uma deve ser aplicada.",
      },
      { property: "og:title", content: "Melhorias | Calculadora de Impressão Digital" },
      {
        property: "og:description",
        content: "Lista de melhorias planejadas por tela do sistema.",
      },
    ],
  }),
});

const TELAS = [
  "Dashboard",
  "Calculadora",
  "Orçamentos",
  "Currículo Vitae",
  "Clientes",
  "WhatsApp",
  "Configurar Bot",
  "Configurar Preços",
  "Configurações",
  "Melhorias",
  "Geral / Sistema",
];

type Melhoria = {
  id: string;
  titulo: string;
  descricao: string | null;
  tela: string;
  status: string;
  executada: boolean;
  created_at: string;
};

function Melhorias() {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tela, setTela] = useState<string>(TELAS[0]!);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const { data: melhorias, isLoading } = useQuery({
    queryKey: ["melhorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("melhorias")
        .select("id, titulo, descricao, tela, status, executada, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Melhoria[];
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("melhorias")
        .insert({ titulo: titulo.trim(), descricao: descricao.trim() || null, tela });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitulo("");
      setDescricao("");
      toast.success("Melhoria adicionada");
      qc.invalidateQueries({ queryKey: ["melhorias"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("melhorias")
        .update({ titulo: titulo.trim(), descricao: descricao.trim() || null, tela })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setTitulo("");
      setDescricao("");
      setEditandoId(null);
      toast.success("Melhoria atualizada");
      qc.invalidateQueries({ queryKey: ["melhorias"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alternarStatus = useMutation({
    mutationFn: async (m: Melhoria) => {
      const { error } = await supabase
        .from("melhorias")
        .update({ status: m.status === "concluida" ? "pendente" : "concluida" })
        .eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["melhorias"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("melhorias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Melhoria removida");
      qc.invalidateQueries({ queryKey: ["melhorias"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const iniciarEdicao = (m: Melhoria) => {
    setEditandoId(m.id);
    setTitulo(m.titulo);
    setDescricao(m.descricao || "");
    setTela(m.tela);
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setTitulo("");
    setDescricao("");
    setTela(TELAS[0]!);
  };

  return (
    <div>
      <PageHeader titulo="Melhorias" subtitulo="Registre melhorias e a tela onde serão aplicadas" />

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">
              {editandoId ? "Editar melhoria" : "Nova melhoria"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título</Label>
              <Input
                id="titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Resumo da melhoria"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tela">Tela</Label>
              <Select value={tela} onValueChange={setTela}>
                <SelectTrigger id="tela">
                  <SelectValue placeholder="Selecione a tela" />
                </SelectTrigger>
                <SelectContent>
                  {TELAS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                rows={5}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Detalhe o que deve ser feito"
              />
            </div>

            {editandoId ? (
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={!titulo.trim() || atualizar.isPending}
                  onClick={() => atualizar.mutate(editandoId)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Salvar alterações
                </Button>
                <Button variant="outline" onClick={cancelarEdicao}>
                  <X className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button
                className="w-full"
                disabled={!titulo.trim() || criar.isPending}
                onClick={() => criar.mutate()}
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar melhoria
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">
              Melhorias cadastradas {melhorias?.length ? `(${melhorias.length})` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {!isLoading && !melhorias?.length && (
              <p className="text-sm text-muted-foreground">Nenhuma melhoria cadastrada ainda.</p>
            )}
            {melhorias?.map((m, idx) => {
              const numero = (melhorias?.length ?? 0) - idx;
              return (
              <div
                key={m.id}
                className={
                  m.executada && m.status !== "concluida"
                    ? "flex items-start justify-between gap-3 rounded-lg border-2 border-green-500 p-3"
                    : "flex items-start justify-between gap-3 rounded-lg border p-3"
                }
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground min-w-[1.5rem]">
                      {numero}.
                    </span>
                    <span
                      className={
                        m.status === "concluida"
                          ? "font-semibold line-through text-muted-foreground"
                          : "font-semibold"
                      }
                    >
                      {m.titulo}
                    </span>
                    <Badge variant="secondary">{m.tela}</Badge>
                    {m.executada && m.status !== "concluida" && (
                      <Badge className="bg-green-600 text-white hover:bg-green-600">Executada</Badge>
                    )}
                  </div>
                  {m.descricao && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {m.descricao}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">{dataHoraBR(m.created_at)}</p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => alternarStatus.mutate(m)}
                    disabled={alternarStatus.isPending}
                  >
                    {m.status === "concluida" ? "Reabrir" : "Concluir"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Editar melhoria"
                    onClick={() => iniciarEdicao(m)}
                    disabled={editandoId === m.id}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Excluir melhoria"
                    onClick={() => excluir.mutate(m.id)}
                    disabled={excluir.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )})}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

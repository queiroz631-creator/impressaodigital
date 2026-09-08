import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, Pencil, X, Zap, ImageIcon } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/mensagens-rapidas")({
  component: () => (
    <AppLayout>
      <MensagensRapidas />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Mensagens Rápidas | Impressão Digital" },
      {
        name: "description",
        content: "Cadastre mensagens rápidas com atalho para usar nas conversas do WhatsApp.",
      },
      { property: "og:title", content: "Mensagens Rápidas | Impressão Digital" },
      {
        property: "og:description",
        content: "Mensagens prontas com atalho para o atendimento no WhatsApp.",
      },
    ],
  }),
});

type MensagemRapida = {
  id: string;
  titulo: string;
  atalho: string;
  tipo: string;
  texto: string | null;
  imagem_path: string | null;
  imagem_nome: string | null;
  mostrar_no_botao: boolean;
  ativo: boolean;
  ordem: number;
};

const TIPOS = [
  { valor: "texto", rotulo: "Somente texto" },
  { valor: "imagem", rotulo: "Somente imagem" },
  { valor: "texto_imagem", rotulo: "Texto + imagem" },
];

function rotuloTipo(tipo: string) {
  return TIPOS.find((t) => t.valor === tipo)?.rotulo ?? tipo;
}

function MensagensRapidas() {
  const qc = useQueryClient();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [atalho, setAtalho] = useState("");
  const [tipo, setTipo] = useState("texto");
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [mostrarNoBotao, setMostrarNoBotao] = useState(true);
  const [ordem, setOrdem] = useState("0");
  const [ativo, setAtivo] = useState(true);

  const { data: mensagens, isLoading } = useQuery({
    queryKey: ["mensagens-rapidas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mensagens_rapidas")
        .select("id, titulo, atalho, tipo, texto, imagem_path, imagem_nome, mostrar_no_botao, ativo, ordem")
        .order("ordem", { ascending: true })
        .order("titulo", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MensagemRapida[];
    },
  });

  const usaImagem = tipo === "imagem" || tipo === "texto_imagem";
  const usaTexto = tipo === "texto" || tipo === "texto_imagem";

  function limpar() {
    setEditandoId(null);
    setTitulo("");
    setAtalho("");
    setTipo("texto");
    setTexto("");
    setArquivo(null);
    setMostrarNoBotao(true);
    setOrdem("0");
    setAtivo(true);
  }

  function iniciarEdicao(m: MensagemRapida) {
    setEditandoId(m.id);
    setTitulo(m.titulo);
    setAtalho(m.atalho);
    setTipo(m.tipo);
    setTexto(m.texto ?? "");
    setArquivo(null);
    setMostrarNoBotao(m.mostrar_no_botao);
    setOrdem(String(m.ordem));
    setAtivo(m.ativo);
  }

  async function enviarImagemSeHouver(existente: MensagemRapida | null) {
    if (!usaImagem) return { imagem_path: null, imagem_nome: null };
    if (!arquivo) {
      if (existente?.imagem_path) {
        return { imagem_path: existente.imagem_path, imagem_nome: existente.imagem_nome };
      }
      throw new Error("Selecione uma imagem.");
    }
    const extensao = arquivo.name.split(".").pop() ?? "png";
    const path = `${crypto.randomUUID()}.${extensao}`;
    const { error } = await supabase.storage.from("mensagens-rapidas").upload(path, arquivo, {
      contentType: arquivo.type || "image/png",
    });
    if (error) throw error;
    if (existente?.imagem_path) {
      await supabase.storage.from("mensagens-rapidas").remove([existente.imagem_path]);
    }
    return { imagem_path: path, imagem_nome: arquivo.name };
  }

  const salvar = useMutation({
    mutationFn: async () => {
      const existente = editandoId ? (mensagens?.find((m) => m.id === editandoId) ?? null) : null;
      const imagem = await enviarImagemSeHouver(existente);
      const registro = {
        titulo: titulo.trim(),
        atalho: atalho.trim().replace(/^\/+/, "").toLowerCase(),
        tipo,
        texto: usaTexto ? texto.trim() : null,
        imagem_path: imagem.imagem_path,
        imagem_nome: imagem.imagem_nome,
        mostrar_no_botao: mostrarNoBotao,
        ordem: Number.parseInt(ordem, 10) || 0,
        ativo,
      };
      if (editandoId) {
        const { error } = await supabase.from("mensagens_rapidas").update(registro).eq("id", editandoId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mensagens_rapidas").insert(registro);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editandoId ? "Mensagem atualizada." : "Mensagem adicionada.");
      limpar();
      qc.invalidateQueries({ queryKey: ["mensagens-rapidas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alternarAtivo = useMutation({
    mutationFn: async (m: MensagemRapida) => {
      const { error } = await supabase.from("mensagens_rapidas").update({ ativo: !m.ativo }).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mensagens-rapidas"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (m: MensagemRapida) => {
      const { error } = await supabase.from("mensagens_rapidas").delete().eq("id", m.id);
      if (error) throw error;
      if (m.imagem_path) await supabase.storage.from("mensagens-rapidas").remove([m.imagem_path]);
    },
    onSuccess: () => {
      toast.success("Mensagem removida.");
      qc.invalidateQueries({ queryKey: ["mensagens-rapidas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const formularioValido =
    titulo.trim() &&
    atalho.trim() &&
    (!usaTexto || texto.trim()) &&
    (!usaImagem || arquivo || mensagens?.find((m) => m.id === editandoId)?.imagem_path);

  return (
    <div>
      <PageHeader
        titulo="Mensagens Rápidas"
        subtitulo="Cadastre mensagens prontas e use com o atalho / na conversa do WhatsApp"
      />

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="shadow-card lg:sticky lg:top-6 lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto">
          <CardHeader>
            <CardTitle className="text-base">
              {editandoId ? "Editar mensagem rápida" : "Nova mensagem rápida"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título</Label>
              <Input
                id="titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Tabela de preços"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="atalho">Atalho (digitado após /)</Label>
              <Input
                id="atalho"
                value={atalho}
                onChange={(e) => setAtalho(e.target.value)}
                placeholder="Ex.: precos"
              />
              <p className="text-xs text-muted-foreground">
                Na conversa, digite /{atalho.trim() || "atalho"} para usar.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.valor} value={t.valor}>
                      {t.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {usaTexto && (
              <div className="space-y-2">
                <Label htmlFor="texto">Texto</Label>
                <Textarea
                  id="texto"
                  rows={5}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Texto enviado ao cliente"
                />
              </div>
            )}

            {usaImagem && (
              <div className="space-y-2">
                <Label htmlFor="imagem">Imagem</Label>
                <Input
                  id="imagem"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                />
                {editandoId && !arquivo && mensagens?.find((m) => m.id === editandoId)?.imagem_nome && (
                  <p className="text-xs text-muted-foreground">
                    Imagem atual: {mensagens.find((m) => m.id === editandoId)?.imagem_nome}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="mostrar"
                checked={mostrarNoBotao}
                onCheckedChange={(v) => setMostrarNoBotao(v === true)}
              />
              <Label htmlFor="mostrar" className="cursor-pointer font-normal">
                Mostrar no botão de mensagens rápidas da conversa
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ordem">Ordem</Label>
                <Input id="ordem" type="number" value={ordem} onChange={(e) => setOrdem(e.target.value)} />
              </div>
              <div className="flex items-center gap-2 pt-7">
                <Checkbox id="ativo" checked={ativo} onCheckedChange={(v) => setAtivo(v === true)} />
                <Label htmlFor="ativo" className="cursor-pointer font-normal">
                  Ativa
                </Label>
              </div>
            </div>

            {editandoId ? (
              <div className="flex gap-2">
                <Button className="flex-1" disabled={!formularioValido || salvar.isPending} onClick={() => salvar.mutate()}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Salvar alterações
                </Button>
                <Button variant="outline" onClick={limpar}>
                  <X className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button className="w-full" disabled={!formularioValido || salvar.isPending} onClick={() => salvar.mutate()}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar mensagem
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">
              Mensagens cadastradas {mensagens?.length ? `(${mensagens.length})` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {!isLoading && !mensagens?.length && (
              <p className="text-sm text-muted-foreground">Nenhuma mensagem rápida cadastrada ainda.</p>
            )}
            {mensagens?.map((m) => (
              <div
                key={m.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className={m.ativo ? "font-semibold" : "font-semibold text-muted-foreground line-through"}>
                      {m.titulo}
                    </span>
                    <Badge variant="secondary">/{m.atalho}</Badge>
                    <Badge variant="outline">{rotuloTipo(m.tipo)}</Badge>
                    {m.mostrar_no_botao && <Badge className="bg-green-600 text-white hover:bg-green-600">No botão</Badge>}
                  </div>
                  {m.texto && (
                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{m.texto}</p>
                  )}
                  {m.imagem_nome && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <ImageIcon className="h-3.5 w-3.5" /> {m.imagem_nome}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => alternarAtivo.mutate(m)}
                    disabled={alternarAtivo.isPending}
                  >
                    {m.ativo ? "Desativar" : "Ativar"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Editar mensagem"
                    onClick={() => iniciarEdicao(m)}
                    disabled={editandoId === m.id}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Excluir mensagem"
                    onClick={() => excluir.mutate(m)}
                    disabled={excluir.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

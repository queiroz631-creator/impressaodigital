import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, MessageSquarePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  ACOES_PRIMEIRO_CONTATO,
  CONDICOES_PRIMEIRO_CONTATO,
  ENVIOS_PRIMEIRO_CONTATO,
  rotuloAcaoPrimeiroContato,
  rotuloCondicao,
} from "@/lib/bot-fluxos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmarExclusao } from "@/components/ConfirmarExclusao";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Regra {
  id: string;
  nome: string;
  condicao: string;
  palavras: string[];
  mensagem: string;
  acao: string;
  destino_fluxo_id: string | null;
  destino_resposta_id: string | null;
  delay_segundos: number;
  ordem: number;
  ativo: boolean;
}

interface Basico {
  id: string;
  nome: string;
}

const NENHUM = "__nenhum__";

interface Form {
  nome: string;
  condicao: string;
  palavras: string;
  mensagem: string;
  acao: string;
  destino_fluxo_id: string;
  destino_resposta_id: string;
  delay_segundos: number;
  ativo: boolean;
}

const VAZIO: Form = {
  nome: "",
  condicao: "saudacao",
  palavras: "",
  mensagem: "",
  acao: "aguardar",
  destino_fluxo_id: NENHUM,
  destino_resposta_id: NENHUM,
  delay_segundos: 0,
  ativo: true,
};

/** Aba PRIMEIRO CONTATO: regras que identificam a intenção da primeira mensagem. */
export function PrimeiroContatoPainel() {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<Regra | "nova" | null>(null);
  const [form, setForm] = useState<Form>(VAZIO);

  const regras = useQuery({
    queryKey: ["bot-primeiro-contato"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bot_primeiro_contato").select("*").order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as Regra[];
    },
  });

  const fluxos = useQuery({
    queryKey: ["bot-fluxos-lista"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bot_fluxos").select("id, nome").order("ordem");
      if (error) throw error;
      return (data ?? []) as Basico[];
    },
  });

  const respostas = useQuery({
    queryKey: ["bot-respostas-lista"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bot_respostas").select("id, titulo").order("ordem");
      if (error) throw error;
      return ((data ?? []) as { id: string; titulo: string }[]).map((r) => ({ id: r.id, nome: r.titulo }));
    },
  });

  useEffect(() => {
    if (!editando) return;
    if (editando === "nova") {
      setForm(VAZIO);
      return;
    }
    setForm({
      nome: editando.nome,
      condicao: editando.condicao,
      palavras: (editando.palavras ?? []).join(", "),
      mensagem: editando.mensagem ?? "",
      acao: editando.acao,
      destino_fluxo_id: editando.destino_fluxo_id ?? NENHUM,
      destino_resposta_id: editando.destino_resposta_id ?? NENHUM,
      delay_segundos: editando.delay_segundos ?? 0,
      ativo: editando.ativo,
    });
  }, [editando]);

  const lista = regras.data ?? [];
  const usaPalavras = CONDICOES_PRIMEIRO_CONTATO.find((c) => c.valor === form.condicao)?.usaPalavras ?? false;
  const usaFluxo = form.acao === "iniciar_fluxo" || form.acao === "confirmar_fluxo";
  const usaResposta = form.acao === "resposta";

  function recarregar() {
    void queryClient.invalidateQueries({ queryKey: ["bot-primeiro-contato"] });
  }

  async function salvar() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome da regra.");
      return;
    }
    const dados = {
      nome: form.nome.trim(),
      condicao: form.condicao,
      palavras: usaPalavras
        ? form.palavras
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean)
        : [],
      mensagem: form.mensagem,
      acao: form.acao,
      destino_fluxo_id: usaFluxo && form.destino_fluxo_id !== NENHUM ? form.destino_fluxo_id : null,
      destino_resposta_id: usaResposta && form.destino_resposta_id !== NENHUM ? form.destino_resposta_id : null,
      delay_segundos: Math.min(60, Math.max(0, Number(form.delay_segundos) || 0)),
      ativo: form.ativo,
    };

    const erro =
      editando === "nova"
        ? (
            await supabase
              .from("bot_primeiro_contato")
              .insert({ ...dados, ordem: Math.max(0, ...lista.map((r) => r.ordem)) + 1 })
          ).error
        : (await supabase.from("bot_primeiro_contato").update(dados).eq("id", (editando as Regra).id)).error;

    if (erro) {
      toast.error(erro.message);
      return;
    }
    toast.success("Regra salva.");
    setEditando(null);
    recarregar();
  }

  async function alternar(r: Regra) {
    await supabase.from("bot_primeiro_contato").update({ ativo: !r.ativo }).eq("id", r.id);
    recarregar();
  }

  async function excluir(r: Regra) {
    const { error } = await supabase.from("bot_primeiro_contato").delete().eq("id", r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Regra excluída.");
    recarregar();
  }

  async function mover(r: Regra, direcao: -1 | 1) {
    const ordenadas = [...lista].sort((a, b) => a.ordem - b.ordem);
    const i = ordenadas.findIndex((x) => x.id === r.id);
    const alvo = ordenadas[i + direcao];
    if (!alvo) return;
    await supabase.from("bot_primeiro_contato").update({ ordem: alvo.ordem }).eq("id", r.id);
    await supabase.from("bot_primeiro_contato").update({ ordem: r.ordem }).eq("id", alvo.id);
    recarregar();
  }

  if (regras.isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">PRIMEIRO CONTATO</h3>
          <p className="text-sm text-muted-foreground">
            Identifique a intenção da primeira mensagem do dia e decida o que o bot faz.
          </p>
        </div>
        <Button onClick={() => setEditando("nova")}>
          <Plus className="h-4 w-4" /> ADICIONAR REGRA
        </Button>
      </div>

      {lista.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma regra cadastrada. O bot seguirá com as respostas automáticas.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {[...lista]
          .sort((a, b) => a.ordem - b.ordem)
          .map((r, i, arr) => (
            <Card key={r.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquarePlus className="h-4 w-4 text-primary" />
                    {i + 1}. {r.nome}
                    <Badge variant={r.ativo ? "default" : "secondary"}>{r.ativo ? "Ativo" : "Inativo"}</Badge>
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {rotuloCondicao(r.condicao)} → {rotuloAcaoPrimeiroContato(r.acao)}
                  </p>
                  {r.mensagem?.trim() && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.mensagem}</p>
                  )}
                  {(r.palavras ?? []).length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Palavras-chave: {(r.palavras ?? []).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => void mover(r, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={i === arr.length - 1}
                    onClick={() => void mover(r, 1)}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditando(r)}>
                    <Pencil className="h-4 w-4" /> EDITAR
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void alternar(r)}>
                    {r.ativo ? "DESATIVAR" : "ATIVAR"}
                  </Button>
                  <ConfirmarExclusao
                    titulo="Excluir regra?"
                    descricao={`A regra "${r.nome}" será removida.`}
                    onConfirmar={() => void excluir(r)}
                  >
                    <Button size="icon" variant="ghost" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </ConfirmarExclusao>
                </div>
              </CardHeader>
            </Card>
          ))}
      </div>

      <Dialog open={editando !== null} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editando === "nova" ? "Nova regra" : "Editar regra"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label>Nome da regra</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>

            <div className="grid gap-1">
              <Label>Quando acontecer</Label>
              <Select value={form.condicao} onValueChange={(v) => setForm({ ...form, condicao: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDICOES_PRIMEIRO_CONTATO.map((c) => (
                    <SelectItem key={c.valor} value={c.valor}>
                      {c.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {usaPalavras && (
              <div className="grid gap-1">
                <Label>Palavras-chave (separadas por vírgula)</Label>
                <Input
                  value={form.palavras}
                  onChange={(e) => setForm({ ...form, palavras: e.target.value })}
                  placeholder="valor, preço, orçamento, imprimir"
                />
              </div>
            )}

            <div className="grid gap-1">
              <Label>Mensagem enviada</Label>
              <Textarea
                rows={3}
                value={form.mensagem}
                onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Use {"{nome}"}, {"{telefone}"} e {"{saudacao}"}. Em branco, o bot não envia nada.
              </p>
            </div>

            <div className="grid gap-1">
              <Label>O que o bot faz</Label>
              <Select value={form.acao} onValueChange={(v) => setForm({ ...form, acao: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACOES_PRIMEIRO_CONTATO.map((a) => (
                    <SelectItem key={a.valor} value={a.valor}>
                      {a.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {usaFluxo && (
              <div className="grid gap-1">
                <Label>Fluxo de destino</Label>
                <Select
                  value={form.destino_fluxo_id}
                  onValueChange={(v) => setForm({ ...form, destino_fluxo_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NENHUM}>Fluxo inicial</SelectItem>
                    {(fluxos.data ?? []).map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {usaResposta && (
              <div className="grid gap-1">
                <Label>Resposta automática</Label>
                <Select
                  value={form.destino_resposta_id}
                  onValueChange={(v) => setForm({ ...form, destino_resposta_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NENHUM}>Nenhuma</SelectItem>
                    {(respostas.data ?? []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-1">
              <Label>Aguardar antes da ação (segundos)</Label>
              <Input
                type="number"
                min={0}
                max={60}
                value={form.delay_segundos}
                onChange={(e) => setForm({ ...form, delay_segundos: Number(e.target.value) })}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <Label>Regra ativa</Label>
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>
              CANCELAR
            </Button>
            <Button onClick={() => void salvar()}>SALVAR</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

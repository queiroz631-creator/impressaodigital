import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ACOES_RESPOSTA } from "@/lib/bot-fluxos";
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

interface Resposta {
  id: string;
  titulo: string;
  resposta: string;
  resposta_retorno_dia: string;
  ordem: number;
  ativo: boolean;
  acao_sim: string;
  destino_sim_fluxo_id: string | null;
  destino_sim_resposta_id: string | null;
  acao_nao: string;
  destino_nao_fluxo_id: string | null;
  destino_nao_resposta_id: string | null;
  delay_acao_segundos: number;
}


interface Palavra {
  id: string;
  texto: string;
  resposta_id: string | null;
}

interface FluxoBasico {
  id: string;
  nome: string;
}

const VAZIO = "__nenhum__";

/** Respostas automáticas em cards, com as ações de SIM e NÃO configuráveis. */
export function RespostasPainel() {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<Resposta | null>(null);

  const respostas = useQuery({
    queryKey: ["bot-respostas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bot_respostas").select("*").order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as Resposta[];
    },
  });

  const palavras = useQuery({
    queryKey: ["bot-palavras"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bot_palavras_chave").select("*");
      if (error) throw error;
      return (data ?? []) as Palavra[];
    },
  });

  const fluxos = useQuery({
    queryKey: ["bot-fluxos-lista"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bot_fluxos").select("id, nome").order("ordem");
      if (error) throw error;
      return (data ?? []) as FluxoBasico[];
    },
  });

  async function recarregar() {
    await queryClient.invalidateQueries({ queryKey: ["bot-respostas"] });
    await queryClient.invalidateQueries({ queryKey: ["bot-palavras"] });
  }

  async function atualizar(r: Resposta, dados: Partial<Resposta>) {
    const { error } = await supabase.from("bot_respostas").update(dados).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    await recarregar();
  }

  async function adicionar() {
    const lista = respostas.data ?? [];
    const ordem = Math.max(0, ...lista.map((r) => r.ordem)) + 1;
    const { data, error } = await supabase
      .from("bot_respostas")
      .insert({ titulo: "Nova resposta", resposta: "", ordem })
      .select("*")
      .maybeSingle();
    if (error) { toast.error(error.message); return; }
    await recarregar();
    if (data) setEditando(data as unknown as Resposta);
  }

  async function duplicar(r: Resposta) {
    const lista = respostas.data ?? [];
    const ordem = Math.max(0, ...lista.map((x) => x.ordem)) + 1;
    const { data, error } = await supabase
      .from("bot_respostas")
      .insert({
        titulo: `${r.titulo} (cópia)`,
        resposta: r.resposta,
        resposta_retorno_dia: r.resposta_retorno_dia,
        acao_sim: r.acao_sim,
        destino_sim_fluxo_id: r.destino_sim_fluxo_id,
        destino_sim_resposta_id: r.destino_sim_resposta_id,
        acao_nao: r.acao_nao,
        destino_nao_fluxo_id: r.destino_nao_fluxo_id,
        destino_nao_resposta_id: r.destino_nao_resposta_id,
        delay_acao_segundos: r.delay_acao_segundos ?? 0,
        ordem,
      })

      .select("id")
      .maybeSingle();
    if (error) { toast.error(error.message); return; }

    const chaves = (palavras.data ?? []).filter((p) => p.resposta_id === r.id);
    if (data && chaves.length > 0) {
      await supabase
        .from("bot_palavras_chave")
        .insert(chaves.map((p) => ({ texto: p.texto, resposta_id: data.id })));
    }
    toast.success("Resposta duplicada.");
    await recarregar();
  }

  async function excluir(r: Resposta) {
    const { error } = await supabase.from("bot_respostas").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Resposta removida.");
    await recarregar();
  }

  if (respostas.isLoading) return <Skeleton className="h-48" />;

  const lista = respostas.data ?? [];

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          O bot procura estas respostas no primeiro contato e confirma com o cliente antes de seguir.
        </p>
        <Button size="sm" onClick={adicionar}>
          <Plus className="h-4 w-4" /> Nova resposta
        </Button>
      </div>

      {lista.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Cadastre perguntas frequentes (horário, endereço, formas de pagamento).
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {lista.map((r) => {
          const chaves = (palavras.data ?? []).filter((p) => p.resposta_id === r.id);
          return (
            <Card key={r.id} className="shadow-card">
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4 text-primary" /> {r.titulo}
                </CardTitle>
                <Switch checked={r.ativo} onCheckedChange={(v) => void atualizar(r, { ativo: v })} />
              </CardHeader>
              <CardContent className="grid gap-2">
                <p className="line-clamp-2 text-sm text-muted-foreground">{r.resposta || "Sem texto definido."}</p>
                <div className="flex flex-wrap gap-1">
                  {chaves.length === 0 && <Badge variant="outline">Sem palavras-chave</Badge>}
                  {chaves.map((p) => (
                    <Badge key={p.id} variant="secondary">{p.texto}</Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setEditando(r)}>
                    <Pencil className="h-4 w-4" /> Configurar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void duplicar(r)}>
                    <Copy className="h-4 w-4" /> Duplicar
                  </Button>
                  <ConfirmarExclusao
                    titulo="Remover resposta"
                    descricao={`A resposta "${r.titulo}" será excluída.`}
                    onConfirmar={() => excluir(r)}
                  >
                    <Button size="sm" variant="ghost">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </ConfirmarExclusao>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editando && (
        <RespostaDialog
          resposta={editando}
          respostas={lista}
          fluxos={fluxos.data ?? []}
          palavras={(palavras.data ?? []).filter((p) => p.resposta_id === editando.id)}
          onFechar={() => setEditando(null)}
          onSalvo={recarregar}
        />
      )}
    </div>
  );
}

function RespostaDialog({
  resposta,
  respostas,
  fluxos,
  palavras,
  onFechar,
  onSalvo,
}: {
  resposta: Resposta;
  respostas: Resposta[];
  fluxos: FluxoBasico[];
  palavras: Palavra[];
  onFechar: () => void;
  onSalvo: () => Promise<void>;
}) {
  const [form, setForm] = useState<Resposta>(resposta);
  const [chaves, setChaves] = useState(palavras.map((p) => p.texto).join(", "));
  const [salvando, setSalvando] = useState(false);

  useEffect(() => setForm(resposta), [resposta]);

  async function salvar() {
    setSalvando(true);
    const { error } = await supabase
      .from("bot_respostas")
      .update({
        titulo: form.titulo,
        resposta: form.resposta,
        resposta_retorno_dia: form.resposta_retorno_dia,
        acao_sim: form.acao_sim,
        destino_sim_fluxo_id: form.destino_sim_fluxo_id,
        destino_sim_resposta_id: form.destino_sim_resposta_id,
        acao_nao: form.acao_nao,
        destino_nao_fluxo_id: form.destino_nao_fluxo_id,
        destino_nao_resposta_id: form.destino_nao_resposta_id,
      })
      .eq("id", form.id);

    if (error) { setSalvando(false); toast.error(error.message); return; }

    await supabase.from("bot_palavras_chave").delete().eq("resposta_id", form.id);
    const lista = chaves.split(",").map((t) => t.trim()).filter(Boolean);
    if (lista.length > 0) {
      await supabase.from("bot_palavras_chave").insert(lista.map((texto) => ({ texto, resposta_id: form.id })));
    }

    setSalvando(false);
    toast.success("Resposta atualizada.");
    await onSalvo();
    onFechar();
  }

  const outras = respostas.filter((r) => r.id !== form.id);

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configurar resposta automática</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1">
            <Label>Título</Label>
            <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>

          <div className="grid gap-1">
            <Label>Palavras-chave (separadas por vírgula)</Label>
            <Input
              value={chaves}
              placeholder="orçamento, preço, quanto custa"
              onChange={(e) => setChaves(e.target.value)}
            />
          </div>

          <div className="grid gap-1">
            <Label>Resposta 1 — primeira conversa do dia</Label>
            <Textarea rows={3} value={form.resposta} onChange={(e) => setForm({ ...form, resposta: e.target.value })} />
          </div>

          <div className="grid gap-1">
            <Label>Resposta 2 — demais conversas do mesmo dia</Label>
            <Textarea
              rows={3}
              value={form.resposta_retorno_dia ?? ""}
              onChange={(e) => setForm({ ...form, resposta_retorno_dia: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Se ficar em branco, o bot usa a resposta 1.</p>
          </div>

          <AcaoCampos
            titulo="Se o cliente responder SIM"
            acao={form.acao_sim}
            fluxoId={form.destino_sim_fluxo_id}
            respostaId={form.destino_sim_resposta_id}
            fluxos={fluxos}
            respostas={outras}
            onChange={(v) =>
              setForm({
                ...form,
                acao_sim: v.acao,
                destino_sim_fluxo_id: v.fluxoId,
                destino_sim_resposta_id: v.respostaId,
              })
            }
          />

          <AcaoCampos
            titulo="Se o cliente responder NÃO"
            acao={form.acao_nao}
            fluxoId={form.destino_nao_fluxo_id}
            respostaId={form.destino_nao_resposta_id}
            fluxos={fluxos}
            respostas={outras}
            onChange={(v) =>
              setForm({
                ...form,
                acao_nao: v.acao,
                destino_nao_fluxo_id: v.fluxoId,
                destino_nao_resposta_id: v.respostaId,
              })
            }
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={() => void salvar()} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar resposta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AcaoCampos({
  titulo,
  acao,
  fluxoId,
  respostaId,
  fluxos,
  respostas,
  onChange,
}: {
  titulo: string;
  acao: string;
  fluxoId: string | null;
  respostaId: string | null;
  fluxos: FluxoBasico[];
  respostas: Resposta[];
  onChange: (v: { acao: string; fluxoId: string | null; respostaId: string | null }) => void;
}) {
  return (
    <div className="grid gap-2 rounded-lg border p-3">
      <Label className="text-sm font-semibold">{titulo}</Label>
      <Select value={acao} onValueChange={(v) => onChange({ acao: v, fluxoId, respostaId })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {ACOES_RESPOSTA.map((a) => (
            <SelectItem key={a.valor} value={a.valor}>{a.rotulo}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {acao === "iniciar_fluxo" && (
        <Select
          value={fluxoId ?? VAZIO}
          onValueChange={(v) => onChange({ acao, fluxoId: v === VAZIO ? null : v, respostaId })}
        >
          <SelectTrigger><SelectValue placeholder="Escolha o fluxo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={VAZIO}>Nenhum fluxo</SelectItem>
            {fluxos.map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {acao === "resposta" && (
        <Select
          value={respostaId ?? VAZIO}
          onValueChange={(v) => onChange({ acao, fluxoId, respostaId: v === VAZIO ? null : v })}
        >
          <SelectTrigger><SelectValue placeholder="Escolha a resposta" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={VAZIO}>Nenhuma resposta</SelectItem>
            {respostas.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.titulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

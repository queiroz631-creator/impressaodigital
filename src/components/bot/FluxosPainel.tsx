import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Plus, Settings2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmarExclusao } from "@/components/ConfirmarExclusao";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FluxoConfigurador } from "@/components/bot/FluxoConfigurador";
import { ICONES, emojiIcone, type Fluxo, type FluxoEtapa, type FluxoOpcao } from "@/lib/bot-fluxos";

interface FormFluxo {
  nome: string;
  descricao: string;
  icone: string;
  mensagem_inicial: string;
  ativo: boolean;
  mensagem_unica: boolean;
}

const VAZIO: FormFluxo = {
  nome: "",
  descricao: "",
  icone: "bot",
  mensagem_inicial: "",
  ativo: true,
  mensagem_unica: true,
};


/** Aba FLUXOS: cadastro e administração das conversas que o bot conduz. */
export function FluxosPainel() {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<Fluxo | null>(null);
  const [form, setForm] = useState<FormFluxo | null>(null);
  const [configurando, setConfigurando] = useState<string | null>(null);

  const fluxos = useQuery({
    queryKey: ["bot-fluxos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bot_fluxos").select("*").order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as Fluxo[];
    },
  });

  const etapas = useQuery({
    queryKey: ["bot-fluxo-etapas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bot_fluxo_etapas").select("*").order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as FluxoEtapa[];
    },
  });

  const opcoes = useQuery({
    queryKey: ["bot-fluxo-opcoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bot_fluxo_opcoes").select("*").order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as FluxoOpcao[];
    },
  });

  const lista = fluxos.data ?? [];
  const todasEtapas = etapas.data ?? [];
  const todasOpcoes = opcoes.data ?? [];

  const usos = useMemo(() => {
    const mapa = new Map<string, string[]>();
    const nome = (id: string) => lista.find((f) => f.id === id)?.nome ?? "";
    for (const e of todasEtapas) {
      if (e.destino_fluxo_id) mapa.set(e.destino_fluxo_id, [...(mapa.get(e.destino_fluxo_id) ?? []), nome(e.fluxo_id)]);
    }
    for (const o of todasOpcoes) {
      if (!o.destino_fluxo_id) continue;
      const etapa = todasEtapas.find((e) => e.id === o.etapa_id);
      if (!etapa) continue;
      mapa.set(o.destino_fluxo_id, [...(mapa.get(o.destino_fluxo_id) ?? []), nome(etapa.fluxo_id)]);
    }
    return mapa;
  }, [lista, todasEtapas, todasOpcoes]);

  async function recarregar() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["bot-fluxos"] }),
      queryClient.invalidateQueries({ queryKey: ["bot-fluxo-etapas"] }),
      queryClient.invalidateQueries({ queryKey: ["bot-fluxo-opcoes"] }),
    ]);
  }

  async function salvarFluxo() {
    if (!form) return;
    if (!form.nome.trim()) { toast.error("Informe o nome do fluxo."); return; }

    if (editando) {
      const { error } = await supabase.from("bot_fluxos").update(form).eq("id", editando.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Fluxo atualizado.");
      setForm(null);
      setEditando(null);
      await recarregar();
      return;
    }

    const ordem = Math.max(0, ...lista.map((f) => f.ordem)) + 1;
    const { data, error } = await supabase.from("bot_fluxos").insert({ ...form, ordem }).select("id").single();
    if (error) { toast.error(error.message); return; }
    toast.success("Fluxo criado. Adicione as etapas.");
    setForm(null);
    await recarregar();
    setConfigurando(data.id);
  }

  async function alternarAtivo(f: Fluxo) {
    const { error } = await supabase.from("bot_fluxos").update({ ativo: !f.ativo }).eq("id", f.id);
    if (error) { toast.error(error.message); return; }
    await recarregar();
  }

  async function definirInicial(id: string) {
    const atual = lista.find((f) => f.inicial);
    if (atual?.id === id) return;
    if (atual) await supabase.from("bot_fluxos").update({ inicial: false }).eq("id", atual.id);
    const { error } = await supabase.from("bot_fluxos").update({ inicial: true }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Fluxo inicial atualizado.");
    await recarregar();
  }

  async function definirArquivos(id: string) {
    const atual = lista.find((f) => f.fluxo_arquivos);
    if (atual?.id === id) return;
    if (atual) await supabase.from("bot_fluxos").update({ fluxo_arquivos: false }).eq("id", atual.id);
    const { error } = await supabase.from("bot_fluxos").update({ fluxo_arquivos: true }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Fluxo de arquivos atualizado.");
    await recarregar();
  }

  async function duplicar(f: Fluxo) {
    const ordem = Math.max(0, ...lista.map((x) => x.ordem)) + 1;
    const { data: novo, error } = await supabase
      .from("bot_fluxos")
      .insert({
        nome: `${f.nome} - Cópia`,
        descricao: f.descricao,
        icone: f.icone,
        mensagem_inicial: f.mensagem_inicial,
        ativo: f.ativo,
        mensagem_unica: f.mensagem_unica !== false,

        ordem,
        inicial: false,
        fluxo_arquivos: false,
      })
      .select("id")
      .single();
    if (error || !novo) { toast.error(error?.message ?? "Falha ao duplicar."); return; }

    const originais = todasEtapas.filter((e) => e.fluxo_id === f.id).sort((a, b) => a.ordem - b.ordem);
    const mapaEtapas = new Map<string, string>();

    for (const e of originais) {
      const { data: nova } = await supabase
        .from("bot_fluxo_etapas")
        .insert({
          fluxo_id: novo.id,
          nome: e.nome,
          ordem: e.ordem,
          mensagem: e.mensagem,
          tipo_resposta: e.tipo_resposta,
          acao: e.acao,
          configuracao: e.configuracao as never,
          destino_fluxo_id: e.destino_fluxo_id,
          ativo: e.ativo,
        })
        .select("id")
        .single();
      if (nova) mapaEtapas.set(e.id, nova.id);
    }

    for (const e of originais) {
      const destino = e.proxima_etapa_id ? mapaEtapas.get(e.proxima_etapa_id) : null;
      const id = mapaEtapas.get(e.id);
      if (id && destino) await supabase.from("bot_fluxo_etapas").update({ proxima_etapa_id: destino }).eq("id", id);

      for (const o of todasOpcoes.filter((x) => x.etapa_id === e.id)) {
        await supabase.from("bot_fluxo_opcoes").insert({
          etapa_id: id!,
          titulo: o.titulo,
          valor: o.valor,
          ordem: o.ordem,
          acao: o.acao,
          destino_fluxo_id: o.destino_fluxo_id,
          destino_etapa_id: o.destino_etapa_id ? (mapaEtapas.get(o.destino_etapa_id) ?? null) : null,
          configuracao: o.configuracao as never,
          ativo: o.ativo,
        });
      }
    }

    toast.success("Fluxo duplicado.");
    await recarregar();
  }

  async function excluir(f: Fluxo) {
    const quem = usos.get(f.id) ?? [];
    if (quem.length > 0) {
      toast.error(
        `Este fluxo está sendo utilizado por outros fluxos e não pode ser excluído. Utilizado por: ${[...new Set(quem)].join(", ")}`,
      );
      return;
    }
    const { error } = await supabase.from("bot_fluxos").delete().eq("id", f.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Fluxo excluído.");
    await recarregar();
  }

  if (fluxos.isLoading) return <Skeleton className="h-64" />;

  const fluxoConfig = lista.find((f) => f.id === configurando);
  if (fluxoConfig) {
    return (
      <FluxoConfigurador
        fluxo={fluxoConfig}
        fluxos={lista}
        etapas={todasEtapas.filter((e) => e.fluxo_id === fluxoConfig.id)}
        opcoes={todasOpcoes}
        onVoltar={() => setConfigurando(null)}
        recarregar={recarregar}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">FLUXOS</h2>
          <p className="text-sm text-muted-foreground">Configure as conversas que o Bot poderá realizar.</p>
        </div>
        <Button onClick={() => { setEditando(null); setForm(VAZIO); }}>
          <Plus className="h-4 w-4" /> ADICIONAR FLUXO
        </Button>
      </div>

      <Card className="shadow-card">
        <CardContent className="grid gap-1 pt-6 sm:max-w-md">
          <Label>Fluxo inicial</Label>
          <Select value={lista.find((f) => f.inicial)?.id ?? ""} onValueChange={(v) => void definirInicial(v)}>
            <SelectTrigger><SelectValue placeholder="Selecione o fluxo" /></SelectTrigger>
            <SelectContent>
              {lista.filter((f) => f.ativo).map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Fluxo iniciado automaticamente quando o cliente entra em contato.
          </p>

          <Label className="mt-3">Fluxo para quem envia apenas arquivos</Label>
          <Select
            value={lista.find((f) => f.fluxo_arquivos)?.id ?? ""}
            onValueChange={(v) => void definirArquivos(v)}
          >
            <SelectTrigger><SelectValue placeholder="Selecione o fluxo" /></SelectTrigger>
            <SelectContent>
              {lista.filter((f) => f.ativo).map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Usado quando o primeiro contato do cliente é só um arquivo ou imagem.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {lista.map((f) => {
          const qtdEtapas = todasEtapas.filter((e) => e.fluxo_id === f.id).length;
          return (
            <Card key={f.id} className="shadow-card">
              <CardContent className="grid gap-2 pt-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg">{emojiIcone(f.icone)}</span>
                  <strong className="uppercase">{f.nome}</strong>
                  {f.inicial && <Badge variant="secondary">Fluxo inicial</Badge>}
                  {f.fluxo_arquivos && <Badge variant="secondary">Recebe arquivos</Badge>}
                  <Badge variant={f.ativo ? "default" : "outline"}>{f.ativo ? "Ativo" : "Inativo"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{f.descricao}</p>
                <p className="text-xs text-muted-foreground">{qtdEtapas} etapa(s)</p>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" onClick={() => setConfigurando(f.id)}>
                    <Settings2 className="h-4 w-4" /> CONFIGURAR
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void duplicar(f)}>
                    <Copy className="h-4 w-4" /> DUPLICAR
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void alternarAtivo(f)}>
                    {f.ativo ? "DESATIVAR" : "ATIVAR"}
                  </Button>
                  <ConfirmarExclusao
                    descricao="Tem certeza que deseja excluir este fluxo, com suas etapas e opções?"
                    onConfirmar={() => excluir(f)}
                  >
                    <Button size="sm" variant="ghost" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </ConfirmarExclusao>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {lista.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum fluxo cadastrado ainda.</p>
        )}
      </div>

      <Dialog open={form !== null} onOpenChange={(v) => { if (!v) { setForm(null); setEditando(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? "Editar fluxo" : "Criar novo fluxo"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label>Nome do fluxo *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="grid gap-1">
                <Label>Descrição</Label>
                <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <div className="grid gap-1">
                <Label>Ícone</Label>
                <Select value={form.icone} onValueChange={(v) => setForm({ ...form, icone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ICONES.map((i) => (
                      <SelectItem key={i.valor} value={i.valor}>{i.emoji} {i.rotulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Os textos das mensagens são configurados nas etapas, em CONFIGURAR.
              </p>
              <div className="grid gap-1 rounded-lg border p-3">


                <label className="flex items-center justify-between gap-4 text-sm">
                  <strong>Enviar tudo em uma única mensagem</strong>
                  <Switch
                    checked={form.mensagem_unica}
                    onCheckedChange={(v) => setForm({ ...form, mensagem_unica: v })}
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  Junta a mensagem do fluxo, o texto da etapa e a lista de opções em um só envio.
                </p>
              </div>
              <label className="flex items-center justify-between gap-4 text-sm">
                <strong>Ativo</strong>
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              </label>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setForm(null); setEditando(null); }}>CANCELAR</Button>
            <Button onClick={() => void salvarFluxo()}>{editando ? "SALVAR" : "CRIAR FLUXO"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDown, ArrowLeft, ArrowUp, Pencil, Play, Plus, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { simularFluxo } from "@/lib/bot.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmarExclusao } from "@/components/ConfirmarExclusao";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ACOES_ETAPA,
  ACOES_OPCAO,
  TIPOS_RESPOSTA,
  emojiIcone,
  rotuloAcaoEtapa,
  rotuloAcaoOpcao,
  rotuloTipoResposta,
  type Fluxo,
  type FluxoEtapa,
  type FluxoOpcao,
} from "@/lib/bot-fluxos";
import type { EstadoFluxo } from "@/lib/bot-fluxos-motor";

interface Props {
  fluxo: Fluxo;
  fluxos: Fluxo[];
  etapas: FluxoEtapa[];
  opcoes: FluxoOpcao[];
  onVoltar: () => void;
  recarregar: () => Promise<void>;
}

interface FormEtapa {
  id?: string;
  nome: string;
  mensagem: string;
  tipo_resposta: string;
  acao: string;
  proxima_etapa_id: string;
  destino_fluxo_id: string;
  ativo: boolean;
}

interface FormOpcao {
  id?: string;
  etapa_id: string;
  titulo: string;
  valor: string;
  acao: string;
  destino_fluxo_id: string;
  destino_etapa_id: string;
  ativo: boolean;
}

const NENHUM = "__nenhum__";

const ETAPA_VAZIA: FormEtapa = {
  nome: "",
  mensagem: "",
  tipo_resposta: "nenhuma",
  acao: "enviar_mensagem",
  proxima_etapa_id: NENHUM,
  destino_fluxo_id: NENHUM,
  ativo: true,
};

/** Editor de etapas e opções de um fluxo. */
export function FluxoConfigurador({ fluxo, fluxos, etapas, opcoes, onVoltar, recarregar }: Props) {
  const [formEtapa, setFormEtapa] = useState<FormEtapa | null>(null);
  const [formOpcao, setFormOpcao] = useState<FormOpcao | null>(null);
  const [opcoesInline, setOpcoesInline] = useState<FormOpcao[]>([]);
  const [opcoesRemovidas, setOpcoesRemovidas] = useState<string[]>([]);

  const ordenadas = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const outrosFluxos = fluxos.filter((f) => f.ativo && f.id !== fluxo.id);

  /** Abre o diálogo da etapa já com as opções dela carregadas para edição inline. */
  function abrirEtapa(dados: FormEtapa) {
    const lista = dados.id
      ? opcoes
          .filter((o) => o.etapa_id === dados.id)
          .sort((a, b) => a.ordem - b.ordem)
          .map((o) => ({
            id: o.id,
            etapa_id: o.etapa_id,
            titulo: o.titulo,
            valor: o.valor,
            acao: o.acao,
            destino_fluxo_id: o.destino_fluxo_id ?? NENHUM,
            destino_etapa_id: o.destino_etapa_id ?? NENHUM,
            ativo: o.ativo,
          }))
      : [];
    setOpcoesInline(lista);
    setOpcoesRemovidas([]);
    setFormEtapa(dados);
  }

  async function salvarEtapa() {
    if (!formEtapa) return;
    if (!formEtapa.nome.trim()) { toast.error("Informe o nome da etapa."); return; }

    const dados = {
      nome: formEtapa.nome,
      mensagem: formEtapa.mensagem,
      tipo_resposta: formEtapa.tipo_resposta,
      acao: formEtapa.acao,
      ativo: formEtapa.ativo,
      proxima_etapa_id: formEtapa.proxima_etapa_id === NENHUM ? null : formEtapa.proxima_etapa_id,
      destino_fluxo_id: formEtapa.destino_fluxo_id === NENHUM ? null : formEtapa.destino_fluxo_id,
    };

    let etapaId = formEtapa.id ?? null;
    if (etapaId) {
      const { error } = await supabase.from("bot_fluxo_etapas").update(dados).eq("id", etapaId);
      if (error) { toast.error(error.message); return; }
    } else {
      const { data, error } = await supabase
        .from("bot_fluxo_etapas")
        .insert({ ...dados, fluxo_id: fluxo.id, ordem: Math.max(0, ...ordenadas.map((e) => e.ordem)) + 1 })
        .select("id")
        .single();
      if (error || !data) { toast.error(error?.message ?? "Falha ao salvar etapa."); return; }
      etapaId = data.id;
    }

    if (opcoesRemovidas.length > 0) {
      await supabase.from("bot_fluxo_opcoes").delete().in("id", opcoesRemovidas);
    }

    for (const [i, o] of opcoesInline.entries()) {
      if (!o.titulo.trim()) continue;
      const dadosOpcao = {
        titulo: o.titulo,
        valor: o.valor || o.titulo,
        acao: o.acao,
        ativo: o.ativo,
        ordem: i + 1,
        destino_fluxo_id: o.destino_fluxo_id === NENHUM ? null : o.destino_fluxo_id,
        destino_etapa_id: o.destino_etapa_id === NENHUM ? null : o.destino_etapa_id,
      };
      const { error } = o.id
        ? await supabase.from("bot_fluxo_opcoes").update(dadosOpcao).eq("id", o.id)
        : await supabase.from("bot_fluxo_opcoes").insert({ ...dadosOpcao, etapa_id: etapaId });
      if (error) { toast.error(error.message); return; }
    }

    toast.success("Etapa salva.");
    setFormEtapa(null);
    setOpcoesInline([]);
    setOpcoesRemovidas([]);
    await recarregar();
  }


  async function excluirEtapa(e: FluxoEtapa) {
    const { error } = await supabase.from("bot_fluxo_etapas").delete().eq("id", e.id);
    if (error) { toast.error(error.message); return; }
    await recarregar();
  }

  async function moverEtapa(indice: number, direcao: -1 | 1) {
    const atual = ordenadas[indice];
    const outro = ordenadas[indice + direcao];
    if (!atual || !outro) return;
    await supabase.from("bot_fluxo_etapas").update({ ordem: outro.ordem }).eq("id", atual.id);
    await supabase.from("bot_fluxo_etapas").update({ ordem: atual.ordem }).eq("id", outro.id);
    await recarregar();
  }

  async function salvarOpcao() {
    if (!formOpcao) return;
    if (!formOpcao.titulo.trim()) { toast.error("Informe o título da opção."); return; }

    const irmas = opcoes.filter((o) => o.etapa_id === formOpcao.etapa_id);
    const dados = {
      titulo: formOpcao.titulo,
      valor: formOpcao.valor || formOpcao.titulo,
      acao: formOpcao.acao,
      ativo: formOpcao.ativo,
      destino_fluxo_id: formOpcao.destino_fluxo_id === NENHUM ? null : formOpcao.destino_fluxo_id,
      destino_etapa_id: formOpcao.destino_etapa_id === NENHUM ? null : formOpcao.destino_etapa_id,
    };

    const { error } = formOpcao.id
      ? await supabase.from("bot_fluxo_opcoes").update(dados).eq("id", formOpcao.id)
      : await supabase.from("bot_fluxo_opcoes").insert({
          ...dados,
          etapa_id: formOpcao.etapa_id,
          ordem: Math.max(0, ...irmas.map((o) => o.ordem)) + 1,
        });

    if (error) { toast.error(error.message); return; }
    toast.success("Opção salva.");
    setFormOpcao(null);
    await recarregar();
  }

  async function excluirOpcao(o: FluxoOpcao) {
    const { error } = await supabase.from("bot_fluxo_opcoes").delete().eq("id", o.id);
    if (error) { toast.error(error.message); return; }
    await recarregar();
  }

  async function moverOpcao(lista: FluxoOpcao[], indice: number, direcao: -1 | 1) {
    const atual = lista[indice];
    const outro = lista[indice + direcao];
    if (!atual || !outro) return;
    await supabase.from("bot_fluxo_opcoes").update({ ordem: outro.ordem }).eq("id", atual.id);
    await supabase.from("bot_fluxo_opcoes").update({ ordem: atual.ordem }).eq("id", outro.id);
    await recarregar();
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Button variant="ghost" size="sm" onClick={onVoltar} className="mb-1 px-0">
            <ArrowLeft className="h-4 w-4" /> Voltar aos fluxos
          </Button>
          <h2 className="text-lg font-bold">
            {emojiIcone(fluxo.icone)} FLUXO: {fluxo.nome.toUpperCase()}
          </h2>
          <p className="text-sm text-muted-foreground">{fluxo.descricao}</p>
        </div>
      </div>

      <Tabs defaultValue="etapas">
        <TabsList className="mb-3 flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="etapas">Etapas</TabsTrigger>
          <TabsTrigger value="visual">Visualização</TabsTrigger>
          <TabsTrigger value="teste">Testar fluxo</TabsTrigger>
        </TabsList>

        {/* ---------- Etapas ---------- */}
        <TabsContent value="etapas" className="grid gap-3">
          {ordenadas.map((e, i) => {
            const lista = opcoes.filter((o) => o.etapa_id === e.id).sort((a, b) => a.ordem - b.ordem);
            return (
              <Card key={e.id} className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <span>ETAPA {i + 1} — {e.nome}</span>
                    {!e.ativo && <Badge variant="outline">Inativa</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {e.mensagem && <p className="whitespace-pre-wrap text-sm">{e.mensagem}</p>}
                  <p className="text-xs text-muted-foreground">
                    Tipo: {rotuloTipoResposta(e.tipo_resposta)} · Ação: {rotuloAcaoEtapa(e.acao)}
                  </p>

                  {lista.length > 0 && (
                    <div className="grid gap-1 rounded-lg border p-2">
                      {lista.map((o, j) => (
                        <div key={o.id} className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium">{j + 1}. {o.titulo}</span>
                          <span className="text-xs text-muted-foreground">
                            {rotuloAcaoOpcao(o.acao)}
                            {o.destino_fluxo_id ? ` → ${fluxos.find((f) => f.id === o.destino_fluxo_id)?.nome ?? ""}` : ""}
                          </span>
                          <span className="ml-auto flex items-center gap-1">
                            <Button size="icon" variant="ghost" onClick={() => void moverOpcao(lista, j, -1)}>
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => void moverOpcao(lista, j, 1)}>
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                setFormOpcao({
                                  id: o.id,
                                  etapa_id: e.id,
                                  titulo: o.titulo,
                                  valor: o.valor,
                                  acao: o.acao,
                                  destino_fluxo_id: o.destino_fluxo_id ?? NENHUM,
                                  destino_etapa_id: o.destino_etapa_id ?? NENHUM,
                                  ativo: o.ativo,
                                })
                              }
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <ConfirmarExclusao descricao="Excluir esta opção?" onConfirmar={() => excluirOpcao(o)}>
                              <Button size="icon" variant="ghost" className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </ConfirmarExclusao>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        abrirEtapa({

                          id: e.id,
                          nome: e.nome,
                          mensagem: e.mensagem,
                          tipo_resposta: e.tipo_resposta,
                          acao: e.acao,
                          proxima_etapa_id: e.proxima_etapa_id ?? NENHUM,
                          destino_fluxo_id: e.destino_fluxo_id ?? NENHUM,
                          ativo: e.ativo,
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" /> EDITAR
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setFormOpcao({
                          etapa_id: e.id,
                          titulo: "",
                          valor: "",
                          acao: "proxima_etapa",
                          destino_fluxo_id: NENHUM,
                          destino_etapa_id: NENHUM,
                          ativo: true,
                        })
                      }
                    >
                      <Plus className="h-4 w-4" /> ADICIONAR OPÇÃO
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => void moverEtapa(i, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => void moverEtapa(i, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <ConfirmarExclusao descricao="Excluir esta etapa e suas opções?" onConfirmar={() => excluirEtapa(e)}>
                      <Button size="icon" variant="ghost" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </ConfirmarExclusao>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {ordenadas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma etapa cadastrada.</p>}

          <div>
            <Button onClick={() => abrirEtapa({ ...ETAPA_VAZIA })}>
              <Plus className="h-4 w-4" /> ADICIONAR ETAPA
            </Button>
          </div>
        </TabsContent>

        {/* ---------- Visualização ---------- */}
        <TabsContent value="visual">
          <Card className="shadow-card">
            <CardContent className="grid gap-1 pt-6 text-sm">
              <span className="font-bold">INÍCIO</span>
              {ordenadas.map((e) => (
                <span key={e.id} className="grid">
                  <span className="text-muted-foreground">↓</span>
                  <span>{e.nome}</span>
                </span>
              ))}
              <span className="text-muted-foreground">↓</span>
              <span className="font-bold">FINALIZAR</span>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- Simulador ---------- */}
        <TabsContent value="teste">
          <SimuladorFluxo fluxoId={fluxo.id} />
        </TabsContent>
      </Tabs>

      {/* ---------- Diálogo de etapa ---------- */}
      <Dialog open={formEtapa !== null} onOpenChange={(v) => { if (!v) setFormEtapa(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formEtapa?.id ? "Editar etapa" : "Adicionar etapa"}</DialogTitle>
          </DialogHeader>
          {formEtapa && (
            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label>Nome da etapa *</Label>
                <Input value={formEtapa.nome} onChange={(e) => setFormEtapa({ ...formEtapa, nome: e.target.value })} />
              </div>
              <div className="grid gap-1">
                <Label>Mensagem</Label>
                <Textarea
                  rows={3}
                  value={formEtapa.mensagem}
                  onChange={(e) => setFormEtapa({ ...formEtapa, mensagem: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label>Tipo de resposta</Label>
                <Select
                  value={formEtapa.tipo_resposta}
                  onValueChange={(v) => setFormEtapa({ ...formEtapa, tipo_resposta: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_RESPOSTA.map((t) => <SelectItem key={t.valor} value={t.valor}>{t.rotulo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label>Ação</Label>
                <Select value={formEtapa.acao} onValueChange={(v) => setFormEtapa({ ...formEtapa, acao: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACOES_ETAPA.map((a) => <SelectItem key={a.valor} value={a.valor}>{a.rotulo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {formEtapa.acao === "iniciar_fluxo" && (
                <div className="grid gap-1">
                  <Label>Fluxo destino</Label>
                  <Select
                    value={formEtapa.destino_fluxo_id}
                    onValueChange={(v) => setFormEtapa({ ...formEtapa, destino_fluxo_id: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NENHUM}>Nenhum</SelectItem>
                      {outrosFluxos.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid gap-1">
                <Label>Próxima etapa</Label>
                <Select
                  value={formEtapa.proxima_etapa_id}
                  onValueChange={(v) => setFormEtapa({ ...formEtapa, proxima_etapa_id: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NENHUM}>Seguir a ordem das etapas</SelectItem>
                    {ordenadas.filter((e) => e.id !== formEtapa.id).map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center justify-between gap-4 text-sm">
                <strong>Etapa ativa</strong>
                <Switch checked={formEtapa.ativo} onCheckedChange={(v) => setFormEtapa({ ...formEtapa, ativo: v })} />
              </label>

              {/* Opções de resposta editadas na mesma tela da etapa */}
              <div className="grid gap-2 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm">Opções de resposta</strong>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setOpcoesInline([
                        ...opcoesInline,
                        {
                          etapa_id: formEtapa.id ?? "",
                          titulo: "",
                          valor: "",
                          acao: "proxima_etapa",
                          destino_fluxo_id: NENHUM,
                          destino_etapa_id: NENHUM,
                          ativo: true,
                        },
                      ])
                    }
                  >
                    <Plus className="h-4 w-4" /> OPÇÃO
                  </Button>
                </div>

                {opcoesInline.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Sem opções. O cliente responde livremente nesta etapa.
                  </p>
                )}

                {opcoesInline.map((o, i) => {
                  const alterar = (patch: Partial<FormOpcao>) =>
                    setOpcoesInline(opcoesInline.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                  return (
                    <div key={o.id ?? `nova-${i}`} className="grid gap-2 rounded-md border p-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground">{i + 1}.</span>
                        <Input
                          placeholder="Título da opção"
                          value={o.titulo}
                          onChange={(e) => alterar({ titulo: e.target.value })}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (o.id) setOpcoesRemovidas([...opcoesRemovidas, o.id]);
                            setOpcoesInline(opcoesInline.filter((_, j) => j !== i));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Select value={o.acao} onValueChange={(v) => alterar({ acao: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ACOES_OPCAO.map((a) => <SelectItem key={a.valor} value={a.valor}>{a.rotulo}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {o.acao === "iniciar_fluxo" && (
                        <Select value={o.destino_fluxo_id} onValueChange={(v) => alterar({ destino_fluxo_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Fluxo destino" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NENHUM}>Nenhum</SelectItem>
                            {outrosFluxos.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                      {o.acao === "ir_para_etapa" && (
                        <Select value={o.destino_etapa_id} onValueChange={(v) => alterar({ destino_etapa_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Etapa destino" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NENHUM}>Nenhuma</SelectItem>
                            {ordenadas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormEtapa(null)}>CANCELAR</Button>
            <Button onClick={() => void salvarEtapa()}>SALVAR ETAPA</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Diálogo de opção ---------- */}
      <Dialog open={formOpcao !== null} onOpenChange={(v) => { if (!v) setFormOpcao(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formOpcao?.id ? "Editar opção" : "Nova opção"}</DialogTitle>
          </DialogHeader>
          {formOpcao && (
            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label>Título *</Label>
                <Input value={formOpcao.titulo} onChange={(e) => setFormOpcao({ ...formOpcao, titulo: e.target.value })} />
              </div>
              <div className="grid gap-1">
                <Label>Texto enviado ao WhatsApp</Label>
                <Input
                  value={formOpcao.valor}
                  placeholder="Igual ao título quando vazio"
                  onChange={(e) => setFormOpcao({ ...formOpcao, valor: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label>Ação</Label>
                <Select value={formOpcao.acao} onValueChange={(v) => setFormOpcao({ ...formOpcao, acao: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACOES_OPCAO.map((a) => <SelectItem key={a.valor} value={a.valor}>{a.rotulo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {formOpcao.acao === "iniciar_fluxo" && (
                <div className="grid gap-1">
                  <Label>Fluxo destino</Label>
                  <Select
                    value={formOpcao.destino_fluxo_id}
                    onValueChange={(v) => setFormOpcao({ ...formOpcao, destino_fluxo_id: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NENHUM}>Nenhum</SelectItem>
                      {outrosFluxos.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {formOpcao.acao === "ir_para_etapa" && (
                <div className="grid gap-1">
                  <Label>Etapa destino</Label>
                  <Select
                    value={formOpcao.destino_etapa_id}
                    onValueChange={(v) => setFormOpcao({ ...formOpcao, destino_etapa_id: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NENHUM}>Nenhuma</SelectItem>
                      {ordenadas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <label className="flex items-center justify-between gap-4 text-sm">
                <strong>Opção ativa</strong>
                <Switch checked={formOpcao.ativo} onCheckedChange={(v) => setFormOpcao({ ...formOpcao, ativo: v })} />
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpcao(null)}>CANCELAR</Button>
            <Button onClick={() => void salvarOpcao()}>SALVAR OPÇÃO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Simulador do fluxo: roda as mesmas regras sem enviar nada pelo WhatsApp. */
function SimuladorFluxo({ fluxoId }: { fluxoId: string }) {
  const simular = useServerFn(simularFluxo);
  const [conversa, setConversa] = useState<{ de: "bot" | "cliente"; texto: string }[]>([]);
  const [estado, setEstado] = useState<EstadoFluxo | null>(null);
  const [iniciado, setIniciado] = useState(false);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function enviar(mensagem: string | null) {
    setCarregando(true);
    try {
      const r = await simular({
        data: { fluxoId, texto: mensagem ?? "", tipo: "texto", estado: mensagem === null ? null : estado },
      });
      const novas = r.mensagens.map((m) => ({
        de: "bot" as const,
        texto: m.botoes.length > 0 ? `${m.texto}\n[${m.botoes.join("] [")}]` : m.texto,
      }));
      setConversa((c) => [...c, ...(mensagem ? [{ de: "cliente" as const, texto: mensagem }] : []), ...novas]);
      setEstado((r.estado as EstadoFluxo | null) ?? null);
      setIniciado(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao simular.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Testar fluxo</CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setConversa([]); setEstado(null); setIniciado(false); void enviar(null); }}
        >
          <Play className="h-4 w-4" /> {iniciado ? "Reiniciar" : "Iniciar"}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid max-h-80 gap-2 overflow-y-auto rounded-lg border p-3">
          {conversa.length === 0 && (
            <p className="text-sm text-muted-foreground">Clique em Iniciar para simular a conversa.</p>
          )}
          {conversa.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                m.de === "bot" ? "bg-muted" : "ml-auto bg-primary text-primary-foreground"
              }`}
            >
              {m.texto}
            </div>
          ))}
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!texto.trim() || carregando) return;
            const m = texto;
            setTexto("");
            void enviar(m);
          }}
        >
          <Input
            value={texto}
            placeholder="Mensagem do cliente"
            disabled={!iniciado || carregando}
            onChange={(e) => setTexto(e.target.value)}
          />
          <Button type="submit" disabled={!iniciado || carregando}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

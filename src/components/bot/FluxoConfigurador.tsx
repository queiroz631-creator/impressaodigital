import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, ChevronRight, Paperclip, Pencil, Play, Plus, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { simularFluxo } from "@/lib/bot.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ConfirmarExclusao } from "@/components/ConfirmarExclusao";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ACOES_ETAPA,
  ACOES_OPCAO,
  ICONES,
  MODOS_AVANCO,
  TIPOS_MENSAGEM,
  TIPOS_RESPOSTA,
  emojiIcone,
  rotuloModoAvanco,
  rotuloTipoMensagem,
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

interface FormOpcao {
  id?: string;
  titulo: string;
  valor: string;
  acao: string;
  destino_fluxo_id: string;
  destino_etapa_id: string;
  ativo: boolean;
}

interface FormEtapa {
  id?: string;
  nome: string;
  mensagem: string;
  mensagem_retorno_dia: string;
  usar_retorno: boolean;
  tipo_mensagem: string;
  midia_url: string;
  midia_nome: string;
  modo_avanco: string;
  espera_segundos: number;
  tipo_resposta: string;
  acao: string;
  proxima_etapa_id: string;
  destino_fluxo_id: string;
  ativo: boolean;
  opcoes: FormOpcao[];
  removidas: string[];
}

const NENHUM = "__nenhum__";

function formDaEtapa(e: FluxoEtapa, opcoes: FluxoOpcao[]): FormEtapa {
  return {
    id: e.id,
    nome: e.nome,
    mensagem: e.mensagem ?? "",
    mensagem_retorno_dia: e.mensagem_retorno_dia ?? "",
    usar_retorno: Boolean((e.mensagem_retorno_dia ?? "").trim()),
    tipo_mensagem: e.tipo_mensagem ?? "texto",
    midia_url: e.midia_url ?? "",
    midia_nome: e.midia_nome ?? "",
    modo_avanco: e.modo_avanco ?? "resposta",
    espera_segundos: e.espera_segundos ?? 0,
    tipo_resposta: e.tipo_resposta,
    acao: e.acao,
    proxima_etapa_id: e.proxima_etapa_id ?? NENHUM,
    destino_fluxo_id: e.destino_fluxo_id ?? NENHUM,
    ativo: e.ativo,
    opcoes: opcoes
      .filter((o) => o.etapa_id === e.id)
      .sort((a, b) => a.ordem - b.ordem)
      .map((o) => ({
        id: o.id,
        titulo: o.titulo,
        valor: o.valor,
        acao: o.acao,
        destino_fluxo_id: o.destino_fluxo_id ?? NENHUM,
        destino_etapa_id: o.destino_etapa_id ?? NENHUM,
        ativo: o.ativo,
      })),
    removidas: [],
  };
}

const ETAPA_VAZIA: FormEtapa = {
  nome: "",
  mensagem: "",
  mensagem_retorno_dia: "",
  usar_retorno: false,
  tipo_mensagem: "texto",
  midia_url: "",
  midia_nome: "",
  modo_avanco: "resposta",
  espera_segundos: 0,
  tipo_resposta: "nenhuma",
  acao: "enviar_mensagem",
  proxima_etapa_id: NENHUM,
  destino_fluxo_id: NENHUM,
  ativo: true,
  opcoes: [],
  removidas: [],
};

/** Tela única de configuração do fluxo: dados do fluxo, etapas e opções. */
export function FluxoConfigurador({ fluxo, fluxos, etapas, opcoes, onVoltar, recarregar }: Props) {
  const [dadosFluxo, setDadosFluxo] = useState({
    nome: fluxo.nome,
    descricao: fluxo.descricao,
    icone: fluxo.icone,
    ativo: fluxo.ativo,
    mensagem_unica: fluxo.mensagem_unica !== false,
  });
  const [aberta, setAberta] = useState<string | null>(null);
  const [form, setForm] = useState<FormEtapa | null>(null);

  const ordenadas = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const outrosFluxos = fluxos.filter((f) => f.ativo && f.id !== fluxo.id);

  function abrir(e: FluxoEtapa) {
    if (aberta === e.id) { setAberta(null); setForm(null); return; }
    setAberta(e.id);
    setForm(formDaEtapa(e, opcoes));
  }

  function nova() {
    setAberta("nova");
    setForm({ ...ETAPA_VAZIA, opcoes: [], removidas: [] });
  }

  async function salvarFluxo() {
    if (!dadosFluxo.nome.trim()) { toast.error("Informe o nome do fluxo."); return; }
    const { error } = await supabase.from("bot_fluxos").update(dadosFluxo).eq("id", fluxo.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Fluxo salvo.");
    await recarregar();
  }

  async function salvarEtapa() {
    if (!form) return;
    if (!form.nome.trim()) { toast.error("Informe o nome da etapa."); return; }

    const dados = {
      nome: form.nome,
      mensagem: form.mensagem,
      mensagem_retorno_dia: form.usar_retorno ? form.mensagem_retorno_dia : "",
      tipo_mensagem: form.tipo_mensagem,
      midia_url: form.tipo_mensagem === "texto" ? null : (form.midia_url || null),
      midia_nome: form.tipo_mensagem === "texto" ? null : (form.midia_nome || null),
      modo_avanco: form.modo_avanco,
      espera_segundos: form.modo_avanco === "automatico" ? Math.min(60, Math.max(0, form.espera_segundos)) : 0,
      tipo_resposta: form.tipo_resposta,
      acao: form.acao,
      ativo: form.ativo,
      proxima_etapa_id: form.proxima_etapa_id === NENHUM ? null : form.proxima_etapa_id,
      destino_fluxo_id: form.destino_fluxo_id === NENHUM ? null : form.destino_fluxo_id,
    };

    let etapaId = form.id ?? null;
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

    if (form.removidas.length > 0) {
      await supabase.from("bot_fluxo_opcoes").delete().in("id", form.removidas);
    }

    for (const [i, o] of form.opcoes.entries()) {
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
    setForm(null);
    setAberta(null);
    await recarregar();
  }

  async function excluirEtapa(e: FluxoEtapa) {
    const { error } = await supabase.from("bot_fluxo_etapas").delete().eq("id", e.id);
    if (error) { toast.error(error.message); return; }
    if (aberta === e.id) { setAberta(null); setForm(null); }
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

  const editor = form && (
    <EditorEtapa
      form={form}
      setForm={setForm}
      etapas={ordenadas}
      outrosFluxos={outrosFluxos}
      onCancelar={() => { setForm(null); setAberta(null); }}
      onSalvar={() => void salvarEtapa()}
    />
  );

  return (
    <div className="grid gap-4">
      <div>
        <Button variant="ghost" size="sm" onClick={onVoltar} className="mb-1 px-0">
          <ArrowLeft className="h-4 w-4" /> Voltar aos fluxos
        </Button>
        <h2 className="text-lg font-bold">
          {emojiIcone(dadosFluxo.icone)} FLUXO: {dadosFluxo.nome.toUpperCase()}
        </h2>
      </div>

      {/* ---------- Dados do fluxo ---------- */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Dados do fluxo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <Label>Nome do fluxo *</Label>
            <Input value={dadosFluxo.nome} onChange={(e) => setDadosFluxo({ ...dadosFluxo, nome: e.target.value })} />
          </div>
          <div className="grid gap-1">
            <Label>Descrição</Label>
            <Input
              value={dadosFluxo.descricao}
              onChange={(e) => setDadosFluxo({ ...dadosFluxo, descricao: e.target.value })}
            />
          </div>
          <div className="grid gap-1">
            <Label>Ícone</Label>
            <Select value={dadosFluxo.icone} onValueChange={(v) => setDadosFluxo({ ...dadosFluxo, icone: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ICONES.map((i) => <SelectItem key={i.valor} value={i.valor}>{i.emoji} {i.rotulo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid content-end gap-2">
            <label className="flex items-center justify-between gap-4 text-sm">
              <strong>Fluxo ativo</strong>
              <Switch checked={dadosFluxo.ativo} onCheckedChange={(v) => setDadosFluxo({ ...dadosFluxo, ativo: v })} />
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              <strong>Enviar tudo em uma única mensagem</strong>
              <Switch
                checked={dadosFluxo.mensagem_unica}
                onCheckedChange={(v) => setDadosFluxo({ ...dadosFluxo, mensagem_unica: v })}
              />
            </label>
          </div>
          <div className="sm:col-span-2">
            <Button onClick={() => void salvarFluxo()}>SALVAR FLUXO</Button>
          </div>
        </CardContent>
      </Card>

      {/* ---------- Etapas ---------- */}
      <div className="grid gap-3">
        <h3 className="text-sm font-bold uppercase text-muted-foreground">Etapas</h3>

        {ordenadas.map((e, i) => {
          const lista = opcoes.filter((o) => o.etapa_id === e.id).sort((a, b) => a.ordem - b.ordem);
          const expandida = aberta === e.id;
          return (
            <Card key={e.id} className="shadow-card">
              <CardContent className="grid gap-2 pt-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="icon" variant="ghost" onClick={() => abrir(e)}>
                    {expandida ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                  <strong className="text-sm">ETAPA {i + 1} — {e.nome}</strong>
                  <Badge variant="secondary">{rotuloTipoMensagem(e.tipo_mensagem)}</Badge>
                  {i === 0 && <Badge variant="outline">Abertura do fluxo</Badge>}
                  {!e.ativo && <Badge variant="outline">Inativa</Badge>}
                  <span className="ml-auto flex items-center gap-1">
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
                  </span>
                </div>

                {!expandida && (
                  <>
                    {e.mensagem && <p className="whitespace-pre-wrap text-sm">{e.mensagem}</p>}
                    <p className="text-xs text-muted-foreground">
                      {rotuloModoAvanco(e.modo_avanco)}
                      {e.modo_avanco === "automatico" && e.espera_segundos > 0 ? ` · ${e.espera_segundos}s` : ""}
                      {lista.length > 0 ? ` · ${lista.length} opção(ões)` : ""}
                    </p>
                  </>
                )}

                {expandida && editor}
              </CardContent>
            </Card>
          );
        })}

        {ordenadas.length === 0 && aberta !== "nova" && (
          <p className="text-sm text-muted-foreground">Nenhuma etapa cadastrada.</p>
        )}

        {aberta === "nova" && (
          <Card className="shadow-card">
            <CardHeader className="pb-2"><CardTitle className="text-base">Nova etapa</CardTitle></CardHeader>
            <CardContent>{editor}</CardContent>
          </Card>
        )}

        <div>
          <Button onClick={nova}>
            <Plus className="h-4 w-4" /> ADICIONAR ETAPA
          </Button>
        </div>
      </div>

      {/* ---------- Visualização ---------- */}
      <Card className="shadow-card">
        <CardHeader className="pb-2"><CardTitle className="text-base">Visualização</CardTitle></CardHeader>
        <CardContent className="grid gap-1 text-sm">
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

      <SimuladorFluxo fluxoId={fluxo.id} />
    </div>
  );
}

/** Formulário completo de uma etapa, com as opções na mesma tela. */
function EditorEtapa({
  form,
  setForm,
  etapas,
  outrosFluxos,
  onCancelar,
  onSalvar,
}: {
  form: FormEtapa;
  setForm: (f: FormEtapa) => void;
  etapas: FluxoEtapa[];
  outrosFluxos: Fluxo[];
  onCancelar: () => void;
  onSalvar: () => void;
}) {
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const tipo = TIPOS_MENSAGEM.find((t) => t.valor === form.tipo_mensagem);

  async function subirArquivo(arquivo: File) {
    setEnviando(true);
    try {
      const extensao = arquivo.name.split(".").pop() ?? "bin";
      const caminho = `etapas/${crypto.randomUUID()}.${extensao}`;
      const { error } = await supabase.storage.from("bot-midia").upload(caminho, arquivo, { upsert: true });
      if (error) { toast.error(error.message); return; }
      setForm({ ...form, midia_url: caminho, midia_nome: arquivo.name });
      toast.success("Arquivo anexado.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <div className="grid gap-1">
        <Label>Nome da etapa *</Label>
        <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
      </div>

      <div className="grid gap-1">
        <Label>Tipo de mensagem</Label>
        <Select value={form.tipo_mensagem} onValueChange={(v) => setForm({ ...form, tipo_mensagem: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {TIPOS_MENSAGEM.map((t) => <SelectItem key={t.valor} value={t.valor}>{t.rotulo}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {form.tipo_mensagem !== "texto" && (
        <div className="grid gap-1">
          <Label>Arquivo</Label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={arquivoRef}
              type="file"
              className="hidden"
              accept={tipo?.aceita || undefined}
              onChange={(e) => {
                const a = e.target.files?.[0];
                if (a) void subirArquivo(a);
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="outline" disabled={enviando} onClick={() => arquivoRef.current?.click()}>
              <Paperclip className="h-4 w-4" /> {enviando ? "ENVIANDO..." : "ANEXAR ARQUIVO"}
            </Button>
            {form.midia_nome && <span className="text-xs text-muted-foreground">{form.midia_nome}</span>}
            {form.midia_url && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => setForm({ ...form, midia_url: "", midia_nome: "" })}
              >
                REMOVER
              </Button>
            )}
          </div>
          <Input
            placeholder="Ou cole aqui o endereço (https://...) do arquivo"
            value={/^https?:\/\//i.test(form.midia_url) ? form.midia_url : ""}
            onChange={(e) => setForm({ ...form, midia_url: e.target.value })}
          />
        </div>
      )}

      <div className="grid gap-1">
        <Label>{form.tipo_mensagem === "texto" ? "Texto da etapa" : "Texto / legenda"}</Label>
        <Textarea rows={4} value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} />
        <p className="text-xs text-muted-foreground">Use {"{nome}"}, {"{telefone}"} e {"{saudacao}"}.</p>
        {!form.usar_retorno ? (
          <Button
            size="sm"
            variant="outline"
            className="justify-self-start"
            onClick={() => setForm({ ...form, usar_retorno: true })}
          >
            <Plus className="h-4 w-4" /> ADICIONAR MENSAGEM 2 (RETORNO NO MESMO DIA)
          </Button>
        ) : (
          <div className="grid gap-1">
            <Label>Mensagem 2 — retorno no mesmo dia</Label>
            <Textarea
              rows={3}
              value={form.mensagem_retorno_dia}
              onChange={(e) => setForm({ ...form, mensagem_retorno_dia: e.target.value })}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Em branco, o bot usa sempre o texto acima.</p>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => setForm({ ...form, usar_retorno: false, mensagem_retorno_dia: "" })}
              >
                REMOVER
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-1">
        <Label>Próxima etapa — como avança</Label>
        <Select value={form.modo_avanco} onValueChange={(v) => setForm({ ...form, modo_avanco: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {MODOS_AVANCO.map((m) => <SelectItem key={m.valor} value={m.valor}>{m.rotulo}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {form.modo_avanco === "automatico" && (
        <div className="grid gap-1">
          <Label>Tempo de espera (segundos)</Label>
          <Input
            type="number"
            min={0}
            max={60}
            value={form.espera_segundos}
            onChange={(e) => setForm({ ...form, espera_segundos: Number(e.target.value) || 0 })}
          />
          <p className="text-xs text-muted-foreground">Máximo de 60 segundos por etapa.</p>
        </div>
      )}

      {form.modo_avanco === "resposta" && (
        <div className="grid gap-1">
          <Label>Tipo de resposta esperada</Label>
          <Select value={form.tipo_resposta} onValueChange={(v) => setForm({ ...form, tipo_resposta: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS_RESPOSTA.map((t) => <SelectItem key={t.valor} value={t.valor}>{t.rotulo}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-1">
        <Label>Ação da etapa</Label>
        <Select value={form.acao} onValueChange={(v) => setForm({ ...form, acao: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ACOES_ETAPA.map((a) => <SelectItem key={a.valor} value={a.valor}>{a.rotulo}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {form.acao === "iniciar_fluxo" && (
        <div className="grid gap-1">
          <Label>Fluxo destino</Label>
          <Select value={form.destino_fluxo_id} onValueChange={(v) => setForm({ ...form, destino_fluxo_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NENHUM}>Nenhum</SelectItem>
              {outrosFluxos.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-1">
        <Label>Seguir para</Label>
        <Select value={form.proxima_etapa_id} onValueChange={(v) => setForm({ ...form, proxima_etapa_id: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NENHUM}>Seguir a ordem das etapas</SelectItem>
            {etapas.filter((e) => e.id !== form.id).map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <label className="flex items-center justify-between gap-4 text-sm">
        <strong>Etapa ativa</strong>
        <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
      </label>

      {/* Opções na mesma tela */}
      <div className="grid gap-2 rounded-lg border p-3">
        <div className="flex items-center justify-between gap-2">
          <strong className="text-sm">Opções de resposta</strong>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setForm({
                ...form,
                opcoes: [
                  ...form.opcoes,
                  { titulo: "", valor: "", acao: "proxima_etapa", destino_fluxo_id: NENHUM, destino_etapa_id: NENHUM, ativo: true },
                ],
              })
            }
          >
            <Plus className="h-4 w-4" /> ADICIONAR OPÇÃO
          </Button>
        </div>

        {form.opcoes.length === 0 && (
          <p className="text-xs text-muted-foreground">Sem opções. O cliente responde livremente nesta etapa.</p>
        )}

        {form.opcoes.map((o, i) => {
          const alterar = (patch: Partial<FormOpcao>) =>
            setForm({ ...form, opcoes: form.opcoes.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
          return (
            <div key={o.id ?? `nova-${i}`} className="grid gap-2 rounded-md border p-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">{i + 1}.</span>
                <Input placeholder="Título da opção" value={o.titulo} onChange={(e) => alterar({ titulo: e.target.value })} />
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() =>
                    setForm({
                      ...form,
                      opcoes: form.opcoes.filter((_, j) => j !== i),
                      removidas: o.id ? [...form.removidas, o.id] : form.removidas,
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Input
                placeholder="Texto que o cliente digita (igual ao título quando vazio)"
                value={o.valor}
                onChange={(e) => alterar({ valor: e.target.value })}
              />
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
                    {etapas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <label className="flex items-center justify-between gap-4 text-xs">
                <span>Opção ativa</span>
                <Switch checked={o.ativo} onCheckedChange={(v) => alterar({ ativo: v })} />
              </label>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onSalvar}>SALVAR ETAPA</Button>
        <Button variant="outline" onClick={onCancelar}>CANCELAR</Button>
      </div>
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

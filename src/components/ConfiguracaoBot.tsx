import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Bot, Clock, MessageSquare, Plus, Save, Send, Trash2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { simularBot } from "@/lib/bot.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ConfirmarExclusao } from "@/components/ConfirmarExclusao";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const ACOES: { valor: string; rotulo: string }[] = [
  { valor: "orcamento", rotulo: "Fazer orçamento" },
  { valor: "consultar_pedido", rotulo: "Consultar pedido" },
  { valor: "curriculo", rotulo: "Currículo" },
  { valor: "atendente", rotulo: "Falar com atendente" },
  { valor: "mensagem", rotulo: "Somente enviar mensagem" },
];

interface FormBot {
  bot_ativo: boolean;
  bot_24h: boolean;
  usar_ia: boolean;
  permitir_orcamento_automatico: boolean;
  exigir_revisao_humana: boolean;
  enviar_msg_finalizacao: boolean;
  finalizacao_uma_vez_dia: boolean;
  inatividade_minutos: number;
  msg_boas_vindas: string;
  msg_retorno_dia: string;
  msg_menu: string;
  msg_fora_horario: string;
  msg_nao_entendi: string;
  msg_transferencia: string;
  msg_finalizacao: string;
  msg_orcamento_gerado: string;
  msg_revisao: string;
  msg_orcamento_confirmado: string;
}

const CAMPOS: { chave: keyof FormBot; rotulo: string; ajuda: string }[] = [
  { chave: "msg_boas_vindas", rotulo: "Boas-vindas (1º contato do dia)", ajuda: "Use {saudacao} e {nome}." },
  { chave: "msg_retorno_dia", rotulo: "Retorno no mesmo dia", ajuda: "Quando o cliente volta a falar no mesmo dia." },
  { chave: "msg_menu", rotulo: "Texto antes do menu", ajuda: "As opções ativas são listadas logo abaixo." },
  { chave: "msg_fora_horario", rotulo: "Fora do horário", ajuda: "Enviada quando está fora do horário de atendimento." },
  { chave: "msg_nao_entendi", rotulo: "Não entendi", ajuda: "Quando o bot não identifica o que o cliente quer." },
  { chave: "msg_transferencia", rotulo: "Transferência para atendente", ajuda: "Ao encaminhar para a fila humana." },
  { chave: "msg_finalizacao", rotulo: "Finalização", ajuda: "Ao encerrar o atendimento." },
  { chave: "msg_orcamento_gerado", rotulo: "Orçamento gerado", ajuda: "Texto antes do resumo do orçamento." },
  { chave: "msg_revisao", rotulo: "Em revisão", ajuda: "Quando o orçamento aguarda revisão da equipe." },
  { chave: "msg_orcamento_confirmado", rotulo: "Orçamento confirmado", ajuda: "Quando o cliente confirma o pedido." },
];

interface Horario {
  id: string;
  dia_semana: number;
  fechado: boolean;
  abre: string;
  fecha: string;
}

interface Opcao {
  id: string;
  nome: string;
  acao: string;
  mensagem: string;
  ordem: number;
  ativo: boolean;
  permitir_palavra_chave: boolean;
}

interface Resposta {
  id: string;
  titulo: string;
  resposta: string;
  ordem: number;
  ativo: boolean;
}

interface Palavra {
  id: string;
  texto: string;
  opcao_id: string | null;
  resposta_id: string | null;
}

function hhmm(valor: string) {
  return String(valor ?? "").slice(0, 5);
}

/** Configuração completa do atendimento automático do WhatsApp. */
export function ConfiguracaoBot() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormBot | null>(null);
  const [salvando, setSalvando] = useState(false);

  const config = useQuery({
    queryKey: ["whatsapp-config-bot"],
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_config").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const horarios = useQuery({
    queryKey: ["bot-horarios"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bot_horarios").select("*").order("dia_semana");
      if (error) throw error;
      return (data ?? []) as Horario[];
    },
  });

  const opcoes = useQuery({
    queryKey: ["bot-opcoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bot_menu_opcoes").select("*").order("ordem");
      if (error) throw error;
      return (data ?? []) as Opcao[];
    },
  });

  const respostas = useQuery({
    queryKey: ["bot-respostas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bot_respostas").select("*").order("ordem");
      if (error) throw error;
      return (data ?? []) as Resposta[];
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

  useEffect(() => {
    const d = config.data;
    if (!d || form) return;
    setForm({
      bot_ativo: Boolean(d.bot_ativo),
      bot_24h: Boolean(d.bot_24h),
      usar_ia: Boolean(d.usar_ia),
      permitir_orcamento_automatico: Boolean(d.permitir_orcamento_automatico),
      exigir_revisao_humana: Boolean(d.exigir_revisao_humana),
      enviar_msg_finalizacao: Boolean(d.enviar_msg_finalizacao),
      finalizacao_uma_vez_dia: Boolean(d.finalizacao_uma_vez_dia),
      inatividade_minutos: Number(d.inatividade_minutos ?? 5),
      msg_boas_vindas: d.msg_boas_vindas ?? "",
      msg_retorno_dia: d.msg_retorno_dia ?? "",
      msg_menu: d.msg_menu ?? "",
      msg_fora_horario: d.msg_fora_horario ?? "",
      msg_nao_entendi: d.msg_nao_entendi ?? "",
      msg_transferencia: d.msg_transferencia ?? "",
      msg_finalizacao: d.msg_finalizacao ?? "",
      msg_orcamento_gerado: d.msg_orcamento_gerado ?? "",
      msg_revisao: d.msg_revisao ?? "",
      msg_orcamento_confirmado: d.msg_orcamento_confirmado ?? "",
    });
  }, [config.data, form]);

  if (config.isLoading || !form) return <Skeleton className="h-64 max-w-4xl" />;

  const id = config.data?.id;

  async function salvarConfig() {
    if (!id || !form) return;
    setSalvando(true);
    const { error } = await supabase.from("whatsapp_config").update(form).eq("id", id);
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Atendimento automático atualizado.");
    await queryClient.invalidateQueries({ queryKey: ["whatsapp-config-bot"] });
  }

  async function salvarHorario(h: Horario, dados: Partial<Horario>) {
    const { error } = await supabase.from("bot_horarios").update(dados).eq("id", h.id);
    if (error) { toast.error(error.message); return; }
    await queryClient.invalidateQueries({ queryKey: ["bot-horarios"] });
  }

  return (
    <div className="grid max-w-4xl gap-6">
      {/* ---------- Ativação ---------- */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" /> Atendimento automático
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Alternar
            titulo="Bot ativo"
            ajuda="Responde automaticamente as conversas na aba Automático."
            valor={form.bot_ativo}
            ao={(v) => setForm({ ...form, bot_ativo: v })}
          />
          <Alternar
            titulo="Orçamento automático"
            ajuda="O bot coleta arquivos e opções e calcula com os preços cadastrados."
            valor={form.permitir_orcamento_automatico}
            ao={(v) => setForm({ ...form, permitir_orcamento_automatico: v })}
          />
          <Alternar
            titulo="Exigir revisão humana"
            ajuda="O orçamento gerado aguarda revisão antes da confirmação do cliente."
            valor={form.exigir_revisao_humana}
            ao={(v) => setForm({ ...form, exigir_revisao_humana: v })}
          />
          <Alternar
            titulo="Usar inteligência artificial"
            ajuda="Ajuda a entender mensagens escritas de forma diferente das palavras-chave."
            valor={form.usar_ia}
            ao={(v) => setForm({ ...form, usar_ia: v })}
          />

          <div className="grid gap-1 sm:max-w-xs">
            <Label>Encerrar por inatividade (minutos)</Label>
            <Input
              type="number"
              min={1}
              value={form.inatividade_minutos}
              onChange={(e) => setForm({ ...form, inatividade_minutos: Number(e.target.value || 1) })}
            />
            <p className="text-xs text-muted-foreground">
              O bot avisa uma vez e, se não houver resposta, encerra o atendimento.
            </p>
          </div>

          <Alternar
            titulo="Enviar mensagem de finalização"
            ajuda="Mensagem de despedida ao encerrar a conversa."
            valor={form.enviar_msg_finalizacao}
            ao={(v) => setForm({ ...form, enviar_msg_finalizacao: v })}
          />
          <Alternar
            titulo="Finalizar apenas uma vez por dia"
            ajuda="Evita repetir a despedida várias vezes no mesmo dia."
            valor={form.finalizacao_uma_vez_dia}
            ao={(v) => setForm({ ...form, finalizacao_uma_vez_dia: v })}
          />
        </CardContent>
      </Card>

      {/* ---------- Horários ---------- */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" /> Horário de atendimento
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Alternar
            titulo="Atender 24 horas"
            ajuda="Quando ativo, o bot responde a qualquer hora e ignora os horários abaixo."
            valor={form.bot_24h}
            ao={(v) => setForm({ ...form, bot_24h: v })}
          />

          {!form.bot_24h && (
            <div className="grid gap-2">
              {(horarios.data ?? []).map((h) => (
                <div key={h.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-2">
                  <span className="w-24 text-sm font-semibold">{DIAS[h.dia_semana]}</span>
                  <Switch
                    checked={!h.fechado}
                    onCheckedChange={(v) => void salvarHorario(h, { fechado: !v })}
                  />
                  <span className="text-xs text-muted-foreground">{h.fechado ? "Fechado" : "Aberto"}</span>
                  {!h.fechado && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        className="w-28"
                        value={hhmm(h.abre)}
                        onChange={(e) => void salvarHorario(h, { abre: e.target.value })}
                      />
                      <span className="text-xs">até</span>
                      <Input
                        type="time"
                        className="w-28"
                        value={hhmm(h.fecha)}
                        onChange={(e) => void salvarHorario(h, { fecha: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------- Opções do menu ---------- */}
      <OpcoesMenu opcoes={opcoes.data ?? []} palavras={palavras.data ?? []} />

      {/* ---------- Respostas automáticas ---------- */}
      <RespostasAutomaticas respostas={respostas.data ?? []} palavras={palavras.data ?? []} />

      {/* ---------- Mensagens ---------- */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" /> Mensagens
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {CAMPOS.map((campo) => (
            <div key={campo.chave} className="grid gap-1">
              <Label>{campo.rotulo}</Label>
              <Textarea
                rows={2}
                value={String(form[campo.chave] ?? "")}
                onChange={(e) => setForm({ ...form, [campo.chave]: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">{campo.ajuda}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={salvarConfig} disabled={salvando}>
          <Save className="h-4 w-4" /> {salvando ? "Salvando..." : "Salvar configurações do bot"}
        </Button>
      </div>

      <Simulador />
    </div>
  );
}

function Alternar({
  titulo,
  ajuda,
  valor,
  ao,
}: {
  titulo: string;
  ajuda: string;
  valor: boolean;
  ao: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 text-sm">
      <span>
        <strong>{titulo}</strong>
        <span className="block text-xs text-muted-foreground">{ajuda}</span>
      </span>
      <Switch checked={valor} onCheckedChange={ao} />
    </label>
  );
}

/** Editor das palavras-chave de uma opção ou resposta. */
function CampoPalavras({
  palavras,
  onSalvar,
}: {
  palavras: Palavra[];
  onSalvar: (lista: string[]) => Promise<void>;
}) {
  const inicial = useMemo(() => palavras.map((p) => p.texto).join(", "), [palavras]);
  const [texto, setTexto] = useState(inicial);

  useEffect(() => setTexto(inicial), [inicial]);

  return (
    <div className="grid gap-1">
      <Label className="text-xs">Palavras-chave (separadas por vírgula)</Label>
      <Input
        value={texto}
        placeholder="orçamento, preço, quanto custa"
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => {
          if (texto === inicial) return;
          void onSalvar(
            texto
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          );
        }}
      />
    </div>
  );
}

function OpcoesMenu({ opcoes, palavras }: { opcoes: Opcao[]; palavras: Palavra[] }) {
  const queryClient = useQueryClient();

  async function recarregar() {
    await queryClient.invalidateQueries({ queryKey: ["bot-opcoes"] });
    await queryClient.invalidateQueries({ queryKey: ["bot-palavras"] });
  }

  async function atualizar(o: Opcao, dados: Partial<Opcao>) {
    const { error } = await supabase.from("bot_menu_opcoes").update(dados).eq("id", o.id);
    if (error) { toast.error(error.message); return; }
    await recarregar();
  }

  async function mover(indice: number, direcao: -1 | 1) {
    const atual = opcoes[indice];
    const outro = opcoes[indice + direcao];
    if (!atual || !outro) return;
    await supabase.from("bot_menu_opcoes").update({ ordem: outro.ordem }).eq("id", atual.id);
    await supabase.from("bot_menu_opcoes").update({ ordem: atual.ordem }).eq("id", outro.id);
    await recarregar();
  }

  async function adicionar() {
    const ordem = Math.max(0, ...opcoes.map((o) => o.ordem)) + 1;
    const { error } = await supabase
      .from("bot_menu_opcoes")
      .insert({ nome: "Nova opção", acao: "mensagem", mensagem: "", ordem });
    if (error) { toast.error(error.message); return; }
    await recarregar();
  }

  async function excluir(o: Opcao) {
    const { error } = await supabase.from("bot_menu_opcoes").delete().eq("id", o.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Opção removida.");
    await recarregar();
  }

  async function salvarPalavras(o: Opcao, lista: string[]) {
    await supabase.from("bot_palavras_chave").delete().eq("opcao_id", o.id);
    if (lista.length > 0) {
      const { error } = await supabase
        .from("bot_palavras_chave")
        .insert(lista.map((texto) => ({ texto, opcao_id: o.id })));
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Palavras-chave atualizadas.");
    await recarregar();
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Opções do menu</CardTitle>
        <Button size="sm" variant="outline" onClick={adicionar}>
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        {opcoes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma opção cadastrada.</p>}

        {opcoes.map((o, i) => (
          <div key={o.id} className="grid gap-3 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{i + 1}</Badge>
              <Input
                className="min-w-40 flex-1"
                value={o.nome}
                onChange={(e) => void atualizar(o, { nome: e.target.value })}
              />
              <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => void mover(i, -1)}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={i === opcoes.length - 1}
                onClick={() => void mover(i, 1)}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <ConfirmarExclusao
                titulo="Remover opção"
                descricao={`A opção "${o.nome}" deixará de aparecer no menu.`}
                onConfirmar={() => excluir(o)}
              >
                <Button size="icon" variant="ghost">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </ConfirmarExclusao>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <Label className="text-xs">O que essa opção faz</Label>
                <Select value={o.acao} onValueChange={(v) => void atualizar(o, { acao: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACOES.map((a) => (
                      <SelectItem key={a.valor} value={a.valor}>
                        {a.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <CampoPalavras
                palavras={palavras.filter((p) => p.opcao_id === o.id)}
                onSalvar={(lista) => salvarPalavras(o, lista)}
              />
            </div>

            <div className="grid gap-1">
              <Label className="text-xs">Mensagem enviada ao escolher</Label>
              <Textarea rows={2} value={o.mensagem} onChange={(e) => void atualizar(o, { mensagem: e.target.value })} />
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={o.ativo} onCheckedChange={(v) => void atualizar(o, { ativo: v })} /> Ativa
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Switch
                  checked={o.permitir_palavra_chave}
                  onCheckedChange={(v) => void atualizar(o, { permitir_palavra_chave: v })}
                />
                Aceitar palavras-chave
              </label>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RespostasAutomaticas({ respostas, palavras }: { respostas: Resposta[]; palavras: Palavra[] }) {
  const queryClient = useQueryClient();

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
    const ordem = Math.max(0, ...respostas.map((r) => r.ordem)) + 1;
    const { error } = await supabase
      .from("bot_respostas")
      .insert({ titulo: "Nova resposta", resposta: "", ordem });
    if (error) { toast.error(error.message); return; }
    await recarregar();
  }

  async function excluir(r: Resposta) {
    const { error } = await supabase.from("bot_respostas").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Resposta removida.");
    await recarregar();
  }

  async function salvarPalavras(r: Resposta, lista: string[]) {
    await supabase.from("bot_palavras_chave").delete().eq("resposta_id", r.id);
    if (lista.length > 0) {
      const { error } = await supabase
        .from("bot_palavras_chave")
        .insert(lista.map((texto) => ({ texto, resposta_id: r.id })));
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Palavras-chave atualizadas.");
    await recarregar();
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Respostas automáticas</CardTitle>
        <Button size="sm" variant="outline" onClick={adicionar}>
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        {respostas.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Cadastre perguntas frequentes (horário, endereço, formas de pagamento).
          </p>
        )}

        {respostas.map((r) => (
          <div key={r.id} className="grid gap-3 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="min-w-40 flex-1"
                value={r.titulo}
                onChange={(e) => void atualizar(r, { titulo: e.target.value })}
              />
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={r.ativo} onCheckedChange={(v) => void atualizar(r, { ativo: v })} /> Ativa
              </label>
              <ConfirmarExclusao
                titulo="Remover resposta"
                descricao={`A resposta "${r.titulo}" será excluída.`}
                onConfirmar={() => excluir(r)}
              >
                <Button size="icon" variant="ghost">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </ConfirmarExclusao>
            </div>

            <CampoPalavras
              palavras={palavras.filter((p) => p.resposta_id === r.id)}
              onSalvar={(lista) => salvarPalavras(r, lista)}
            />

            <div className="grid gap-1">
              <Label className="text-xs">Resposta enviada</Label>
              <Textarea rows={2} value={r.resposta} onChange={(e) => void atualizar(r, { resposta: e.target.value })} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

interface Bolha {
  de: "cliente" | "bot";
  texto: string;
  botoes?: string[] | undefined;
}

/** Simulador de conversa usando as configurações já salvas. */
function Simulador() {
  const simular = useServerFn(simularBot);
  const [bolhas, setBolhas] = useState<Bolha[]>([]);
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<{
    etapa: string;
    pendenteTipo?: "opcao" | "resposta" | null | undefined;
    pendenteId?: string | null | undefined;
  }>({ etapa: "inicio" });
  const [ocupado, setOcupado] = useState(false);
  const fim = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [bolhas]);

  async function enviar(mensagem: string, tipo: "texto" | "documento" = "texto") {
    if (ocupado) return;
    setOcupado(true);
    setBolhas((b) => [...b, { de: "cliente", texto: tipo === "documento" ? "📎 arquivo.pdf" : mensagem }]);
    setTexto("");

    try {
      const r = await simular({
        data: {
          texto: mensagem,
          tipo,
          etapa: estado.etapa,
          pendenteTipo: estado.pendenteTipo ?? null,
          pendenteId: estado.pendenteId ?? null,
          primeiraDoDia: bolhas.length === 0,
        },
      });
      setEstado({ etapa: r.etapa, pendenteTipo: r.pendenteTipo, pendenteId: r.pendenteId });
      setBolhas((b) => [...b, ...r.mensagens.map((m) => ({ de: "bot" as const, texto: m.texto, botoes: m.botoes }))]);
      if (r.aviso) toast.error(r.aviso);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na simulação.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Simulador de conversa</CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setBolhas([]);
            setEstado({ etapa: "inicio" });
          }}
        >
          Reiniciar
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-xs text-muted-foreground">
          O simulador usa as configurações já salvas. Salve as alterações antes de testar.
        </p>

        <div className="h-80 overflow-y-auto rounded-lg bg-muted/40 p-3">
          {bolhas.length === 0 && (
            <p className="text-center text-xs text-muted-foreground">Envie uma mensagem para começar.</p>
          )}
          <div className="grid gap-2">
            {bolhas.map((b, i) => (
              <div key={i} className={b.de === "cliente" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    b.de === "cliente" ? "bg-primary text-primary-foreground" : "bg-background border"
                  }`}
                >
                  <span className="mb-1 flex items-center gap-1 text-[10px] uppercase opacity-70">
                    {b.de === "cliente" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                    {b.de === "cliente" ? "Cliente" : "Bot"}
                  </span>
                  {b.texto}
                  {b.botoes && (
                    <span className="mt-2 flex flex-wrap gap-1">
                      {b.botoes.map((x) => (
                        <Button key={x} size="sm" variant="outline" onClick={() => void enviar(x)}>
                          {x}
                        </Button>
                      ))}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div ref={fim} />
        </div>

        <div className="flex gap-2">
          <Input
            value={texto}
            placeholder="Escreva como o cliente..."
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && texto.trim()) void enviar(texto.trim());
            }}
          />
          <Button variant="outline" onClick={() => void enviar("", "documento")} disabled={ocupado}>
            📎
          </Button>
          <Button onClick={() => texto.trim() && void enviar(texto.trim())} disabled={ocupado}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

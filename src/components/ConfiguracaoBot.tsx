import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot, Clock, MessageSquare, Save, Send, User } from "lucide-react";
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
import { FluxosPainel } from "@/components/bot/FluxosPainel";
import { RespostasPainel } from "@/components/bot/RespostasPainel";
import { NumerosPainel } from "@/components/bot/NumerosPainel";
import { PrimeiroContatoPainel } from "@/components/bot/PrimeiroContatoPainel";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Mostra quando a rotina automática do bot agiu pela última vez. */
function UltimaRotina() {
  const { data } = useQuery({
    queryKey: ["bot-ultima-rotina"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_auditoria")
        .select("acao, created_at")
        .in("acao", ["bot_inatividade", "bot_inatividade2", "bot_fluxo_inicial"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });

  return (
    <p className="text-xs text-muted-foreground">
      Rotina automática:{" "}
      {data?.created_at
        ? `última ação em ${new Date(data.created_at).toLocaleString("pt-BR")}`
        : "ainda sem ações registradas"}
      .
    </p>
  );
}


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
  inatividade1_minutos: number;
  inatividade2_minutos: number;
  fallback_inicial_minutos: number;
  inatividade_status: string;
  msg_inatividade1: string;
  msg_inatividade_pendente: string;
  msg_inatividade_aguardando: string;
  msg_inatividade_em_atendimento: string;
  msg_inatividade_finalizado: string;
  msg_fora_horario: string;
  msg_fora_horario_ativo: boolean;
  msg_transferencia: string;
  msg_transferencia_ativo: boolean;
  msg_finalizacao: string;
  msg_finalizacao_ativo: boolean;
  msg_orcamento_gerado: string;
  msg_orcamento_gerado_ativo: boolean;
  msg_revisao: string;
  msg_revisao_ativo: boolean;
  msg_orcamento_confirmado: string;
  msg_orcamento_confirmado_ativo: boolean;
}

const STATUS_INATIVIDADE: { valor: string; rotulo: string }[] = [
  { valor: "pendente", rotulo: "Pendente" },
  { valor: "aguardando", rotulo: "Aguardando" },
  { valor: "em_atendimento", rotulo: "Em atendimento" },
  { valor: "finalizado", rotulo: "Finalizado" },
];

const MSG_STATUS: { valor: string; chave: keyof FormBot }[] = [
  { valor: "pendente", chave: "msg_inatividade_pendente" },
  { valor: "aguardando", chave: "msg_inatividade_aguardando" },
  { valor: "em_atendimento", chave: "msg_inatividade_em_atendimento" },
  { valor: "finalizado", chave: "msg_inatividade_finalizado" },
];

const CAMPOS: { chave: keyof FormBot; ativo: keyof FormBot; rotulo: string; ajuda: string }[] = [
  { chave: "msg_fora_horario", ativo: "msg_fora_horario_ativo", rotulo: "Fora do horário", ajuda: "Enviada quando está fora do horário de atendimento." },
  { chave: "msg_transferencia", ativo: "msg_transferencia_ativo", rotulo: "Transferência para atendente", ajuda: "Ao encaminhar para a fila humana." },
  { chave: "msg_finalizacao", ativo: "msg_finalizacao_ativo", rotulo: "Finalização", ajuda: "Ao encerrar o atendimento." },
  { chave: "msg_orcamento_gerado", ativo: "msg_orcamento_gerado_ativo", rotulo: "Orçamento gerado", ajuda: "Texto antes do resumo do orçamento." },
  { chave: "msg_revisao", ativo: "msg_revisao_ativo", rotulo: "Em revisão", ajuda: "Quando o orçamento aguarda revisão da equipe." },
  { chave: "msg_orcamento_confirmado", ativo: "msg_orcamento_confirmado_ativo", rotulo: "Orçamento confirmado", ajuda: "Quando o cliente confirma o pedido." },
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
      inatividade1_minutos: Number(d.inatividade1_minutos ?? 5),
      inatividade2_minutos: Number(d.inatividade2_minutos ?? 10),
      fallback_inicial_minutos: Number(d.fallback_inicial_minutos ?? 2),
      inatividade_status: d.inatividade_status ?? "finalizado",
      msg_inatividade1: d.msg_inatividade1 ?? "",
      msg_inatividade_pendente: d.msg_inatividade_pendente ?? "",
      msg_inatividade_aguardando: d.msg_inatividade_aguardando ?? "",
      msg_inatividade_em_atendimento: d.msg_inatividade_em_atendimento ?? "",
      msg_inatividade_finalizado: d.msg_inatividade_finalizado ?? "",
      msg_fora_horario: d.msg_fora_horario ?? "",
      msg_fora_horario_ativo: d.msg_fora_horario_ativo !== false,
      msg_transferencia: d.msg_transferencia ?? "",
      msg_transferencia_ativo: d.msg_transferencia_ativo !== false,
      msg_finalizacao: d.msg_finalizacao ?? "",
      msg_finalizacao_ativo: d.msg_finalizacao_ativo !== false,
      msg_orcamento_gerado: d.msg_orcamento_gerado ?? "",
      msg_orcamento_gerado_ativo: d.msg_orcamento_gerado_ativo !== false,
      msg_revisao: d.msg_revisao ?? "",
      msg_revisao_ativo: d.msg_revisao_ativo !== false,
      msg_orcamento_confirmado: d.msg_orcamento_confirmado ?? "",
      msg_orcamento_confirmado_ativo: d.msg_orcamento_confirmado_ativo !== false,
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
    <div className="grid max-w-4xl gap-4">
      <div className="flex justify-end">
        <Button onClick={salvarConfig} disabled={salvando}>
          <Save className="h-4 w-4" /> {salvando ? "Salvando..." : "Salvar configurações do bot"}
        </Button>
      </div>

      <Tabs defaultValue="geral">
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="horarios">Horários</TabsTrigger>
          <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
          <TabsTrigger value="primeiro">Primeiro contato</TabsTrigger>
          <TabsTrigger value="menu">Fluxos</TabsTrigger>
          <TabsTrigger value="respostas">Respostas automáticas</TabsTrigger>
          <TabsTrigger value="inatividade">Inatividade</TabsTrigger>
          <TabsTrigger value="numeros">Números</TabsTrigger>
          <TabsTrigger value="simulador">Simulador</TabsTrigger>

        </TabsList>

        {/* ---------- Geral ---------- */}
        <TabsContent value="geral">
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- Horários ---------- */}
        <TabsContent value="horarios">
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
        </TabsContent>

        {/* ---------- Mensagens ---------- */}
        <TabsContent value="mensagens">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" /> Mensagens
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {CAMPOS.map((campo) => (
                <div key={campo.chave} className="grid gap-1 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label>{campo.rotulo}</Label>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      {form[campo.ativo] ? "Ativo" : "Desativado"}
                      <Switch
                        checked={Boolean(form[campo.ativo])}
                        onCheckedChange={(v) => setForm({ ...form, [campo.ativo]: v })}
                      />
                    </label>
                  </div>
                  <Textarea
                    rows={2}
                    disabled={!form[campo.ativo]}
                    value={String(form[campo.chave] ?? "")}
                    onChange={(e) => setForm({ ...form, [campo.chave]: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">{campo.ajuda}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- Fluxos ---------- */}
        <TabsContent value="menu">
          <FluxosPainel />
        </TabsContent>


        {/* ---------- Respostas automáticas ---------- */}
        <TabsContent value="primeiro">
          <PrimeiroContatoPainel />
        </TabsContent>

        <TabsContent value="respostas">
          <RespostasPainel />
        </TabsContent>

        {/* ---------- Números atendidos pelo bot ---------- */}
        <TabsContent value="numeros">
          <NumerosPainel />
        </TabsContent>


        {/* ---------- Inatividade e finalização ---------- */}
        <TabsContent value="inatividade">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Inatividade e finalização</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <p className="text-xs text-muted-foreground">
                A inatividade só é contada nas conversas da aba <strong>Automático</strong> em que o bot está
                aguardando a resposta do cliente.
              </p>
              <UltimaRotina />


              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label>1ª inatividade (minutos)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.inatividade1_minutos}
                    onChange={(e) => setForm({ ...form, inatividade1_minutos: Number(e.target.value || 1) })}
                  />
                </div>
                <div className="grid gap-1">
                  <Label>2ª inatividade (minutos)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.inatividade2_minutos}
                    onChange={(e) => setForm({ ...form, inatividade2_minutos: Number(e.target.value || 1) })}
                  />
                </div>
              </div>

              <div className="grid gap-1 sm:max-w-xs">
                <Label>Iniciar fluxo inicial após (minutos)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.fallback_inicial_minutos}
                  onChange={(e) => setForm({ ...form, fallback_inicial_minutos: Number(e.target.value || 0) })}
                />
                <p className="text-xs text-muted-foreground">
                  Quando o bot não reconhece nenhum fluxo ou resposta automática, ele inicia o fluxo inicial após
                  esse tempo. Use 0 para desativar. Conversas aguardando confirmação Sim/Não seguem a regra de
                  inatividade.
                </p>
              </div>

              <div className="grid gap-1">
                <Label>Mensagem da 1ª inatividade</Label>
                <Textarea
                  rows={2}
                  value={form.msg_inatividade1}
                  onChange={(e) => setForm({ ...form, msg_inatividade1: e.target.value })}
                />
              </div>

              <div className="grid gap-1 sm:max-w-xs">
                <Label>Na 2ª inatividade, mover para</Label>
                <Select
                  value={form.inatividade_status}
                  onValueChange={(v) => setForm({ ...form, inatividade_status: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_INATIVIDADE.map((s) => (
                      <SelectItem key={s.valor} value={s.valor}>{s.rotulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {MSG_STATUS.map((m) => {
                const rotulo = STATUS_INATIVIDADE.find((s) => s.valor === m.valor)?.rotulo ?? m.valor;
                return (
                  <div key={m.valor} className="grid gap-1">
                    <Label className="text-xs">Mensagem ao mover para {rotulo}</Label>
                    <Textarea
                      rows={2}
                      value={String(form[m.chave] ?? "")}
                      onChange={(e) => setForm({ ...form, [m.chave]: e.target.value })}
                    />
                  </div>
                );
              })}

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
        </TabsContent>

        {/* ---------- Simulador ---------- */}
        <TabsContent value="simulador">
          <Simulador />
        </TabsContent>
      </Tabs>
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

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { automacaoSchema, type AutomacaoInput } from "./utils/automacoes";

type Cliente = SupabaseClient<Database>;
export type AutomacaoItem = Database["public"]["Tables"]["agente_automacoes"]["Row"];

export interface FerramentaAutomavel {
  chave: string;
  nome: string;
  descricao: string | null;
}

export interface TarefaAutomacaoHistorico {
  id: string;
  status: string;
  tentativas: number;
  max_tentativas: number;
  ultimo_erro: string | null;
  agendado_para: string;
  criado_em: string;
  atualizado_em: string;
  execucao_id: string | null;
  origem: string | null;
  execucao_status: string | null;
}

export interface WorkerMonitorado {
  worker_id: string;
  status: string;
  estado: "online" | "ocupado" | "inativo" | "parado";
  versao: string | null;
  hostname: string | null;
  processos: number;
  ultimo_ping: string;
}

export interface AlertaItem {
  id: string;
  tipo: string;
  severidade: "info" | "aviso" | "critico";
  titulo: string;
  descricao: string | null;
  origem: string;
  referencia_tipo: string | null;
  referencia_id: string | null;
  status: "aberto" | "reconhecido" | "resolvido";
  criado_em: string;
  atualizado_em: string;
}

export interface MonitoramentoResumo {
  agentes_total: number;
  agentes_ativos: number;
  agentes: Array<{
    id: string;
    nome: string;
    tipo: string;
    ativo: boolean;
    tarefas_aguardando: number;
    tarefas_em_execucao: number;
    ultima_atividade: string | null;
  }>;
  workers: WorkerMonitorado[];
  workers_online: number;
  workers_ocupados: number;
  workers_inativos: number;
  tarefas: {
    aguardando: number;
    em_execucao: number;
    concluidas_24h: number;
    falhas_24h: number;
    mais_antiga_aguardando: string | null;
  };
  aprovacoes_pendentes: number;
  ultima_atividade: string | null;
  tempo_medio_execucao_ms: number | null;
  execucoes_24h: { concluidas: number; falhas: number };
  tarefas_recentes: Array<{
    id: string;
    tipo: string;
    status: string;
    tentativas: number;
    max_tentativas: number;
    agendado_para: string;
    ultimo_erro: string | null;
    criado_em: string;
    atualizado_em: string;
    agente_nome: string;
    automacao_id: string | null;
  }>;
  alertas: AlertaItem[];
  atualizado_em: string;
}

export interface ResultadoOperacao {
  ok: boolean;
  erro: string | null;
}
export interface ResultadoSalvar extends ResultadoOperacao {
  id: string | null;
}
export interface ResultadoExecucaoManual extends ResultadoOperacao {
  tarefaId: string | null;
}

type Contexto = { supabase: Cliente; userId: string };

async function exigir(context: Contexto, chave: string, acao = false) {
  const { data } = acao
    ? await context.supabase.rpc("agente_pode_acao", { _chave: chave })
    : await context.supabase.rpc("pode_agentes", { _chave: chave });
  if (!data) throw new Error("Você não tem permissão para esta operação.");
}

async function auditar(
  context: Contexto,
  acao: string,
  dados: Json,
  opcoes: { agenteId?: string | null; entidadeId?: string } = {},
) {
  try {
    await context.supabase.rpc("agente_registrar_auditoria", {
      _acao: acao,
      _dados: dados,
      _entidade: "agente_automacoes",
      ...(opcoes.agenteId ? { _agente_id: opcoes.agenteId } : {}),
      ...(opcoes.entidadeId ? { _entidade_id: opcoes.entidadeId } : {}),
    });
  } catch {
    // A auditoria nunca derruba a operação principal.
  }
}

/** Ferramentas que uma automação pode usar: vinculadas ao agente, de consulta e não sensíveis. */
async function ferramentasAutomaveisDoAgente(supabase: Cliente, agenteId: string): Promise<FerramentaAutomavel[]> {
  const { data: vinculos, error } = await supabase
    .from("agente_ferramenta_vinculos")
    .select("ferramenta_id")
    .eq("agente_id", agenteId)
    .eq("ativo", true);
  if (error) throw new Error(error.message);
  const ids = (vinculos ?? []).map((v) => v.ferramenta_id);
  if (ids.length === 0) return [];

  const { data: ferramentas, error: errF } = await supabase
    .from("agente_ferramentas")
    .select("chave, nome, descricao, tipo, sensivel, ativo")
    .in("id", ids)
    .eq("ativo", true)
    .eq("tipo", "consulta")
    .eq("sensivel", false)
    .order("nome");
  if (errF) throw new Error(errF.message);
  return (ferramentas ?? []).map((f) => ({ chave: f.chave, nome: f.nome, descricao: f.descricao }));
}

function mensagemErro(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m || "Operação não concluída.";
}

// ------------------------------------------------------------------ listagem
export const listarAutomacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AutomacaoItem[]> => {
    await exigir(context, "agentes.visualizar");
    const { data, error } = await context.supabase
      .from("agente_automacoes")
      .select("*")
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as AutomacaoItem[];
  });

export const listarFerramentasAutomaveis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ agenteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<FerramentaAutomavel[]> => {
    await exigir(context, "agentes.visualizar");
    return ferramentasAutomaveisDoAgente(context.supabase, data.agenteId);
  });

// ------------------------------------------------------------- criar / editar
export const salvarAutomacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid().optional(), dados: automacaoSchema }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ResultadoSalvar> => {
    await exigir(context, "agentes.gerenciar");
    const d: AutomacaoInput = data.dados;

    // A automação nunca amplia as permissões do agente: só ferramentas de
    // consulta, não sensíveis e vinculadas a ele.
    const permitidas = await ferramentasAutomaveisDoAgente(context.supabase, d.agente_id);
    const chavesOk = new Set(permitidas.map((f) => f.chave));
    const invalidas = d.ferramentas_permitidas.filter((c) => !chavesOk.has(c));
    if (invalidas.length > 0) {
      return { ok: false as const, erro: `Ferramenta não autorizada para este agente: ${invalidas.join(", ")}.`, id: null };
    }

    const recorrente = d.tipo_gatilho === "recorrente";
    const campos = {
      agente_id: d.agente_id,
      nome: d.nome,
      descricao: d.descricao?.trim() || null,
      tipo_gatilho: d.tipo_gatilho,
      frequencia: recorrente ? (d.frequencia ?? null) : null,
      intervalo_minutos: recorrente && d.frequencia === "intervalo" ? (d.intervalo_minutos ?? null) : null,
      hora_local: recorrente && d.frequencia !== "intervalo" ? (d.hora_local ?? null) : null,
      dias_semana: recorrente && d.frequencia === "semanal" ? [...new Set(d.dias_semana)].sort() : [],
      executar_em: d.tipo_gatilho === "agendado" ? (d.executar_em ?? null) : null,
      fuso: d.fuso,
      evento: d.tipo_gatilho === "evento" ? (d.evento ?? null) : null,
      acao: { mensagem: d.mensagem } as Json,
      ferramentas_permitidas: d.ferramentas_permitidas,
      max_tentativas: d.max_tentativas,
      desativar_apos_falhas: d.desativar_apos_falhas,
      tolerancia_minutos: d.tolerancia_minutos,
    };

    try {
      if (data.id) {
        const { error } = await context.supabase.from("agente_automacoes").update(campos).eq("id", data.id);
        if (error) throw new Error(error.message);
        await auditar(context, "automacao.editada", { nome: d.nome, tipo: d.tipo_gatilho }, { agenteId: d.agente_id, entidadeId: data.id });
        return { ok: true as const, erro: null, id: data.id };
      }

      // Nasce pausada: o usuário revisa e ativa explicitamente.
      const { data: criada, error } = await context.supabase
        .from("agente_automacoes")
        .insert({ ...campos, ativo: false, criado_por: context.userId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await auditar(context, "automacao.criada", { nome: d.nome, tipo: d.tipo_gatilho }, { agenteId: d.agente_id, entidadeId: criada.id });
      return { ok: true as const, erro: null, id: criada.id };
    } catch (e) {
      return { ok: false as const, erro: mensagemErro(e), id: null };
    }
  });

// ------------------------------------------------------------ ativar / pausar
export const alterarEstadoAutomacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid(), ativo: z.boolean() }).parse(input))
  .handler(async ({ data, context }): Promise<ResultadoOperacao> => {
    await exigir(context, "agentes.gerenciar");
    const { data: atual } = await context.supabase
      .from("agente_automacoes")
      .select("agente_id, nome")
      .eq("id", data.id)
      .maybeSingle();
    if (!atual) return { ok: false as const, erro: "Automação não encontrada." };

    const { error } = await context.supabase.from("agente_automacoes").update({ ativo: data.ativo }).eq("id", data.id);
    if (error) return { ok: false as const, erro: mensagemErro(error) };
    await auditar(context, data.ativo ? "automacao.ativada" : "automacao.pausada", { nome: atual.nome }, { agenteId: atual.agente_id, entidadeId: data.id });
    return { ok: true as const, erro: null };
  });

// ----------------------------------------------------------- execução manual
export const executarAutomacaoManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ResultadoExecucaoManual> => {
    // Exige a permissão explícita `agentes.executar` (não concedida ao admin automaticamente).
    await exigir(context, "agentes.executar", true);

    const { data: automacao } = await context.supabase
      .from("agente_automacoes")
      .select("id, nome, agente_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!automacao) return { ok: false as const, erro: "Automação não encontrada.", tarefaId: null };

    const { data: agente } = await context.supabase
      .from("agentes")
      .select("ativo, nome")
      .eq("id", automacao.agente_id)
      .maybeSingle();
    if (!agente?.ativo) {
      return { ok: false as const, erro: `O agente "${agente?.nome ?? "?"}" está desativado.`, tarefaId: null };
    }

    // Janela de 10 s por usuário: cliques repetidos não enfileiram duplicatas.
    const janela = Math.floor(Date.now() / 10_000);
    const { data: tarefaId, error } = await context.supabase.rpc("agente_enfileirar_tarefa", {
      _agente_id: automacao.agente_id,
      _tipo: "automacao",
      _payload: { automacao_id: automacao.id, origem: "manual", solicitado_por: context.userId } as Json,
      _idempotency_key: `automacao:${automacao.id}:manual:${context.userId}:${janela}`,
    });
    if (error) {
      const duplicada = /duplicate|unique|idempot/i.test(error.message);
      return {
        ok: false as const,
        erro: duplicada ? "Esta automação acabou de ser solicitada. Aguarde alguns segundos." : mensagemErro(error),
        tarefaId: null,
      };
    }
    await auditar(context, "automacao.execucao_manual", { nome: automacao.nome }, { agenteId: automacao.agente_id, entidadeId: automacao.id });
    return { ok: true as const, erro: null, tarefaId: tarefaId as string };
  });

// ----------------------------------------------------------------- histórico
export const historicoAutomacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid(), limite: z.number().int().min(1).max(200).default(30) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<TarefaAutomacaoHistorico[]> => {
    const { data: itens, error } = await context.supabase.rpc("agente_automacao_historico", {
      _automacao_id: data.id,
      _limite: data.limite,
    });
    if (error) throw new Error(error.message);
    return (itens ?? []) as unknown as TarefaAutomacaoHistorico[];
  });

// ------------------------------------------------------------- monitoramento
export const obterMonitoramento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MonitoramentoResumo> => {
    await exigir(context, "agentes.visualizar");

    // Mantém os alertas atualizados mesmo se nenhum worker estiver rodando
    // (função idempotente: não duplica alertas abertos).
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.rpc("agente_gerar_alertas");
    } catch {
      // Falha em gerar alertas não impede a leitura do painel.
    }

    const { data, error } = await context.supabase.rpc("agente_monitoramento_resumo");
    if (error) throw new Error(error.message);
    return data as unknown as MonitoramentoResumo;
  });

export const atualizarAlerta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["reconhecido", "resolvido"]) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ResultadoOperacao> => {
    await exigir(context, "agentes.gerenciar");
    const { data: ok, error } = await context.supabase.rpc("agente_alerta_atualizar_status", {
      _id: data.id,
      _status: data.status,
    });
    if (error) return { ok: false as const, erro: mensagemErro(error) };
    return { ok: Boolean(ok), erro: ok ? null : "Alerta já resolvido ou inexistente." };
  });

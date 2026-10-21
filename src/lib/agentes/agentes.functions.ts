import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";

/**
 * Central de Agentes — funções administrativas e de leitura.
 *
 * Regras:
 * - Toda escrita é validada com zod e com permissão verificada no servidor.
 * - Configuração (agentes/ferramentas) usa `pode_agentes('agentes.gerenciar')`
 *   (administrador OU permissão no perfil).
 * - Ações sensíveis (aprovar) usam `agente_pode_acao`, que NÃO concede nada
 *   automaticamente ao administrador.
 * - O navegador nunca recebe credenciais; as escritas usam service_role por
 *   trás da verificação, mantendo o RLS como segunda barreira.
 * - Nenhuma ferramenta é executada nesta etapa.
 */

// ----------------------------------------------------------- interfaces
export interface PermissoesAgentes {
  visualizar: boolean;
  gerenciar: boolean;
  executar: boolean;
  aprovar: boolean;
  dispositivos: boolean;
}

export interface AgenteResumo {
  id: string;
  chave: string;
  nome: string;
  tipo: string;
  descricao: string;
  ativo: boolean;
  icone: string;
  modelo: string | null;
  temperatura: number | null;
  rota_painel: string | null;
  ordem: number;
  total_ferramentas: number;
  tem_prompt: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface FerramentaResumo {
  id: string;
  chave: string;
  nome: string;
  descricao: string;
  categoria: string;
  tipo: string;
  risco: string;
  sensivel: boolean;
  efeito_externo: boolean;
  idempotente: boolean;
  ativo: boolean;
  parametros_schema: Json;
  resultado_schema: Json;
}

export interface VersaoAgente {
  id: string;
  tipo: string;
  versao: number;
  ativo: boolean;
  conteudo: Json;
  observacao: string;
  criado_em: string;
}

export interface VinculoFerramenta {
  ferramenta_id: string;
  ativo: boolean;
  config: Json;
}

export interface ExecucaoResumo {
  id: string;
  agente_id: string;
  agente_nome: string;
  origem: string;
  status: string;
  profundidade: number;
  erro: string | null;
  modelo_usado: string | null;
  tokens_entrada: number;
  tokens_saida: number;
  custo_estimado: number | null;
  criado_em: string;
  iniciado_em: string | null;
  concluido_em: string | null;
}

export interface PassoResumo {
  id: string;
  ordem: number;
  tipo: string;
  descricao: string;
  ferramenta_id: string | null;
  parametros: Json;
  parametros_hash: string | null;
  resultado: Json | null;
  erro: string | null;
  status: string;
  tentativas: number;
  iniciado_em: string | null;
  concluido_em: string | null;
}

export interface AprovacaoResumo {
  id: string;
  execucao_id: string;
  passo_id: string | null;
  status: string;
  parametros: Json;
  parametros_hash: string;
  solicitado_em: string;
  decidido_em: string | null;
  decidido_por: string | null;
  motivo: string | null;
  expira_em: string | null;
  agente_nome: string;
}

export interface AuditoriaItem {
  id: string;
  acao: string;
  entidade: string | null;
  entidade_id: string | null;
  dados: Json;
  agente_id: string | null;
  execucao_id: string | null;
  usuario_id: string | null;
  criado_em: string;
}

export interface VersaoAgenteDetalhe {
  id: string;
  tipo: string;
  versao: number;
  ativo: boolean;
  conteudo: Json;
  observacao: string;
  criado_por: string | null;
  criado_em: string;
}

export interface ProvedorIAStatus {
  provedor: string;
  modelo_texto: string;
  modelo_audio: string;
  tem_chave_propria: boolean;
  status: "configurado" | "sem_chave" | "usando_gateway";
}

export interface ConfiguracaoCentral {
  limite_profundidade_agentes: number;
  timeout_execucao_segundos: number;
  max_tentativas_padrao: number;
  lease_tarefa_segundos: number;
  aprovacao_expira_horas: number;
  idempotencia_expira_dias: number;
  auditoria_retencao_dias: number;
}

export interface MetricasCentral {
  agentes_total: number;
  agentes_ativos: number;
  execucoes_24h: number;
  aguardando_aprovacao: number;
  falhas_24h: number;
  aprovacoes_pendentes: number;
  tarefas_aguardando: number;
  dispositivos_ativos: number;
  workers_online: number;
  atualizado_em: string;
}

// -------------------------------------------------------- permissões
export const minhasPermissoesAgentes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PermissoesAgentes> => {
    const checar = async (chave: string, acao = false) => {
      const { data } = acao
        ? await context.supabase.rpc("agente_pode_acao", { _chave: chave })
        : await context.supabase.rpc("pode_agentes", { _chave: chave });
      return Boolean(data);
    };
    const [visualizar, gerenciar, executar, aprovar, dispositivos] = await Promise.all([
      checar("agentes.visualizar"),
      checar("agentes.gerenciar"),
      checar("agentes.executar", true),
      checar("agentes.aprovar", true),
      checar("agentes.dispositivos.gerenciar", true),
    ]);
    return { visualizar, gerenciar, executar, aprovar, dispositivos };
  });

async function auditar(
  context: { supabase: SupabaseClient<Database>; userId: string },
  acao: string,
  dados: Json,
  opcoes: { agenteId?: string | null; execucaoId?: string | null; entidade?: string; entidadeId?: string } = {},
) {
  try {
    const args: Database["public"]["Functions"]["agente_registrar_auditoria"]["Args"] = {
      _acao: acao,
      _dados: dados,
    };
    if (opcoes.agenteId) args._agente_id = opcoes.agenteId;
    if (opcoes.execucaoId) args._execucao_id = opcoes.execucaoId;
    if (opcoes.entidade) args._entidade = opcoes.entidade;
    if (opcoes.entidadeId) args._entidade_id = opcoes.entidadeId;
    await context.supabase.rpc("agente_registrar_auditoria", args);
  } catch {
    // A auditoria nunca deve derrubar a operação principal.
  }
}

// ------------------------------------------------------------- agentes
export const listarAgentes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AgenteResumo[]> => {
    const { data, error } = await context.supabase
      .from("agentes")
      .select("id, chave, nome, tipo, descricao, ativo, icone, modelo, temperatura, rota_painel, ordem, criado_em, atualizado_em")
      .order("ordem");
    if (error) throw new Error(error.message);

    const { data: vinculos } = await context.supabase
      .from("agente_ferramenta_vinculos")
      .select("agente_id, ferramenta_id, ativo");
    const { data: prompts } = await context.supabase
      .from("agente_versoes")
      .select("agente_id, ativo, tipo")
      .eq("tipo", "prompt")
      .eq("ativo", true);

    const contagem = new Map<string, number>();
    for (const v of vinculos ?? []) {
      if (!v.ativo) continue;
      contagem.set(v.agente_id, (contagem.get(v.agente_id) ?? 0) + 1);
    }
    const comPrompt = new Set((prompts ?? []).map((p) => p.agente_id));

    return (data ?? []).map((a) => ({
      id: a.id,
      chave: a.chave,
      nome: a.nome,
      tipo: a.tipo,
      descricao: a.descricao,
      ativo: a.ativo,
      icone: a.icone,
      modelo: a.modelo,
      temperatura: a.temperatura,
      rota_painel: a.rota_painel,
      ordem: a.ordem,
      total_ferramentas: contagem.get(a.id) ?? 0,
      tem_prompt: comPrompt.has(a.id),
      criado_em: a.criado_em,
      atualizado_em: a.atualizado_em,
    }));
  });

export const obterAgente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: agente, error } = await context.supabase
      .from("agentes")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!agente) return null;

    const { data: versoes } = await context.supabase
      .from("agente_versoes")
      .select("id, tipo, versao, ativo, conteudo, observacao, criado_em")
      .eq("agente_id", data.id)
      .order("tipo")
      .order("versao", { ascending: false });

    const { data: vinculos } = await context.supabase
      .from("agente_ferramenta_vinculos")
      .select("ferramenta_id, ativo, config")
      .eq("agente_id", data.id);
    const idsFerramentas = (vinculos ?? []).map((v) => v.ferramenta_id);
    let ferramentas: FerramentaResumo[] = [];
    if (idsFerramentas.length) {
      const { data: encontradas } = await context.supabase
        .from("agente_ferramentas")
        .select("id, chave, nome, descricao, categoria, tipo, risco, sensivel, efeito_externo, idempotente, ativo, parametros_schema, resultado_schema")
        .in("id", idsFerramentas);
      ferramentas = (encontradas ?? []) as FerramentaResumo[];
    }

    return {
      agente,
      versoes: (versoes ?? []) as VersaoAgente[],
      vinculos: (vinculos ?? []) as VinculoFerramenta[],
      ferramentas,
    };
  });

const entradaAgente = z.object({
  id: z.string().uuid().optional(),
  chave: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9_]+$/, "Use apenas letras minúsculas, números e _."),
  nome: z.string().trim().min(2).max(80),
  tipo: z.enum(["atendimento", "operacional", "operador_computador", "personalizado"]).default("personalizado"),
  descricao: z.string().trim().max(600).default(""),
  icone: z.string().trim().max(40).default("Bot"),
  modelo: z.string().trim().max(120).optional().nullable(),
  temperatura: z.number().min(0).max(2).nullable().optional(),
  rota_painel: z.string().trim().max(120).optional().nullable(),
  ordem: z.number().int().min(0).max(999).default(0),
  ativo: z.boolean().default(false),
});

export const salvarAgente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => entradaAgente.parse(input))
  .handler(async ({ data, context }) => {
    const { data: pode } = await context.supabase.rpc("pode_agentes", { _chave: "agentes.gerenciar" });
    if (!pode) return { ok: false as const, erro: "Sem permissão para gerenciar agentes.", id: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const campos = {
      chave: data.chave,
      nome: data.nome,
      tipo: data.tipo,
      descricao: data.descricao,
      icone: data.icone,
      modelo: data.modelo ?? null,
      temperatura: data.temperatura ?? null,
      rota_painel: data.rota_painel ?? null,
      ordem: data.ordem,
      ativo: data.ativo,
    };

    if (data.id) {
      const { error } = await supabaseAdmin.from("agentes").update(campos).eq("id", data.id);
      if (error) {
        console.error("Falha ao atualizar agente", error.message);
        return { ok: false as const, erro: "Não foi possível salvar o agente.", id: null };
      }
      await auditar(context, "agente.atualizado", campos as unknown as Json, {
        agenteId: data.id,
        entidade: "agentes",
        entidadeId: data.id,
      });
      return { ok: true as const, erro: null, id: data.id };
    }

    const { data: novo, error } = await supabaseAdmin
      .from("agentes")
      .insert({ ...campos, criado_por: context.userId })
      .select("id")
      .maybeSingle();
    if (error || !novo) {
      console.error("Falha ao criar agente", error?.message);
      return { ok: false as const, erro: "Não foi possível criar o agente.", id: null };
    }
    await auditar(context, "agente.criado", { chave: data.chave, nome: data.nome }, {
      agenteId: novo.id,
      entidade: "agentes",
      entidadeId: novo.id,
    });
    return { ok: true as const, erro: null, id: novo.id };
  });

export const definirAgenteAtivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid(), ativo: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: pode } = await context.supabase.rpc("pode_agentes", { _chave: "agentes.gerenciar" });
    if (!pode) return { ok: false as const, erro: "Sem permissão para gerenciar agentes." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("agentes").update({ ativo: data.ativo }).eq("id", data.id);
    if (error) {
      console.error("Falha ao alterar situação do agente", error.message);
      return { ok: false as const, erro: "Não foi possível alterar a situação." };
    }
    await auditar(
      context,
      data.ativo ? "agente.ativado" : "agente.desativado",
      {},
      { agenteId: data.id, entidade: "agentes", entidadeId: data.id },
    );
    return { ok: true as const, erro: null };
  });

export const salvarPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        agenteId: z.string().uuid(),
        texto: z.string().trim().max(20000),
        observacao: z.string().trim().max(300).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: pode } = await context.supabase.rpc("pode_agentes", { _chave: "agentes.gerenciar" });
    if (!pode) return { ok: false as const, erro: "Sem permissão para gerenciar agentes." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ultima } = await supabaseAdmin
      .from("agente_versoes")
      .select("versao")
      .eq("agente_id", data.agenteId)
      .eq("tipo", "prompt")
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();
    const proxima = (ultima?.versao ?? 0) + 1;

    await supabaseAdmin
      .from("agente_versoes")
      .update({ ativo: false })
      .eq("agente_id", data.agenteId)
      .eq("tipo", "prompt");

    const { data: nova, error } = await supabaseAdmin
      .from("agente_versoes")
      .insert({
        agente_id: data.agenteId,
        tipo: "prompt",
        versao: proxima,
        conteudo: { texto: data.texto },
        ativo: true,
        observacao: data.observacao,
        criado_por: context.userId,
      })
      .select("id")
      .maybeSingle();
    if (error || !nova) {
      console.error("Falha ao gravar prompt", error?.message);
      return { ok: false as const, erro: "Não foi possível gravar o prompt." };
    }

    await supabaseAdmin
      .from("agentes")
      .update({ system_prompt_atual_id: nova.id })
      .eq("id", data.agenteId);

    await auditar(
      context,
      "agente.prompt_publicado",
      { versao: proxima },
      { agenteId: data.agenteId, entidade: "agente_versoes", entidadeId: nova.id },
    );
    return { ok: true as const, erro: null, versao: proxima };
  });

// ---------------------------------------------------------- ferramentas
export const listarFerramentas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FerramentaResumo[]> => {
    const { data, error } = await context.supabase
      .from("agente_ferramentas")
      .select("id, chave, nome, descricao, categoria, tipo, risco, sensivel, efeito_externo, idempotente, ativo, parametros_schema, resultado_schema")
      .order("categoria")
      .order("nome");
    if (error) throw new Error(error.message);
    return (data ?? []) as FerramentaResumo[];
  });

const entradaFerramenta = z.object({
  id: z.string().uuid().optional(),
  chave: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9_.]+$/, "Use letras minúsculas, números, ponto e _."),
  nome: z.string().trim().min(2).max(100),
  descricao: z.string().trim().max(500).default(""),
  categoria: z.string().trim().max(40).default("geral"),
  tipo: z.enum(["consulta", "acao"]).default("consulta"),
  risco: z.enum(["baixo", "medio", "alto"]).default("baixo"),
  sensivel: z.boolean().default(false),
  efeito_externo: z.boolean().default(false),
  idempotente: z.boolean().default(true),
  ativo: z.boolean().default(true),
});

export const salvarFerramenta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => entradaFerramenta.parse(input))
  .handler(async ({ data, context }) => {
    const { data: pode } = await context.supabase.rpc("pode_agentes", { _chave: "agentes.gerenciar" });
    if (!pode) return { ok: false as const, erro: "Sem permissão para gerenciar ferramentas.", id: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const campos = {
      chave: data.chave,
      nome: data.nome,
      descricao: data.descricao,
      categoria: data.categoria,
      tipo: data.tipo,
      risco: data.risco,
      sensivel: data.sensivel,
      efeito_externo: data.efeito_externo,
      idempotente: data.idempotente,
      ativo: data.ativo,
    };

    if (data.id) {
      const { error } = await supabaseAdmin.from("agente_ferramentas").update(campos).eq("id", data.id);
      if (error) {
        console.error("Falha ao salvar ferramenta", error.message);
        return { ok: false as const, erro: "Não foi possível salvar a ferramenta.", id: null };
      }
      await auditar(context, "ferramenta.salva", { chave: data.chave }, { entidade: "agente_ferramentas", entidadeId: data.id });
      return { ok: true as const, erro: null, id: data.id };
    }

    const { data: nova, error } = await supabaseAdmin
      .from("agente_ferramentas")
      .insert(campos)
      .select("id")
      .maybeSingle();
    if (error || !nova) {
      console.error("Falha ao criar ferramenta", error?.message);
      return { ok: false as const, erro: "Não foi possível criar a ferramenta.", id: null };
    }
    await auditar(context, "ferramenta.criada", { chave: data.chave }, { entidade: "agente_ferramentas", entidadeId: nova.id });
    return { ok: true as const, erro: null, id: nova.id };
  });

export const vincularFerramenta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        agenteId: z.string().uuid(),
        ferramentaId: z.string().uuid(),
        ativo: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: pode } = await context.supabase.rpc("pode_agentes", { _chave: "agentes.gerenciar" });
    if (!pode) return { ok: false as const, erro: "Sem permissão para gerenciar vínculos." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("agente_ferramenta_vinculos")
      .upsert(
        { agente_id: data.agenteId, ferramenta_id: data.ferramentaId, ativo: data.ativo },
        { onConflict: "agente_id,ferramenta_id" },
      );
    if (error) {
      console.error("Falha ao vincular ferramenta", error.message);
      return { ok: false as const, erro: "Não foi possível vincular a ferramenta." };
    }
    await auditar(
      context,
      data.ativo ? "ferramenta.vinculada" : "ferramenta.desvinculada",
      { ferramenta_id: data.ferramentaId },
      { agenteId: data.agenteId, entidade: "agente_ferramenta_vinculos" },
    );
    return { ok: true as const, erro: null };
  });

export const desvincularFerramenta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ agenteId: z.string().uuid(), ferramentaId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: pode } = await context.supabase.rpc("pode_agentes", { _chave: "agentes.gerenciar" });
    if (!pode) return { ok: false as const, erro: "Sem permissão para gerenciar vínculos." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("agente_ferramenta_vinculos")
      .delete()
      .eq("agente_id", data.agenteId)
      .eq("ferramenta_id", data.ferramentaId);
    if (error) {
      console.error("Falha ao desvincular ferramenta", error.message);
      return { ok: false as const, erro: "Não foi possível desvincular a ferramenta." };
    }
    await auditar(
      context,
      "ferramenta.desvinculada",
      { ferramenta_id: data.ferramentaId },
      { agenteId: data.agenteId, entidade: "agente_ferramenta_vinculos" },
    );
    return { ok: true as const, erro: null };
  });

// ----------------------------------------------------------- execuções
export const listarExecucoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        agenteId: z.string().uuid().optional(),
        status: z.string().trim().max(40).optional(),
        limite: z.number().int().min(1).max(200).default(50),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<ExecucaoResumo[]> => {
    let consulta = context.supabase
      .from("agente_execucoes")
      .select("id, agente_id, origem, status, profundidade, erro, modelo_usado, tokens_entrada, tokens_saida, custo_estimado, criado_em, iniciado_em, concluido_em")
      .order("criado_em", { ascending: false })
      .limit(data.limite);
    if (data.agenteId) consulta = consulta.eq("agente_id", data.agenteId);
    if (data.status) consulta = consulta.eq("status", data.status);

    const { data: execucoes, error } = await consulta;
    if (error) throw new Error(error.message);

    const { data: agentes } = await context.supabase.from("agentes").select("id, nome");
    const nomes = new Map((agentes ?? []).map((a) => [a.id, a.nome]));

    return (execucoes ?? []).map((e) => ({
      ...e,
      agente_nome: nomes.get(e.agente_id) ?? "Agente removido",
    }));
  });

export const obterExecucao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: execucao, error } = await context.supabase
      .from("agente_execucoes")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!execucao) return null;

    const [passos, aprovacoes, mensagens, auditoria] = await Promise.all([
      context.supabase
        .from("agente_execucao_passos")
        .select("id, ordem, tipo, descricao, ferramenta_id, parametros, parametros_hash, resultado, erro, status, tentativas, iniciado_em, concluido_em")
        .eq("execucao_id", data.id)
        .order("ordem"),
      context.supabase
        .from("agente_aprovacoes")
        .select("id, execucao_id, passo_id, status, parametros, parametros_hash, solicitado_em, decidido_em, decidido_por, motivo, expira_em")
        .eq("execucao_id", data.id)
        .order("solicitado_em", { ascending: false }),
      context.supabase
        .from("agente_mensagens")
        .select("id, de_agente_id, para_agente_id, conteudo, profundidade, lida_em, criado_em")
        .eq("execucao_id", data.id)
        .order("criado_em"),
      context.supabase
        .from("agente_auditoria")
        .select("id, acao, entidade, entidade_id, dados, agente_id, execucao_id, usuario_id, criado_em")
        .eq("execucao_id", data.id)
        .order("criado_em", { ascending: false }),
    ]);

    return {
      execucao,
      passos: (passos.data ?? []) as PassoResumo[],
      aprovacoes: (aprovacoes.data ?? []) as Omit<AprovacaoResumo, "agente_nome">[],
      mensagens: mensagens.data ?? [],
      auditoria: (auditoria.data ?? []) as AuditoriaItem[],
    };
  });

// ---------------------------------------------------------- aprovações
export const listarAprovacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        status: z.enum(["pendente", "aprovada", "recusada", "expirada", "todas"]).default("pendente"),
        limite: z.number().int().min(1).max(200).default(100),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<AprovacaoResumo[]> => {
    let consulta = context.supabase
      .from("agente_aprovacoes")
      .select("id, execucao_id, passo_id, status, parametros, parametros_hash, solicitado_em, decidido_em, decidido_por, motivo, expira_em")
      .order("solicitado_em", { ascending: false })
      .limit(data.limite);
    if (data.status !== "todas") consulta = consulta.eq("status", data.status);

    const { data: aprovacoes, error } = await consulta;
    if (error) throw new Error(error.message);

    const idsExecucoes = [...new Set((aprovacoes ?? []).map((a) => a.execucao_id))];
    const { data: execucoes } = idsExecucoes.length
      ? await context.supabase.from("agente_execucoes").select("id, agente_id").in("id", idsExecucoes)
      : { data: [] as { id: string; agente_id: string }[] };
    const { data: agentes } = await context.supabase.from("agentes").select("id, nome");
    const nomes = new Map((agentes ?? []).map((a) => [a.id, a.nome]));
    const agentePorExecucao = new Map((execucoes ?? []).map((e) => [e.id, e.agente_id]));

    return (aprovacoes ?? []).map((a) => ({
      ...a,
      agente_nome: nomes.get(agentePorExecucao.get(a.execucao_id) ?? "") ?? "—",
    }));
  });

export const decidirAprovacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decisao: z.enum(["aprovada", "recusada"]),
        motivo: z.string().trim().max(500).default(""),
        hashConfirmacao: z.string().trim().max(64).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: resultado, error } = await context.supabase.rpc("agente_decidir_aprovacao", {
      _aprovacao_id: data.id,
      _decisao: data.decisao,
      _motivo: data.motivo,
      _hash_confirmacao: data.hashConfirmacao ?? undefined,
    });
    if (error) {
      console.error("Falha ao decidir aprovação", error.message);
      return { ok: false as const, erro: "Não foi possível registrar a decisão.", decisao: null };
    }
    const r = (resultado ?? {}) as { ok?: boolean; erro?: string; decisao?: string };
    if (!r.ok) return { ok: false as const, erro: r.erro ?? "Decisão recusada.", decisao: null };
    return { ok: true as const, erro: null, decisao: r.decisao ?? data.decisao };
  });

// ------------------------------------------------------------ auditoria
export const listarAuditoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ limite: z.number().int().min(1).max(300).default(100) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<AuditoriaItem[]> => {
    const { data: itens, error } = await context.supabase
      .from("agente_auditoria")
      .select("id, acao, entidade, entidade_id, dados, agente_id, execucao_id, usuario_id, criado_em")
      .order("criado_em", { ascending: false })
      .limit(data.limite);
    if (error) throw new Error(error.message);
    return (itens ?? []) as AuditoriaItem[];
  });

// -------------------------------------------------------------- métricas
export const metricasCentral = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MetricasCentral> => {
    const { data: pode } = await context.supabase.rpc("pode_agentes", { _chave: "agentes.visualizar" });
    if (!pode) throw new Error("Sem permissão para visualizar a Central de Agentes.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const desdePing = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const head = { count: "exact" as const, head: true };

    const [
      agentesTotal,
      agentesAtivos,
      execucoes24h,
      aguardandoAprovacao,
      falhas24h,
      aprovacoesPendentes,
      tarefasAguardando,
      dispositivosAtivos,
      workersOnline,
    ] = await Promise.all([
      supabaseAdmin.from("agentes").select("id", head),
      supabaseAdmin.from("agentes").select("id", head).eq("ativo", true),
      supabaseAdmin.from("agente_execucoes").select("id", head).gte("criado_em", desde),
      supabaseAdmin.from("agente_execucoes").select("id", head).eq("status", "aguardando_aprovacao"),
      supabaseAdmin.from("agente_execucoes").select("id", head).gte("criado_em", desde).eq("status", "falha"),
      supabaseAdmin.from("agente_aprovacoes").select("id", head).eq("status", "pendente"),
      supabaseAdmin.from("agente_tarefas").select("id", head).eq("status", "aguardando"),
      supabaseAdmin.from("agente_dispositivos").select("id", head).eq("ativo", true),
      supabaseAdmin
        .from("agente_worker_heartbeats")
        .select("id", head)
        .gte("ultimo_ping", desdePing)
        .neq("status", "parado"),
    ]);

    return {
      agentes_total: agentesTotal.count ?? 0,
      agentes_ativos: agentesAtivos.count ?? 0,
      execucoes_24h: execucoes24h.count ?? 0,
      aguardando_aprovacao: aguardandoAprovacao.count ?? 0,
      falhas_24h: falhas24h.count ?? 0,
      aprovacoes_pendentes: aprovacoesPendentes.count ?? 0,
      tarefas_aguardando: tarefasAguardando.count ?? 0,
      dispositivos_ativos: dispositivosAtivos.count ?? 0,
      workers_online: workersOnline.count ?? 0,
      atualizado_em: new Date().toISOString(),
    };
  });

// --------------------------------------------------------- versões de agente
export const listarVersoesAgente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ agenteId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<VersaoAgenteDetalhe[]> => {
    const { data: pode } = await context.supabase.rpc("pode_agentes", { _chave: "agentes.visualizar" });
    if (!pode) throw new Error("Sem permissão para visualizar versões.");

    const { data: versoes, error } = await context.supabase
      .from("agente_versoes")
      .select("id, tipo, versao, ativo, conteudo, observacao, criado_por, criado_em")
      .eq("agente_id", data.agenteId)
      .order("tipo")
      .order("versao", { ascending: false });
    if (error) throw new Error(error.message);
    return (versoes ?? []) as VersaoAgenteDetalhe[];
  });

export const ativarVersaoAgente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ versaoId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: pode } = await context.supabase.rpc("pode_agentes", { _chave: "agentes.gerenciar" });
    if (!pode) return { ok: false as const, erro: "Sem permissão para gerenciar agentes." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Obter a versão para saber o agente_id e tipo
    const { data: versao, error: errVersao } = await supabaseAdmin
      .from("agente_versoes")
      .select("agente_id, tipo")
      .eq("id", data.versaoId)
      .maybeSingle();
    if (errVersao || !versao) return { ok: false as const, erro: "Versão não encontrada." };

    // Desativar outras versões do mesmo tipo
    await supabaseAdmin
      .from("agente_versoes")
      .update({ ativo: false })
      .eq("agente_id", versao.agente_id)
      .eq("tipo", versao.tipo);

    // Ativar a selecionada
    const { error: errAtivar } = await supabaseAdmin
      .from("agente_versoes")
      .update({ ativo: true })
      .eq("id", data.versaoId);
    if (errAtivar) return { ok: false as const, erro: "Não foi possível ativar a versão." };

    // Atualizar o agente com o prompt/config atual
    const campo = versao.tipo === "prompt" ? "system_prompt_atual_id" : "config_atual_id";
    await supabaseAdmin.from("agentes").update({ [campo]: data.versaoId } as Record<string, string>).eq("id", versao.agente_id);

    await auditar(context, `agente.versao_ativada`, { tipo: versao.tipo }, {
      agenteId: versao.agente_id,
      entidade: "agente_versoes",
      entidadeId: data.versaoId,
    });

    return { ok: true as const, erro: null };
  });

export const excluirVersaoAgente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ versaoId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: pode } = await context.supabase.rpc("pode_agentes", { _chave: "agentes.gerenciar" });
    if (!pode) return { ok: false as const, erro: "Sem permissão para gerenciar agentes." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: versao, error: errVersao } = await supabaseAdmin
      .from("agente_versoes")
      .select("agente_id, tipo, ativo")
      .eq("id", data.versaoId)
      .maybeSingle();
    if (errVersao || !versao) return { ok: false as const, erro: "Versão não encontrada." };
    if (versao.ativo) return { ok: false as const, erro: "Não é possível excluir a versão ativa. Ative outra primeiro." };

    const { error } = await supabaseAdmin.from("agente_versoes").delete().eq("id", data.versaoId);
    if (error) return { ok: false as const, erro: "Não foi possível excluir a versão." };

    await auditar(context, `agente.versao_excluida`, { tipo: versao.tipo }, {
      agenteId: versao.agente_id,
      entidade: "agente_versoes",
      entidadeId: data.versaoId,
    });

    return { ok: true as const, erro: null };
  });

// ------------------------------------------------------- provedores de IA
export const obterStatusProvedoresIA = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProvedorIAStatus[]> => {
    const { data: pode } = await context.supabase.rpc("pode_agentes", { _chave: "agentes.visualizar" });
    if (!pode) throw new Error("Sem permissão para visualizar a Central de Agentes.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolverConfigIA, PROVEDORES_IA, MODELOS_PADRAO } = await import("@/lib/ia-chave.server");

    const cfg = await resolverConfigIA();
    const { data: chaves } = await supabaseAdmin.from("ia_credenciais").select("provedor");
    const temChave = (p: string) => (chaves ?? []).some((c) => c.provedor === p);

    return PROVEDORES_IA.map((p) => {
      const padrao = MODELOS_PADRAO[p];
      const proprio = p === "openai_proprio" || p === "gemini_proprio";
      let status: "configurado" | "sem_chave" | "usando_gateway" = "configurado";
      if (proprio && !temChave(p)) status = "sem_chave";
      if (p === cfg.provedor && proprio && !temChave(p)) status = "usando_gateway";

      return {
        provedor: p,
        modelo_texto: cfg.provedor === p ? cfg.modeloTexto : padrao.texto,
        modelo_audio: cfg.provedor === p ? cfg.modeloAudio : padrao.audio,
        tem_chave_propria: temChave(p),
        status,
      };
    });
  });

export const testarConexaoIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: pode } = await context.supabase.rpc("pode_agentes", { _chave: "agentes.gerenciar" });
    if (!pode) throw new Error("Sem permissão para testar conexão de IA.");

    const { gerarTextoIA, limparCacheIA, resolverConfigIA } = await import("@/lib/ia-chave.server");
    limparCacheIA();
    const cfg = await resolverConfigIA();

    const r = await gerarTextoIA(
      "Responda somente com a palavra OK, sem pontuação.",
      "Teste de conexão da Central de Agentes.",
      {},
    );

    if (r.conteudo)
      return {
        ok: true as const,
        provedor: cfg.provedor,
        modelo: cfg.modeloTexto,
        resposta: r.conteudo.slice(0, 120),
      };

    return {
      ok: false as const,
      provedor: cfg.provedor,
      modelo: cfg.modeloTexto,
      mensagem: `Falha na conexão (status ${r.status}).`,
    };
  });

// --------------------------------------------------- configuração da central
export const obterConfiguracaoCentral = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConfiguracaoCentral> => {
    const { data: pode } = await context.supabase.rpc("pode_agentes", { _chave: "agentes.visualizar" });
    if (!pode) throw new Error("Sem permissão para visualizar configurações.");

    // Por enquanto retorna valores padrão; futuramente virá de uma tabela de config
    return {
      limite_profundidade_agentes: 5,
      timeout_execucao_segundos: 300,
      max_tentativas_padrao: 3,
      lease_tarefa_segundos: 60,
      aprovacao_expira_horas: 24,
      idempotencia_expira_dias: 30,
      auditoria_retencao_dias: 365,
    };
  });

// ------------------------------------------------------- dispositivos (Windows)
export const listarDispositivos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: pode } = await context.supabase.rpc("pode_agentes", { _chave: "agentes.visualizar" });
    if (!pode) throw new Error("Sem permissão para visualizar dispositivos.");

    const { data, error } = await context.supabase
      .from("agente_dispositivos")
      .select("id, agente_id, nome, token_hash, versao, ultimo_ping, ativo, criado_em, atualizado_em")
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const registrarDispositivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ agenteId: z.string().uuid(), nome: z.string().trim().min(2).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: pode } = await context.supabase.rpc("pode_agentes", { _chave: "agentes.dispositivos.gerenciar" });
    if (!pode) return { ok: false as const, erro: "Sem permissão para gerenciar dispositivos.", token: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const crypto = await import("node:crypto");

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const { data: dispositivo, error } = await supabaseAdmin
      .from("agente_dispositivos")
      .insert({
        agente_id: data.agenteId,
        nome: data.nome,
        token_hash: tokenHash,
        ativo: true,
      })
      .select("id")
      .maybeSingle();
    if (error || !dispositivo) return { ok: false as const, erro: "Não foi possível registrar o dispositivo.", token: null };

    await auditar(context, "dispositivo.registrado", { nome: data.nome }, {
      agenteId: data.agenteId,
      entidade: "agente_dispositivos",
      entidadeId: dispositivo.id,
    });

    // Retorna o token APENAS uma vez (no momento do cadastro)
    return { ok: true as const, erro: null, token, dispositivoId: dispositivo.id };
  });

export const revogarDispositivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ dispositivoId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: pode } = await context.supabase.rpc("pode_agentes", { _chave: "agentes.dispositivos.gerenciar" });
    if (!pode) return { ok: false as const, erro: "Sem permissão para gerenciar dispositivos." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("agente_dispositivos")
      .update({ ativo: false })
      .eq("id", data.dispositivoId);
    if (error) return { ok: false as const, erro: "Não foi possível revogar o dispositivo." };

    await auditar(context, "dispositivo.revogado", {}, {
      entidade: "agente_dispositivos",
      entidadeId: data.dispositivoId,
    });

    return { ok: true as const, erro: null };
  });

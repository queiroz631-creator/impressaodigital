/**
 * Server Functions do Agente Operacional.
 *
 * Funções para:
 * - Iniciar/continuar conversa com o agente
 * - Executar ferramentas (após aprovação)
 * - Gerenciar histórico de mensagens
 *
 * Todas usam createServerFn + requireSupabaseAuth + Zod.
 * Verificam permissões via pode_agentes / agente_pode_acao.
 * Escrita via service_role, RLS como segunda barreira.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { FERRAMENTAS_SISTEMA, type ToolDefinition, type ToolContext } from "./tools/sistema";
import { executarFerramenta } from "./tools/sistema";
import { executarAgenteOperacional, type OrquestradorContexto } from "./orchestrator";

type Cliente = SupabaseClient<Database>;

// ============================================================
// Interfaces
// ============================================================

export interface ChatMensagem {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{ id: string; name: string; arguments: any }>;
  tool_call_id?: string;
  name?: string;
  criado_em: string;
}

export interface IniciarChatResultado {
  execucaoId: string;
  resposta: string;
  toolCalls: Array<{ ferramenta: string; parametros: any; resultado: any }>;
  precisaAprovacao: boolean;
  aprovacoesPendentes: Array<{ passoId: string; ferramenta: string; parametros: any }>;
  tokensEntrada: number;
  tokensSaida: number;
  modeloUsado: string;
}

export interface ContinuarChatResultado extends IniciarChatResultado {}

// ============================================================
// Helpers
// ============================================================

async function auditar(
  context: { supabase: Cliente; userId: string },
  acao: string,
  dados: Json,
  opcoes: { agenteId?: string | null; execucaoId?: string | null; entidade?: string; entidadeId?: string } = {}
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
    // Auditoria nunca derruba a operação principal
  }
}

function getFerramentasDoAgente(agenteId: string, todasFerramentas: ToolDefinition<any, any>[]): ToolDefinition<any, any>[] {
  // Por enquanto retorna todas; futuramente filtrar por vínculos ativos
  return todasFerramentas;
}

// ============================================================
// Iniciar nova conversa com o Agente Operacional
// ============================================================

const iniciarChatSchema = z.object({
  agenteId: z.string().optional().default("operacional"), // UUID ou chave do agente (ex.: "operacional")
  mensagem: z.string().trim().min(1).max(10000),
  idempotencyKey: z.string().max(128).optional(),
});

export const iniciarChatOperacional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => iniciarChatSchema.parse(input))
  .handler(async ({ data, context }): Promise<IniciarChatResultado> => {
    // Verificar permissão para executar agentes
    const { data: podeExecutar } = await context.supabase.rpc("pode_agentes", { _chave: "agentes.executar" });
    if (!podeExecutar) throw new Error("Sem permissão para executar agentes.");

    // Buscar agente operacional (por chave ou ID)
    let agenteId = data.agenteId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!agenteId.match(/^[0-9a-f-]{36}$/)) {
      // É uma chave, buscar por ID
      const { data: agente } = await supabaseAdmin.from("agentes").select("id").eq("chave", agenteId).maybeSingle();
      if (!agente) throw new Error("Agente operacional não encontrado.");
      agenteId = agente.id;
    }

    // Verificar se agente está ativo
    const { data: agente } = await supabaseAdmin.from("agentes").select("ativo").eq("id", agenteId).maybeSingle();
    if (!agente?.ativo) throw new Error("Agente operacional está inativo.");

    // Verificar idempotência se chave fornecida
    if (data.idempotencyKey) {
      const { data: existente } = await supabaseAdmin
        .from("agente_idempotencia")
        .select("status, resultado")
        .eq("chave", data.idempotencyKey)
        .maybeSingle();
      if (existente) {
        if (existente.status === "concluido") {
          return existente.resultado as IniciarChatResultado;
        }
        if (existente.status === "iniciado") {
          throw new Error("Execução já em andamento com esta chave.");
        }
      }
    }

    // Criar execução
    const { data: execucao, error: errExecucao } = await supabaseAdmin
      .from("agente_execucoes")
      .insert({
        agente_id: agenteId,
        origem: "usuario",
        usuario_id: context.userId,
        entrada: { mensagem: data.mensagem },
        status: "executando",
        iniciado_em: new Date().toISOString(),
        idempotency_key: data.idempotencyKey ?? null,
      })
      .select("id")
      .maybeSingle();

    if (errExecucao || !execucao) throw new Error("Falha ao criar execução.");

    try {
      // Preparar contexto do orquestrador
      const ferramentas = getFerramentasDoAgente(agenteId, FERRAMENTAS_SISTEMA);
      const ctxOrquestrador: OrquestradorContexto = {
        supabase: context.supabase,
        supabaseAdmin,
        userId: context.userId,
        agenteId,
        execucaoId: execucao.id,
        mensagemUsuario: data.mensagem,
        historico: [],
        ferramentasDisponiveis: ferramentas,
        limiteProfundidade: 5,
        profundidadeAtual: 0,
      };

      // Executar agente
      const resultado = await executarAgenteOperacional(ctxOrquestrador);

      // Atualizar execução
      await supabaseAdmin
        .from("agente_execucoes")
        .update({
          saida: { resposta: resultado.resposta },
          status: resultado.precisaAprovacao ? "aguardando_aprovacao" : "concluida",
          modelo_usado: resultado.modeloUsado,
          tokens_entrada: resultado.tokensEntrada,
          tokens_saida: resultado.tokensSaida,
          concluido_em: resultado.precisaAprovacao ? null : new Date().toISOString(),
        })
        .eq("id", execucao.id);

      // Registrar mensagem do usuário
      await supabaseAdmin.from("agente_mensagens").insert({
        execucao_id: execucao.id,
        de_agente_id: null, // usuário
        para_agente_id: agenteId,
        conteudo: { role: "user", content: data.mensagem },
        profundidade: 0,
      });

      // Registrar resposta do agente
      await supabaseAdmin.from("agente_mensagens").insert({
        execucao_id: execucao.id,
        de_agente_id: agenteId,
        para_agente_id: null,
        conteudo: { role: "assistant", content: resultado.resposta },
        profundidade: 0,
      });

      // Auditoria
      await auditar(context, "chat.iniciado", { execucao_id: execucao.id, agente_id: agenteId }, {
        agenteId,
        execucaoId: execucao.id,
      });

      // Salvar idempotência se concluído
      if (data.idempotencyKey && !resultado.precisaAprovacao) {
        await supabaseAdmin
          .from("agente_idempotencia")
          .upsert({
            chave: data.idempotencyKey,
            escopo: "chat",
            agente_id: agenteId,
            execucao_id: execucao.id,
            status: "concluido",
            resultado: {
              resposta: resultado.resposta,
              toolCalls: resultado.toolCalls,
              precisaAprovacao: resultado.precisaAprovacao,
              aprovacoesPendentes: resultado.aprovacoesPendentes,
              tokensEntrada: resultado.tokensEntrada,
              tokensSaida: resultado.tokensSaida,
              modeloUsado: resultado.modeloUsado,
            },
            resolvido_em: new Date().toISOString(),
          })
          .eq("chave", data.idempotencyKey);
      }

      return {
        execucaoId: execucao.id,
        resposta: resultado.resposta,
        toolCalls: resultado.toolCalls,
        precisaAprovacao: resultado.precisaAprovacao,
        aprovacoesPendentes: resultado.aprovacoesPendentes,
        tokensEntrada: resultado.tokensEntrada,
        tokensSaida: resultado.tokensSaida,
        modeloUsado: resultado.modeloUsado,
      };
    } catch (e) {
      // Atualizar execução como falha
      await supabaseAdmin
        .from("agente_execucoes")
        .update({
          status: "falha",
          erro: e instanceof Error ? e.message : "Erro desconhecido",
          concluido_em: new Date().toISOString(),
        })
        .eq("id", execucao.id);
      throw e;
    }
  });

// ============================================================
// Continuar conversa existente (após aprovação ou nova mensagem)
// ============================================================

const continuarChatSchema = z.object({
  execucaoId: z.string().uuid(),
  mensagem: z.string().trim().min(1).max(10000).optional(), // Nova mensagem do usuário
  aprovacaoId: z.string().uuid().optional(), // ID da aprovação decidida
  decisao: z.enum(["aprovada", "recusada"]).optional(),
  motivo: z.string().trim().max(500).optional(),
});

export const continuarChatOperacional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => continuarChatSchema.parse(input))
  .handler(async ({ data, context }): Promise<ContinuarChatResultado> => {
    const { data: podeExecutar } = await context.supabase.rpc("pode_agentes", { _chave: "agentes.executar" });
    if (!podeExecutar) throw new Error("Sem permissão para executar agentes.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Buscar execução
    const { data: execucao, error } = await supabaseAdmin
      .from("agente_execucoes")
      .select("id, agente_id, usuario_id, status, profundidade, entrada, saida")
      .eq("id", data.execucaoId)
      .maybeSingle();
    if (error || !execucao) throw new Error("Execução não encontrada.");
    if (execucao.usuario_id !== context.userId) throw new Error("Acesso negado a esta execução.");

    // Verificar se está aguardando aprovação
    const aguardandoAprovacao = execucao.status === "aguardando_aprovacao";

    // Se há decisão de aprovação
    if (data.aprovacaoId && data.decisao) {
      const { data: aprovacao, error: errAprov } = await supabaseAdmin
        .from("agente_aprovacoes")
        .select("id, passo_id, parametros, parametros_hash, status")
        .eq("id", data.aprovacaoId)
        .maybeSingle();
      if (errAprov || !aprovacao) throw new Error("Aprovação não encontrada.");
      if (aprovacao.status !== "pendente") throw new Error("Aprovação já foi decidida.");
      if (aprovacao.execucao_id !== execucao.id) throw new Error("Aprovação não pertence a esta execução.");

      // Verificar permissão para aprovar
      const { data: podeAprovar } = await context.supabase.rpc("agente_pode_acao", { _chave: "agentes.aprovar" });
      if (!podeAprovar) throw new Error("Sem permissão para aprovar operações.");

      // Processar decisão via function SQL (valida hash, expiração, etc.)
      const { data: decisaoResult, error: errDecisao } = await context.supabase.rpc("agente_decidir_aprovacao", {
        _aprovacao_id: data.aprovacaoId,
        _decisao: data.decisao,
        _motivo: data.motivo ?? "",
      });
      if (errDecisao) throw new Error(errDecisao.message);
      const decisao = decisaoResult as { ok: boolean; erro?: string; decisao?: string };
      if (!decisao.ok) throw new Error(decisao.erro ?? "Decisão recusada.");

      // Se aprovada, executar a ferramenta pendente
      if (data.decisao === "aprovada") {
        const { data: passo } = await supabaseAdmin
          .from("agente_execucao_passos")
          .select("id, ferramenta_id, parametros")
          .eq("id", aprovacao.passo_id)
          .maybeSingle();

        if (passo?.ferramenta_id) {
          const ferramenta = FERRAMENTAS_SISTEMA.find((f) => f.id === passo.ferramenta_id);
          if (ferramenta) {
            // Executar a ferramenta
            const ctxTool: ToolContext = {
              supabase: context.supabase,
              supabaseAdmin,
              userId: context.userId,
              agenteId: execucao.agente_id,
              execucaoId: execucao.id,
              passoId: passo.id,
            };

            const resultado = await executarFerramenta(ctxTool, FERRAMENTAS_SISTEMA, {
              id: `call_${Date.now()}`,
              name: ferramenta.chave.replace(/\./g, "_"),
              arguments: passo.parametros,
            });

            // Atualizar passo
            await supabaseAdmin
              .from("agente_execucao_passos")
              .update({
                status: resultado.ok ? "concluido" : "falha",
                resultado: resultado.data as any ?? null,
                erro: resultado.erro ?? null,
                concluido_em: new Date().toISOString(),
              })
              .eq("id", passo.id);

            // Registrar mensagem de resultado
            await supabaseAdmin.from("agente_mensagens").insert({
              execucao_id: execucao.id,
              de_agente_id: execucao.agente_id,
              para_agente_id: null,
              conteudo: { role: "tool", name: ferramenta.chave, content: JSON.stringify(resultado) },
              profundidade: execucao.profundidade,
            });
          }
        }
      } else {
        // Recusada - atualizar passo como cancelado
        const { data: passo } = await supabaseAdmin
          .from("agente_execucao_passos")
          .select("id")
          .eq("id", aprovacao.passo_id)
          .maybeSingle();
        if (passo) {
          await supabaseAdmin
            .from("agente_execucao_passos")
            .update({ status: "cancelado", erro: "Recusado pelo aprovador", concluido_em: new Date().toISOString() })
            .eq("id", passo.id);
        }
      }
    }

    // Preparar histórico de mensagens
    const { data: mensagens } = await supabaseAdmin
      .from("agente_mensagens")
      .select("conteudo, criado_em")
      .eq("execucao_id", execucao.id)
      .order("criado_em");

    const historico = (mensagens ?? []).map((m) => m.conteudo as any);

    // Se há nova mensagem do usuário, adicionar ao histórico
    if (data.mensagem) {
      historico.push({ role: "user", content: data.mensagem });

      await supabaseAdmin.from("agente_mensagens").insert({
        execucao_id: execucao.id,
        de_agente_id: null,
        para_agente_id: execucao.agente_id,
        conteudo: { role: "user", content: data.mensagem },
        profundidade: execucao.profundidade,
      });
    }

    // Preparar contexto do orquestrador
    const ferramentas = getFerramentasDoAgente(execucao.agente_id, FERRAMENTAS_SISTEMA);
    const ctxOrquestrador: OrquestradorContexto = {
      supabase: context.supabase,
      supabaseAdmin,
      userId: context.userId,
      agenteId: execucao.agente_id,
      execucaoId: execucao.id,
      mensagemUsuario: data.mensagem ?? "Continuar execução anterior.",
      historico,
      ferramentasDisponiveis: ferramentas,
      limiteProfundidade: 5,
      profundidadeAtual: execucao.profundidade,
    };

    // Atualizar status para executando
    await supabaseAdmin.from("agente_execucoes").update({ status: "executando" }).eq("id", execucao.id);

    // Executar agente
    const resultado = await executarAgenteOperacional(ctxOrquestrador);

    // Atualizar execução
    await supabaseAdmin
      .from("agente_execucoes")
      .update({
        saida: { resposta: resultado.resposta },
        status: resultado.precisaAprovacao ? "aguardando_aprovacao" : "concluida",
        modelo_usado: resultado.modeloUsado,
        tokens_entrada: resultado.tokensEntrada,
        tokens_saida: resultado.tokensSaida,
        concluido_em: resultado.precisaAprovacao ? null : new Date().toISOString(),
      })
      .eq("id", execucao.id);

    // Registrar resposta do agente
    await supabaseAdmin.from("agente_mensagens").insert({
      execucao_id: execucao.id,
      de_agente_id: execucao.agente_id,
      para_agente_id: null,
      conteudo: { role: "assistant", content: resultado.resposta },
      profundidade: execucao.profundidade,
    });

    // Auditoria
    await auditar(context, "chat.continuado", { execucao_id: execucao.id }, {
      agenteId: execucao.agente_id,
      execucaoId: execucao.id,
    });

    return {
      execucaoId: execucao.id,
      resposta: resultado.resposta,
      toolCalls: resultado.toolCalls,
      precisaAprovacao: resultado.precisaAprovacao,
      aprovacoesPendentes: resultado.aprovacoesPendentes,
      tokensEntrada: resultado.tokensEntrada,
      tokensSaida: resultado.tokensSaida,
      modeloUsado: resultado.modeloUsado,
    };
  });

// ============================================================
// Listar mensagens de uma execução (chat history)
// ============================================================

const listarMensagensSchema = z.object({
  execucaoId: z.string().uuid(),
  limite: z.number().int().min(1).max(200).default(50),
});

export const listarMensagensChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => listarMensagensSchema.parse(input))
  .handler(async ({ data, context }): Promise<ChatMensagem[]> => {
    const { data: pode } = await context.supabase.rpc("pode_agentes", { _chave: "agentes.visualizar" });
    if (!pode) throw new Error("Sem permissão para visualizar chat.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verificar acesso à execução
    const { data: execucao } = await supabaseAdmin
      .from("agente_execucoes")
      .select("usuario_id")
      .eq("id", data.execucaoId)
      .maybeSingle();
    if (!execucao) throw new Error("Execução não encontrada.");

    const { data: podeVer } = await context.supabase.rpc("pode_agentes", { _chave: "agentes.visualizar" });
    const ehDono = execucao.usuario_id === context.userId;
    if (!podeVer && !ehDono) throw new Error("Sem acesso a esta conversa.");

    const { data: mensagens, error } = await context.supabase
      .from("agente_mensagens")
      .select("id, conteudo, criado_em")
      .eq("execucao_id", data.execucaoId)
      .order("criado_em", { ascending: true })
      .limit(data.limite);

    if (error) throw new Error(error.message);

    return (mensagens ?? []).map((m) => ({
      id: m.id,
      ...(m.conteudo as any),
      criado_em: m.criado_em,
    })) as ChatMensagem[];
  });

// ============================================================
// Obter ferramentas disponíveis para o agente
// ============================================================

export const obterFerramentasAgente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: pode } = await context.supabase.rpc("pode_agentes", { _chave: "agentes.visualizar" });
    if (!pode) throw new Error("Sem permissão para visualizar ferramentas.");

    return FERRAMENTAS_SISTEMA.map((f) => ({
      chave: f.chave,
      nome: f.nome,
      descricao: f.descricao,
      categoria: f.categoria,
      tipo: f.tipo,
      risco: f.risco,
      sensivel: f.sensivel,
      efeito_externo: f.efeito_externo,
      idempotente: f.idempotente,
      parametros_schema: f.parametrosSchema,
    }));
  });

// Re-exportar tipo ToolDefinition para uso externo
export type { ToolDefinition } from "./sistema";
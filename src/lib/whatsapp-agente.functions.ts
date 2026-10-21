/**
 * Server Functions para configuração do Agente de Atendimento WhatsApp.
 * Gerencia a configuração do Agente de Atendimento por conexão WhatsApp.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Cliente = SupabaseClient<Database>;

// ----------------------------------------------------------- Interfaces

export interface WhatsappAgenteConfig {
  conexao_id: string;
  agente_atendimento_ativo: boolean;
  agente_atendimento_id: string | null;
  agente_atendimento_horario_inicio: string;
  agente_atendimento_horario_fim: string;
  agente_atendimento_dias_semana: number[];
  agente_atendimento_msg_ativacao: string;
  agente_atendimento_msg_fora_horario: string;
  agente_atendimento_msg_transferencia: string;
  agente_atendimento_ferramentas_permitidas: string[];
  agente_atendimento_exigir_validacao: boolean;
  agente_atendimento_max_contexto_mensagens: number;
}

export interface ConexaoWhatsAppResumo {
  id: string;
  nome: string;
  telefone: string;
  ativo: boolean;
  agente_atendimento_ativo: boolean;
  agente_atendimento_id: string | null;
  agente_nome: string | null;
}

export interface FerramentaAgenteResumo {
  chave: string;
  nome: string;
  descricao: string;
  categoria: string;
  tipo: string;
  risco: string;
  sensivel: boolean;
}

// ----------------------------------------------------------- Schemas

const agenteConfigSchema = z.object({
  conexao_id: z.string().uuid(),
  agente_atendimento_ativo: z.boolean().default(false),
  agente_atendimento_id: z.string().uuid().nullable().optional(),
  agente_atendimento_horario_inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("08:00"),
  agente_atendimento_horario_fim: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("18:00"),
  agente_atendimento_dias_semana: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
  agente_atendimento_msg_ativacao: z.string().max(500).default("Olá! Sou o assistente virtual da Impressão Digital. Como posso ajudar?"),
  agente_atendimento_msg_fora_horario: z.string().max(500).default("Nosso horário de atendimento é de segunda a sexta, das 08:00 às 18:00. Deixe sua mensagem que responderemos no próximo dia útil."),
  agente_atendimento_msg_transferencia: z.string().max(500).default("Vou transferir você para um atendente humano. Por favor, aguarde."),
  agente_atendimento_ferramentas_permitidas: z.array(z.string()).default([]),
  agente_atendimento_exigir_validacao: z.boolean().default(true),
  agente_atendimento_max_contexto_mensagens: z.number().int().min(1).max(50).default(20),
});

// ----------------------------------------------------------- Helpers

async function verificarPermissaoAdmin(context: { supabase: Cliente; userId: string }): Promise<boolean> {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  return Boolean(data);
}

// ----------------------------------------------------------- Server Functions

/**
 * Lista todas as conexões WhatsApp com suas configurações de agente.
 */
export const listarConexoesAgente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConexaoWhatsAppResumo[]> => {
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: conexoes, error } = await supabaseAdmin
      .from("whatsapp_conexoes")
      .select("id, nome, telefone, ativo")
      .order("ordem");

    if (error) throw new Error(error.message);

    const { data: configs } = await supabaseAdmin
      .from("whatsapp_config")
      .select(
        "conexao_id, agente_atendimento_ativo, agente_atendimento_id, agente_atendimento_horario_inicio, agente_atendimento_horario_fim, agente_atendimento_dias_semana, agente_atendimento_msg_ativacao, agente_atendimento_msg_fora_horario, agente_atendimento_msg_transferencia, agente_atendimento_ferramentas_permitidas, agente_atendimento_exigir_validacao, agente_atendimento_max_contexto_mensagens"
      );

    const configMap = new Map((configs ?? []).map((c) => [c.conexao_id, c]));

    const { data: agentes } = await supabaseAdmin
      .from("agentes")
      .select("id, nome")
      .eq("tipo", "atendimento");

    const agenteMap = new Map((agentes ?? []).map((a) => [a.id, a.nome]));

    return (conexoes ?? []).map((c) => {
      const config = configMap.get(c.id);
      return {
        id: c.id,
        nome: c.nome,
        telefone: c.telefone ?? "",
        ativo: Boolean(c.ativo),
        agente_atendimento_ativo: config?.agente_atendimento_ativo ?? false,
        agente_atendimento_id: config?.agente_atendimento_id ?? null,
        agente_nome: config?.agente_atendimento_id ? agenteMap.get(config.agente_atendimento_id) ?? null : null,
      };
    });
  });

/**
 * Obtém a configuração completa do agente para uma conexão.
 */
export const obterConfigAgenteConexao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ conexao_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<WhatsappAgenteConfig | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: registro, error } = await supabaseAdmin
      .from("whatsapp_config")
      .select("*")
      .eq("conexao_id", data.conexao_id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!registro) return null;

    return {
      conexao_id: data.conexao_id,
      agente_atendimento_ativo: registro.agente_atendimento_ativo ?? false,
      agente_atendimento_id: registro.agente_atendimento_id ?? null,
      agente_atendimento_horario_inicio: registro.agente_atendimento_horario_inicio ?? "08:00",
      agente_atendimento_horario_fim: registro.agente_atendimento_horario_fim ?? "18:00",
      agente_atendimento_dias_semana: registro.agente_atendimento_dias_semana ?? [1, 2, 3, 4, 5],
      agente_atendimento_msg_ativacao: registro.agente_atendimento_msg_ativacao ?? "Olá! Sou o assistente virtual da Impressão Digital. Como posso ajudar?",
      agente_atendimento_msg_fora_horario: registro.agente_atendimento_msg_fora_horario ?? "Nosso horário de atendimento é de segunda a sexta, das 08:00 às 18:00. Deixe sua mensagem que responderemos no próximo dia útil.",
      agente_atendimento_msg_transferencia: registro.agente_atendimento_msg_transferencia ?? "Vou transferir você para um atendente humano. Por favor, aguarde.",
      agente_atendimento_ferramentas_permitidas: registro.agente_atendimento_ferramentas_permitidas ?? [],
      agente_atendimento_exigir_validacao: registro.agente_atendimento_exigir_validacao ?? true,
      agente_atendimento_max_contexto_mensagens: registro.agente_atendimento_max_contexto_mensagens ?? 20,
    };
  });

/**
 * Salva/atualiza a configuração do agente para uma conexão.
 * Requer permissão de admin.
 */
export const salvarConfigAgenteConexao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => agenteConfigSchema.parse(input))
  .handler(async ({ data, context }) => {
    const isAdmin = await verificarPermissaoAdmin(context);
    if (!isAdmin) return { ok: false as const, erro: "Somente administradores." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const campos: Database["public"]["Tables"]["whatsapp_config"]["Update"] = {
      agente_atendimento_ativo: data.agente_atendimento_ativo,
      agente_atendimento_horario_inicio: data.agente_atendimento_horario_inicio,
      agente_atendimento_horario_fim: data.agente_atendimento_horario_fim,
      agente_atendimento_dias_semana: data.agente_atendimento_dias_semana,
      agente_atendimento_msg_ativacao: data.agente_atendimento_msg_ativacao,
      agente_atendimento_msg_fora_horario: data.agente_atendimento_msg_fora_horario,
      agente_atendimento_msg_transferencia: data.agente_atendimento_msg_transferencia,
      agente_atendimento_ferramentas_permitidas: data.agente_atendimento_ferramentas_permitidas,
      agente_atendimento_exigir_validacao: data.agente_atendimento_exigir_validacao,
      agente_atendimento_max_contexto_mensagens: data.agente_atendimento_max_contexto_mensagens,
    };

    if (data.agente_atendimento_id !== undefined) {
      campos.agente_atendimento_id = data.agente_atendimento_id;
    }

    const { error } = await supabaseAdmin
      .from("whatsapp_config")
      .update(campos)
      .eq("conexao_id", data.conexao_id);

    if (error) {
      console.error("Falha ao salvar config do agente", error.message);
      return { ok: false as const, erro: "Não foi possível salvar a configuração." };
    }

    return { ok: true as const, erro: null };
  });

/**
 * Ativa/desativa o agente de atendimento para uma conexão.
 * Requer permissão de admin.
 */
export const toggleAgenteAtendimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ conexao_id: z.string().uuid(), ativo: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const isAdmin = await verificarPermissaoAdmin(context);
    if (!isAdmin) return { ok: false as const, erro: "Somente administradores." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("whatsapp_config")
      .update({ agente_atendimento_ativo: data.ativo })
      .eq("conexao_id", data.conexao_id);

    if (error) {
      console.error("Falha ao alterar status do agente", error.message);
      return { ok: false as const, erro: "Não foi possível alterar o status." };
    }

    return { ok: true as const, erro: null };
  });

/**
 * Busca agentes do tipo "atendimento" disponíveis.
 */
export const listarAgentesAtendimento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("agentes")
      .select("id, nome, descricao, ativo, modelo, temperatura")
      .eq("tipo", "atendimento")
      .eq("ativo", true)
      .order("nome");

    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ id: string; nome: string; descricao: string; ativo: boolean; modelo: string | null; temperatura: number | null }>;
  });

/**
 * Lista as ferramentas vinculadas (ativas) a um agente de atendimento.
 * Somente leitura — o gerenciamento dos vínculos fica no painel de Ferramentas.
 */
export const listarFerramentasDoAgente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ agente_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<FerramentaAgenteResumo[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: vinculos, error: errVinculos } = await supabaseAdmin
      .from("agente_ferramenta_vinculos")
      .select("ferramenta_id")
      .eq("agente_id", data.agente_id)
      .eq("ativo", true);

    if (errVinculos) throw new Error(errVinculos.message);

    const ids = (vinculos ?? []).map((v) => v.ferramenta_id);
    if (ids.length === 0) return [];

    const { data: ferramentas, error: errFerramentas } = await supabaseAdmin
      .from("agente_ferramentas")
      .select("chave, nome, descricao, categoria, tipo, risco, sensivel")
      .in("id", ids)
      .eq("ativo", true)
      .order("categoria")
      .order("nome");

    if (errFerramentas) throw new Error(errFerramentas.message);
    return (ferramentas ?? []) as FerramentaAgenteResumo[];
  });
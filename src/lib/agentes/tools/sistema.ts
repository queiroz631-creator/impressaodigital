/**
 * Catálogo de ferramentas do Agente Operacional.
 *
 * Cada ferramenta define:
 * - schema de entrada (Zod) para validação
 * - schema de saída (TypeScript) para tipagem
 * - função de execução (server-side only)
 * - metadados: tipo, risco, sensível, efeito_externo, idempotente
 *
 * NUNCA expor credenciais ou permitir SQL arbitrário.
 * Todas as execuções passam por verificação de permissão e aprovação se sensível.
 */

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Cliente = SupabaseClient<Database>;

// ============================================================
// Tipos base
// ============================================================

export interface ToolContext {
  supabase: Cliente;
  supabaseAdmin: Cliente;
  userId: string;
  agenteId: string;
  execucaoId: string;
  passoId: string;
  /**
   * Conversa de WhatsApp em processamento, quando a execução vem do canal
   * WhatsApp (worker). Permite que as ferramentas `whatsapp.*` atuem na
   * conversa correta sem depender de nova busca por telefone.
   */
  conversaId?: string | null;
  /**
   * Execução disparada pelo worker (origem `sistema`/`whatsapp`), sem usuário
   * logado. Nesse caso o gate por usuário (`tem_permissao`) não se aplica: a
   * permissão já foi validada ao enfileirar a tarefa (`agentes.executar`) e o
   * worker roda com `service_role`. Nunca definir `true` em execução iniciada
   * pelo navegador.
   */
  contextoSistema?: boolean;
}

export interface ToolResult<T = unknown> {
  ok: boolean;
  data?: T;
  erro?: string;
  // Metadados para auditoria/custo
  tokensEntrada?: number;
  tokensSaida?: number;
}

export interface ToolDefinition<
  TInput extends z.ZodTypeAny,
  TOutput = unknown
> {
  chave: string;
  nome: string;
  descricao: string;
  categoria: string;
  tipo: "consulta" | "acao";
  risco: "baixo" | "medio" | "alto";
  sensivel: boolean;
  efeito_externo: boolean;
  idempotente: boolean;
  /**
   * Exige aprovação humana antes de executar (padrão: `sensivel` ou tipo
   * `acao`). Ferramentas cuja política já autoriza a execução direta
   * (ex.: `whatsapp.encaminhar_humano`) definem `false` para não bloquear o
   * cliente esperando uma aprovação desnecessária.
   */
  requerAprovacao?: boolean;
  parametrosSchema: TInput;
  // Função que executa a ferramenta (apenas servidor)
  executar: (ctx: ToolContext, params: z.infer<TInput>) => Promise<ToolResult<TOutput>>;
}

// ============================================================
// Schemas de parâmetros (Zod)
// ============================================================

export const ClienteBuscarSchema = z.object({
  termo: z.string().min(1).max(200).describe("Nome, CPF, telefone ou email para buscar"),
  limite: z.number().int().min(1).max(50).default(10).describe("Máximo de resultados"),
});
export type ClienteBuscarInput = z.infer<typeof ClienteBuscarSchema>;

export const ClienteDetalharSchema = z.object({
  clienteId: z.string().uuid().describe("ID do cliente"),
});
export type ClienteDetalharInput = z.infer<typeof ClienteDetalharSchema>;

export const PedidoBuscarSchema = z.object({
  clienteId: z.string().uuid().optional().describe("Filtrar por cliente"),
  status: z.string().max(40).optional().describe("Filtrar por status"),
  limite: z.number().int().min(1).max(50).default(10),
  offset: z.number().int().min(0).default(0),
});
export type PedidoBuscarInput = z.infer<typeof PedidoBuscarSchema>;

export const PedidoDetalharSchema = z.object({
  pedidoId: z.string().uuid().describe("ID do pedido"),
});
export type PedidoDetalharInput = z.infer<typeof PedidoDetalharSchema>;

export const OrcamentoBuscarSchema = z.object({
  clienteId: z.string().uuid().optional().describe("Filtrar por cliente"),
  status: z.string().max(40).optional().describe("Filtrar por status"),
  limite: z.number().int().min(1).max(50).default(10),
  offset: z.number().int().min(0).default(0),
});
export type OrcamentoBuscarInput = z.infer<typeof OrcamentoBuscarSchema>;

export const OrcamentoDetalharSchema = z.object({
  orcamentoId: z.string().uuid().describe("ID do orçamento"),
});
export type OrcamentoDetalharInput = z.infer<typeof OrcamentoDetalharSchema>;

// ============================================================
// Tipos de retorno
// ============================================================

export interface ClienteResumo {
  id: string;
  nome: string;
  telefone: string | null;
  telefone_normalizado: string | null;
  cpf: string | null;
  email: string | null;
  data_nascimento: string | null;
  criado_em: string;
}

export interface ClienteDetalhado extends ClienteResumo {
  pedidos_count: number;
  orcamentos_count: number;
  valor_total_pedidos: number | null;
  ultimo_pedido_em: string | null;
}

export interface PedidoResumo {
  id: string;
  numero: string | null;
  cliente_id: string;
  cliente_nome: string;
  status: string;
  valor_total: number;
  criado_em: string;
  atualizado_em: string;
}

export interface PedidoDetalhado extends PedidoResumo {
  itens: Array<{
    id: string;
    descricao: string;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
  }>;
  historico_status: Array<{
    status: string;
    alterado_em: string;
    alterado_por: string | null;
  }>;
}

export interface OrcamentoResumo {
  id: string;
  numero: string | null;
  cliente_id: string;
  cliente_nome: string;
  status: string;
  valor_total: number;
  criado_em: string;
  atualizado_em: string;
}

export interface OrcamentoDetalhado extends OrcamentoResumo {
  itens: Array<{
    id: string;
    descricao: string;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
  }>;
  validade: string | null;
}

// ============================================================
// Implementações das ferramentas
// ============================================================

// ============================================================
// Ferramentas específicas para WhatsApp (contexto de conversa)
// ============================================================

export const ClienteBuscarWhatsAppSchema = z.object({
  telefone: z.string().min(10).max(20).describe("Telefone do cliente (normalizado ou com formatação)"),
  criarSeNaoExistir: z.boolean().default(false).describe("Criar cliente se não encontrado"),
  nome: z.string().max(150).optional().describe("Nome para criar cliente (se criarSeNaoExistir)"),
});
export type ClienteBuscarWhatsAppInput = z.infer<typeof ClienteBuscarWhatsAppSchema>;

export const EncaminharHumanoWhatsAppSchema = z.object({
  telefone: z.string().min(10).max(20).describe("Telefone do cliente na conversa"),
  motivo: z
    .string()
    .max(300)
    .optional()
    .describe("Motivo do encaminhamento (ex.: pedido do cliente, dúvida complexa)"),
});
export type EncaminharHumanoWhatsAppInput = z.infer<typeof EncaminharHumanoWhatsAppSchema>;

export interface ClienteWhatsAppResumo {
  id: string;
  nome: string;
  telefone: string | null;
  telefone_normalizado: string | null;
  cpf: string | null;
  email: string | null;
  data_nascimento: string | null;
  criado_em: string;
  conversa_id: string | null;
  status_conversa: string | null;
  nao_lidas: number | null;
}

async function getSupabaseAdmin(): Promise<SupabaseClient<Database>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Busca clientes por termo (nome, CPF, telefone, email).
 * Apenas leitura - risco baixo, não sensível.
 */
export async function executarClienteBuscar(
  ctx: ToolContext,
  params: ClienteBuscarInput
): Promise<ToolResult<ClienteResumo[]>> {
  const { supabase, userId } = ctx;
  const { termo, limite } = params;

  // Verificar permissão do usuário para acessar clientes
  const { data: pode } = await supabase.rpc("tem_permissao", {
    _user_id: userId,
    _chave: "clientes.visualizar",
  });
  if (!pode) {
    return { ok: false, erro: "Sem permissão para consultar clientes." };
  }

  const termoBusca = termo.trim();
  const isCpf = /^\d{11}$/.test(termoBusca.replace(/\D/g, ""));
  const isTelefone = /^\d{10,11}$/.test(termoBusca.replace(/\D/g, ""));

  let query = supabase.from("clientes").select("id, nome, telefone, telefone_normalizado, cpf, email, data_nascimento, criado_em:created_at").limit(limite);

  if (isCpf) {
    const cpfLimpo = termoBusca.replace(/\D/g, "");
    query = query.eq("cpf", cpfLimpo);
  } else if (isTelefone) {
    const telLimpo = termoBusca.replace(/\D/g, "");
    query = query.eq("telefone_normalizado", telLimpo);
  } else {
    // Busca por nome ou email (ILIKE)
    query = query.or(`nome.ilike.%${termoBusca}%,email.ilike.%${termoBusca}%`);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return { ok: false, erro: error.message };

  return { ok: true, data: (data ?? []) as unknown as ClienteResumo[] };
}

/**
 * Detalha um cliente específico com agregações.
 * Apenas leitura - risco baixo, não sensível.
 */
export async function executarClienteDetalhar(
  ctx: ToolContext,
  params: ClienteDetalharInput
): Promise<ToolResult<ClienteDetalhado>> {
  const { supabase, userId } = ctx;
  const { clienteId } = params;

  const { data: pode } = await supabase.rpc("tem_permissao", {
    _user_id: userId,
    _chave: "clientes.visualizar",
  });
  if (!pode) {
    return { ok: false, erro: "Sem permissão para consultar clientes." };
  }

  const { data: cliente, error } = await supabase
    .from("clientes")
    .select("id, nome, telefone, telefone_normalizado, cpf, email, data_nascimento, criado_em:created_at")
    .eq("id", clienteId)
    .maybeSingle();
  if (error) return { ok: false, erro: error.message };
  if (!cliente) return { ok: false, erro: "Cliente não encontrado." };

  // Buscar contagens e totais
  const [{ count: pedidosCount }, { count: orcamentosCount }, { data: valorTotal }, { data: ultimoPedido }] = await Promise.all([
    supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId),
    supabase.from("orcamentos").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId),
    supabase.from("pedidos").select("valor_total").eq("cliente_id", clienteId),
    supabase.from("pedidos").select("criado_em:created_at").eq("cliente_id", clienteId).order("created_at", { ascending: false }).limit(1),
  ]);

  const total = (valorTotal ?? []).reduce((s, p) => s + (p.valor_total ?? 0), 0);

  return {
    ok: true,
    data: {
      ...cliente,
      pedidos_count: pedidosCount ?? 0,
      orcamentos_count: orcamentosCount ?? 0,
      valor_total_pedidos: total > 0 ? total : null,
      ultimo_pedido_em: ultimoPedido?.[0]?.criado_em ?? null,
    },
  };
}

/**
 * Busca pedidos com filtros.
 * Apenas leitura - risco baixo, não sensível.
 */
export async function executarPedidoBuscar(
  ctx: ToolContext,
  params: PedidoBuscarInput
): Promise<ToolResult<PedidoResumo[]>> {
  const { supabase, userId } = ctx;
  const { clienteId, status, limite, offset } = params;

  const { data: pode } = await supabase.rpc("tem_permissao", {
    _user_id: userId,
    _chave: "pedidos.visualizar",
  });
  if (!pode) {
    return { ok: false, erro: "Sem permissão para consultar pedidos." };
  }

  let query = supabase
    .from("pedidos")
    .select("id, numero, cliente_id, status, valor_total, criado_em:created_at, atualizado_em:updated_at")
    .range(offset, offset + limite - 1)
    .order("created_at", { ascending: false });

  if (clienteId) query = query.eq("cliente_id", clienteId);
  if (status) query = query.eq("status", status);

  // Join com clientes para nome
  const { data, error } = await query;
  if (error) return { ok: false, erro: error.message };

  // Buscar nomes dos clientes
  const clienteIds = [...new Set((data ?? []).map((p) => p.cliente_id).filter((id): id is string => Boolean(id)))];
  let clientesMap = new Map<string, string>();
  if (clienteIds.length) {
    const { data: clientes } = await supabase
      .from("clientes")
      .select("id, nome")
      .in("id", clienteIds);
    clientesMap = new Map((clientes ?? []).map((c) => [c.id, c.nome]));
  }

  return {
    ok: true,
    data: (data ?? []).map((p) => ({
      ...p,
      cliente_nome: (p.cliente_id && clientesMap.get(p.cliente_id)) ?? "Cliente não encontrado",
    })) as unknown as PedidoResumo[],
  };
}

/**
 * Detalha um pedido específico com itens e histórico.
 * Apenas leitura - risco baixo, não sensível.
 */
export async function executarPedidoDetalhar(
  ctx: ToolContext,
  params: PedidoDetalharInput
): Promise<ToolResult<PedidoDetalhado>> {
  const { supabase, userId } = ctx;
  const { pedidoId } = params;

  const { data: pode } = await supabase.rpc("tem_permissao", {
    _user_id: userId,
    _chave: "pedidos.visualizar",
  });
  if (!pode) {
    return { ok: false, erro: "Sem permissão para consultar pedidos." };
  }

  const { data: pedido, error } = await supabase
    .from("pedidos")
    .select("id, numero, cliente_id, status, valor_total, criado_em:created_at, atualizado_em:updated_at")
    .eq("id", pedidoId)
    .maybeSingle();
  if (error) return { ok: false, erro: error.message };
  if (!pedido) return { ok: false, erro: "Pedido não encontrado." };

  const [{ data: itens }, { data: historico }, { data: cliente }] = await Promise.all([
    supabase
      .from("pedido_itens")
      .select("id, descricao, quantidade, valor_unitario, valor_total")
      .eq("pedido_id", pedidoId)
      .order("criado_em"),
    supabase
      .from("pedido_historico")
      .select("status, alterado_em, alterado_por")
      .eq("pedido_id", pedidoId)
      .order("alterado_em"),
    supabase.from("clientes").select("nome").eq("id", pedido.cliente_id).maybeSingle(),
  ]);

  return {
    ok: true,
    data: {
      ...pedido,
      cliente_nome: cliente?.nome ?? "Cliente não encontrado",
      itens: (itens ?? []) as PedidoDetalhado["itens"],
      historico_status: (historico ?? []) as PedidoDetalhado["historico_status"],
    },
  };
}

/**
 * Busca orçamentos com filtros.
 * Apenas leitura - risco baixo, não sensível.
 */
export async function executarOrcamentoBuscar(
  ctx: ToolContext,
  params: OrcamentoBuscarInput
): Promise<ToolResult<OrcamentoResumo[]>> {
  const { supabase, userId } = ctx;
  const { clienteId, status, limite, offset } = params;

  const { data: pode } = await supabase.rpc("tem_permissao", {
    _user_id: userId,
    _chave: "orcamentos.visualizar",
  });
  if (!pode) {
    return { ok: false, erro: "Sem permissão para consultar orçamentos." };
  }

  let query = supabase
    .from("orcamentos")
    .select("id, numero, cliente_id, status, valor_total, criado_em:created_at, atualizado_em:created_at")
    .range(offset, offset + limite - 1)
    .order("created_at", { ascending: false });

  if (clienteId) query = query.eq("cliente_id", clienteId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return { ok: false, erro: error.message };

  const clienteIds = [...new Set((data ?? []).map((o) => o.cliente_id).filter((id): id is string => Boolean(id)))];
  let clientesMap = new Map<string, string>();
  if (clienteIds.length) {
    const { data: clientes } = await supabase
      .from("clientes")
      .select("id, nome")
      .in("id", clienteIds);
    clientesMap = new Map((clientes ?? []).map((c) => [c.id, c.nome]));
  }

  return {
    ok: true,
    data: (data ?? []).map((o) => ({
      ...o,
      cliente_nome: (o.cliente_id && clientesMap.get(o.cliente_id)) ?? "Cliente não encontrado",
    })) as unknown as OrcamentoResumo[],
  };
}

/**
 * Detalha um orçamento específico com itens.
 * Apenas leitura - risco baixo, não sensível.
 */
export async function executarOrcamentoDetalhar(
  ctx: ToolContext,
  params: OrcamentoDetalharInput
): Promise<ToolResult<OrcamentoDetalhado>> {
  const { supabase, userId } = ctx;
  const { orcamentoId } = params;

  const { data: pode } = await supabase.rpc("tem_permissao", {
    _user_id: userId,
    _chave: "orcamentos.visualizar",
  });
  if (!pode) {
    return { ok: false, erro: "Sem permissão para consultar orçamentos." };
  }

  const { data: orcamento, error } = await supabase
    .from("orcamentos")
    .select("id, numero, cliente_id, status, valor_total, criado_em:created_at, atualizado_em:created_at, validade")
    .eq("id", orcamentoId)
    .maybeSingle();
  if (error) return { ok: false, erro: error.message };
  if (!orcamento) return { ok: false, erro: "Orçamento não encontrado." };

  const [{ data: itens }, { data: cliente }] = await Promise.all([
    supabase
      .from("orcamento_itens")
      .select("id, descricao, quantidade, valor_unitario, valor_total")
      .eq("orcamento_id", orcamentoId)
      .order("criado_em"),
    supabase.from("clientes").select("nome").eq("id", orcamento.cliente_id).maybeSingle(),
  ]);

  return {
    ok: true,
    data: {
      ...orcamento,
      cliente_nome: cliente?.nome ?? "Cliente não encontrado",
      itens: (itens ?? []) as OrcamentoDetalhado["itens"],
    },
  };
}

// ============================================================
// Ferramentas WhatsApp — implementações (contexto de conversa)
// ============================================================

/** Normaliza um telefone para apenas dígitos (formato de `telefone_normalizado`). */
function somenteDigitos(telefone: string): string {
  return telefone.replace(/\D/g, "");
}

/**
 * Verifica permissão de leitura para o usuário da execução.
 *
 * Em execução do worker (`contextoSistema`) a checagem por usuário não se
 * aplica: a permissão já foi validada no enfileiramento da tarefa e o worker
 * roda com `service_role`. Em execução iniciada pelo navegador, valida via
 * `tem_permissao` com o usuário real.
 */
async function podeLer(ctx: ToolContext, chave: string): Promise<boolean> {
  if (ctx.contextoSistema) return true;
  const { data } = await ctx.supabase.rpc("tem_permissao", {
    _user_id: ctx.userId,
    _chave: chave,
  });
  return Boolean(data);
}

/**
 * Localiza o cliente pelo telefone da conversa.
 * Não cria cliente: a criação (quando pedida) fica explícita no chamador.
 */
async function clientePorTelefone(
  ctx: ToolContext,
  telefone: string,
): Promise<ClienteResumo | null> {
  const numero = somenteDigitos(telefone);
  if (!numero) return null;

  const { data } = await ctx.supabaseAdmin
    .from("clientes")
    .select("id, nome, telefone, telefone_normalizado, cpf, email, data_nascimento, criado_em:created_at")
    .eq("telefone_normalizado", numero)
    .maybeSingle();

  return (data as unknown as ClienteResumo | null) ?? null;
}

/**
 * Busca o cliente pelo telefone da conversa WhatsApp.
 *
 * Sem permissão de leitura, retorna erro. Quando `criarSeNaoExistir` e o
 * telefone não tem cliente, cadastra um novo (nome mínimo: informado ou vazio),
 * mantendo o mesmo comportamento do webhook, que já cria o contato ao receber
 * a primeira mensagem.
 */
export async function executarClienteBuscarWhatsApp(
  ctx: ToolContext,
  params: ClienteBuscarWhatsAppInput,
): Promise<ToolResult<ClienteWhatsAppResumo>> {
  if (!(await podeLer(ctx, "clientes.visualizar"))) {
    return { ok: false, erro: "Sem permissão para consultar clientes." };
  }

  const numero = somenteDigitos(params.telefone);
  if (!numero) return { ok: false, erro: "Telefone inválido." };

  let cliente = await clientePorTelefone(ctx, numero);

  if (!cliente && params.criarSeNaoExistir) {
    const { data: novo, error } = await ctx.supabaseAdmin
      .from("clientes")
      .insert({
        nome: (params.nome ?? "").trim(),
        telefone: numero,
        telefone_normalizado: numero,
      })
      .select("id, nome, telefone, telefone_normalizado, cpf, email, data_nascimento, criado_em:created_at")
      .maybeSingle();
    if (error) return { ok: false, erro: error.message };
    cliente = (novo as unknown as ClienteResumo | null) ?? null;
  }

  if (!cliente) {
    return { ok: false, erro: "Cliente não encontrado para este telefone." };
  }

  // Contexto da conversa atual (status + não lidas), quando disponível.
  const { data: conversa } = await ctx.supabaseAdmin
    .from("whatsapp_conversas")
    .select("id, status, nao_lidas")
    .eq("cliente_id", cliente.id)
    .order("ultima_mensagem_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    ok: true,
    data: {
      ...cliente,
      conversa_id: conversa?.id ?? ctx.conversaId ?? null,
      status_conversa: conversa?.status ?? null,
      nao_lidas: conversa?.nao_lidas ?? null,
    },
  };
}

/**
 * Lista pedidos do cliente identificado pelo telefone da conversa.
 * Apenas leitura — nunca revela dados de outro cliente.
 */
export async function executarPedidoBuscarWhatsApp(
  ctx: ToolContext,
  params: { telefone: string; status?: string; limite: number; offset: number },
): Promise<ToolResult<PedidoResumo[]>> {
  if (!(await podeLer(ctx, "pedidos.visualizar"))) {
    return { ok: false, erro: "Sem permissão para consultar pedidos." };
  }

  const cliente = await clientePorTelefone(ctx, params.telefone);
  if (!cliente) return { ok: false, erro: "Cliente não encontrado para este telefone." };

  let query = ctx.supabaseAdmin
    .from("pedidos")
    .select("id, numero, cliente_id, status, valor_total, criado_em:created_at, atualizado_em:updated_at")
    .eq("cliente_id", cliente.id)
    .range(params.offset, params.offset + params.limite - 1)
    .order("created_at", { ascending: false });

  if (params.status) query = query.eq("status", params.status);

  const { data, error } = await query;
  if (error) return { ok: false, erro: error.message };

  return {
    ok: true,
    data: (data ?? []).map((p) => ({ ...p, cliente_nome: cliente.nome })) as unknown as PedidoResumo[],
  };
}

/**
 * Lista orçamentos do cliente identificado pelo telefone da conversa.
 * Apenas leitura — nunca revela dados de outro cliente.
 */
export async function executarOrcamentoBuscarWhatsApp(
  ctx: ToolContext,
  params: { telefone: string; status?: string; limite: number; offset: number },
): Promise<ToolResult<OrcamentoResumo[]>> {
  if (!(await podeLer(ctx, "orcamentos.visualizar"))) {
    return { ok: false, erro: "Sem permissão para consultar orçamentos." };
  }

  const cliente = await clientePorTelefone(ctx, params.telefone);
  if (!cliente) return { ok: false, erro: "Cliente não encontrado para este telefone." };

  let query = ctx.supabaseAdmin
    .from("orcamentos")
    .select("id, numero, cliente_id, status, valor_total, criado_em:created_at, atualizado_em:created_at")
    .eq("cliente_id", cliente.id)
    .range(params.offset, params.offset + params.limite - 1)
    .order("created_at", { ascending: false });

  if (params.status) query = query.eq("status", params.status);

  const { data, error } = await query;
  if (error) return { ok: false, erro: error.message };

  return {
    ok: true,
    data: (data ?? []).map((o) => ({ ...o, cliente_nome: cliente.nome })) as unknown as OrcamentoResumo[],
  };
}

/**
 * Encaminha a conversa para atendimento humano: muda o status para
 * `em_atendimento`, interrompe a automação (limpa `agente_processando`),
 * registra o motivo e audita.
 *
 * Ferramenta de ação, sensível e auditada. A transferência é autorizada pela
 * política (`requerAprovacao: false`), pois apenas roteia o cliente para uma
 * pessoa. A mensagem de transferência é enviada pelo chamador (worker), que
 * conhece o texto configurado por conexão.
 */
export async function executarEncaminharHumanoWhatsApp(
  ctx: ToolContext,
  params: EncaminharHumanoWhatsAppInput,
): Promise<ToolResult<{ conversa_id: string; status: string }>> {
  const numero = somenteDigitos(params.telefone);
  if (!numero) return { ok: false, erro: "Telefone inválido." };

  const cliente = await clientePorTelefone(ctx, numero);

  // Preferência: conversa informada no contexto (worker). Fallback: conversa
  // mais recente do cliente pelo telefone.
  let conversaId = ctx.conversaId ?? null;
  if (!conversaId) {
    const { data } = await ctx.supabaseAdmin
      .from("whatsapp_conversas")
      .select("id")
      .eq("telefone", numero)
      .order("ultima_mensagem_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    conversaId = data?.id ?? null;
  }

  if (!conversaId) return { ok: false, erro: "Conversa não encontrada para este telefone." };

  const motivo = (params.motivo ?? "Solicitado pelo cliente").slice(0, 300);

  const { error } = await ctx.supabaseAdmin
    .from("whatsapp_conversas")
    .update({
      status: "em_atendimento",
      etapa: "em_atendimento",
      motivo_encaminhamento: motivo,
      inicio_atendimento: new Date().toISOString(),
      inatividade_avisada: false,
      inatividade_etapa: 0,
      agente_processando: false,
      agente_processando_em: null,
    })
    .eq("id", conversaId);

  if (error) return { ok: false, erro: error.message };

  await ctx.supabaseAdmin.from("whatsapp_auditoria").insert({
    conversa_id: conversaId,
    usuario_nome: "Agente IA",
    acao: "agente_encaminhar_humano",
    detalhe: `Encaminhado para atendimento humano. Motivo: ${motivo}`,
  });

  await ctx.supabaseAdmin.rpc("agente_registrar_auditoria", {
    _acao: "whatsapp.encaminhar_humano",
    _dados: { conversa_id: conversaId, motivo, cliente_id: cliente?.id ?? null },
    _entidade: "whatsapp_conversas",
    _entidade_id: conversaId,
  });

  return { ok: true, data: { conversa_id: conversaId, status: "em_atendimento" } };
}

// ============================================================
// Registro das ferramentas (catálogo)
// ============================================================
export const FERRAMENTAS_SISTEMA: ToolDefinition<any, any>[] = [
  {
    chave: "sistema.cliente_buscar",
    nome: "Buscar cliente",
    descricao: "Busca clientes por nome, CPF, telefone ou email.",
    categoria: "clientes",
    tipo: "consulta",
    risco: "baixo",
    sensivel: false,
    efeito_externo: false,
    idempotente: true,
    parametrosSchema: ClienteBuscarSchema,
    executar: executarClienteBuscar,
  },
  {
    chave: "sistema.cliente_detalhar",
    nome: "Detalhar cliente",
    descricao: "Retorna detalhes completos de um cliente com histórico de pedidos e orçamentos.",
    categoria: "clientes",
    tipo: "consulta",
    risco: "baixo",
    sensivel: false,
    efeito_externo: false,
    idempotente: true,
    parametrosSchema: ClienteDetalharSchema,
    executar: executarClienteDetalhar,
  },
  {
    chave: "sistema.pedido_buscar",
    nome: "Buscar pedidos",
    descricao: "Lista pedidos com filtros opcionais por cliente e status.",
    categoria: "pedidos",
    tipo: "consulta",
    risco: "baixo",
    sensivel: false,
    efeito_externo: false,
    idempotente: true,
    parametrosSchema: PedidoBuscarSchema,
    executar: executarPedidoBuscar,
  },
  {
    chave: "sistema.pedido_detalhar",
    nome: "Detalhar pedido",
    descricao: "Retorna detalhes completos de um pedido incluindo itens e histórico de status.",
    categoria: "pedidos",
    tipo: "consulta",
    risco: "baixo",
    sensivel: false,
    efeito_externo: false,
    idempotente: true,
    parametrosSchema: PedidoDetalharSchema,
    executar: executarPedidoDetalhar,
  },
  {
    chave: "sistema.orcamento_buscar",
    nome: "Buscar orçamentos",
    descricao: "Lista orçamentos com filtros opcionais por cliente e status.",
    categoria: "orcamentos",
    tipo: "consulta",
    risco: "baixo",
    sensivel: false,
    efeito_externo: false,
    idempotente: true,
    parametrosSchema: OrcamentoBuscarSchema,
    executar: executarOrcamentoBuscar,
  },
  {
    chave: "sistema.orcamento_detalhar",
    nome: "Detalhar orçamento",
    descricao: "Retorna detalhes completos de um orçamento incluindo itens e validade.",
    categoria: "orcamentos",
    tipo: "consulta",
    risco: "baixo",
    sensivel: false,
    efeito_externo: false,
    idempotente: true,
    parametrosSchema: OrcamentoDetalharSchema,
    executar: executarOrcamentoDetalhar,
  },

  // ============================================================
  // Ferramentas WhatsApp (contexto de conversa)
  // ============================================================
  {
    chave: "whatsapp.cliente_buscar",
    nome: "Buscar cliente WhatsApp",
    descricao: "Busca cliente pelo telefone da conversa WhatsApp. Cria se não existir (opcional).",
    categoria: "whatsapp",
    tipo: "consulta",
    risco: "baixo",
    sensivel: false,
    efeito_externo: false,
    idempotente: true,
    parametrosSchema: ClienteBuscarWhatsAppSchema,
    executar: executarClienteBuscarWhatsApp,
  },
  {
    chave: "whatsapp.pedido_buscar",
    nome: "Buscar pedidos WhatsApp",
    descricao: "Lista pedidos do cliente da conversa WhatsApp atual.",
    categoria: "whatsapp",
    tipo: "consulta",
    risco: "baixo",
    sensivel: false,
    efeito_externo: false,
    idempotente: true,
    parametrosSchema: z.object({
      telefone: z.string().min(10).max(20),
      status: z.string().max(40).optional(),
      limite: z.number().int().min(1).max(50).default(10),
      offset: z.number().int().min(0).default(0),
    }),
    executar: executarPedidoBuscarWhatsApp,
  },
  {
    chave: "whatsapp.orcamento_buscar",
    nome: "Buscar orçamentos WhatsApp",
    descricao: "Lista orçamentos do cliente da conversa WhatsApp atual.",
    categoria: "whatsapp",
    tipo: "consulta",
    risco: "baixo",
    sensivel: false,
    efeito_externo: false,
    idempotente: true,
    parametrosSchema: z.object({
      telefone: z.string().min(10).max(20),
      status: z.string().max(40).optional(),
      limite: z.number().int().min(1).max(50).default(10),
      offset: z.number().int().min(0).default(0),
    }),
    executar: executarOrcamentoBuscarWhatsApp,
  },
  {
    chave: "whatsapp.encaminhar_humano",
    nome: "Encaminhar para atendente humano",
    descricao:
      "Altera status da conversa para em_atendimento e registra o motivo. Ação sensível e auditada; a transferência é autorizada pela política (não exige aprovação prévia).",
    categoria: "whatsapp",
    tipo: "acao",
    risco: "alto",
    sensivel: true,
    efeito_externo: true,
    idempotente: false,
    // Política: encaminhar para humano é rotina segura (apenas roteia para uma
    // pessoa). Não bloquear o cliente aguardando aprovação.
    requerAprovacao: false,
    parametrosSchema: EncaminharHumanoWhatsAppSchema,
    executar: executarEncaminharHumanoWhatsApp,
  },
];

// ============================================================
// Utilitários
// ============================================================

export function getFerramentaByChave(chave: string): ToolDefinition<any, any> | undefined {
  return FERRAMENTAS_SISTEMA.find((f) => f.chave === chave);
}

export function getFerramentasByCategoria(categoria: string): ToolDefinition<any, any>[] {
  return FERRAMENTAS_SISTEMA.filter((f) => f.categoria === categoria);
}

export function getTodasFerramentas(): ToolDefinition<any, any>[] {
  return FERRAMENTAS_SISTEMA;
}

/**
 * Executa uma chamada de ferramenta pelo nome.
 */
export async function executarFerramenta(
  ctx: ToolContext,
  ferramentas: ToolDefinition<any, any>[],
  chamada: { name: string; arguments: Record<string, unknown>; id: string }
): Promise<ToolResult> {
  const ferramenta = ferramentas.find((f) => f.chave.replace(/\./g, "_") === chamada.name);
  if (!ferramenta) {
    return { ok: false, erro: `Ferramenta não encontrada: ${chamada.name}` };
  }

  // Validar parâmetros com Zod
  const parseResult = ferramenta.parametrosSchema.safeParse(chamada.arguments);
  if (!parseResult.success) {
    return { ok: false, erro: `Parâmetros inválidos: ${parseResult.error.message}` };
  }

  // Verificar permissão para executar (agente_pode_acao para sensíveis).
  // Em execução do worker a decisão humana já foi registrada em
  // `agente_aprovacoes`; `auth.uid()` é nulo sob service_role, então o gate
  // por usuário não se aplica nesse contexto.
  if (ferramenta.sensivel && !ctx.contextoSistema) {
    const { data: pode } = await ctx.supabase.rpc("agente_pode_acao", {
      _chave: "agentes.executar",
    });
    if (!pode) {
      return { ok: false, erro: "Sem permissão para executar ferramentas sensíveis." };
    }
  }

  try {
    const resultado = await ferramenta.executar(ctx, parseResult.data);
    return resultado;
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Erro desconhecido na ferramenta" };
  }
}
/**
 * Orquestrador do Agente Operacional.
 *
 * Responsável por:
 * - Montar o prompt do sistema com ferramentas disponíveis
 * - Executar o loop de conversa com a IA
 * - Processar chamadas de ferramentas (function calling)
 * - Gerenciar aprovações para ferramentas sensíveis
 * - Controlar limites (profundidade, tokens, tempo)
 * - Registrar execução, passos e auditoria
 *
 * NÃO executa ferramentas com efeito externo diretamente - apenas consulta.
 * Ferramentas sensíveis/ação exigem aprovação humana.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { gerarTextoIA, resolverConfigIA, type ResultadoIA } from "@/lib/ia-chave.server";
import { FERRAMENTAS_SISTEMA, type ToolDefinition, type ToolContext, type ToolResult, executarFerramenta } from "./tools/sistema";

type Cliente = SupabaseClient<Database>;

export interface OrquestradorContexto {
  supabase: Cliente;
  supabaseAdmin: Cliente;
  userId: string;
  agenteId: string;
  execucaoId: string;
  mensagemUsuario: string;
  historico: Array<{ role: "user" | "assistant" | "tool"; content: string; tool_call_id?: string; name?: string }>;
  ferramentasDisponiveis: ToolDefinition<any, any>[];
  limiteProfundidade: number;
  profundidadeAtual: number;
  /** Conversa de WhatsApp em processamento (canal WhatsApp). */
  conversaId?: string | null;
  /** Execução do worker/sistema: dispensa o gate por usuário nas ferramentas. */
  contextoSistema?: boolean;
}

export interface ChamadaFerramenta {
  name: string;
  arguments: Record<string, unknown>;
  id: string;
}

export interface RespostaIA {
  texto: string | null;
  toolCalls: ChamadaFerramenta[];
  tokensEntrada: number;
  tokensSaida: number;
  modeloUsado: string;
}

/**
 * Monta o prompt de sistema para o Agente Operacional.
 */
export function montarPromptSistema(agente: {
  nome: string;
  descricao: string;
  systemPrompt: string | null;
  ferramentas: ToolDefinition<any, any>[];
}): string {
  const ferramentasDesc = agente.ferramentas
    .map((f) => {
      const params = JSON.stringify((f.parametrosSchema as any).shape ?? {}, null, 2);
      return `## ${f.nome} (\`${f.chave}\`)
${f.descricao}
**Categoria:** ${f.categoria} | **Tipo:** ${f.tipo} | **Risco:** ${f.risco} | **Sensível:** ${f.sensivel ? "SIM" : "NÃO"}
**Parâmetros:**
\`\`\`json
${params}
\`\`\``;
    })
    .join("\n\n");

  return `
${agente.systemPrompt ?? `Você é ${agente.nome}, um agente operacional para o sistema de impressão digital.

${agente.descricao}

Suas capacidades:
- Consultar informações do sistema (clientes, pedidos, orçamentos)
- Responder perguntas operacionais com dados reais
- NUNCA executar ações que alterem dados sem aprovação humana explícita
- Sempre citar a fonte dos dados (ferramenta usada)

Diretrizes:
1. Use as ferramentas disponíveis para obter informações precisas
2. Se não tiver certeza, diga que não sabe e sugira consultar
3. Responda em português, de forma clara e profissional
4. Não invente dados - use apenas o que as ferramentas retornam
5. Para ações sensíveis, explique que precisa de aprovação humana
`}

FERRAMENTAS DISPONÍVEIS:
${ferramentasDesc}

FORMATO DE RESPOSTA:
- Para usar uma ferramenta, chame a função correspondente
- Após receber o resultado, continue a conversa normalmente
- Se a ferramenta retornar erro, informe o usuário e sugira alternativa
`.trim();
}

/**
 * Converte ferramentas para o formato OpenAI function calling.
 */
export function ferramentasParaOpenAI(ferramentas: ToolDefinition<any, any>[]) {
  return ferramentas.map((f) => ({
    type: "function" as const,
    function: {
      name: f.chave.replace(/\./g, "_"),
      description: f.descricao,
      parameters: (f.parametrosSchema as any)._def?.shape
        ? zodToJsonSchema(f.parametrosSchema)
        : { type: "object", properties: {} },
    },
  }));
}

/**
 * Converte schema Zod para JSON Schema (simplificado).
 */
function zodToJsonSchema(schema: any): any {
  const shape = schema._def?.shape;
  if (!shape) return { type: "object", properties: {} };

  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const field = value as any;
    const inner = field._def?.innerType?._def ?? field._def;
    let type = "string";
    let description = "";

    if (inner?.typeName === "ZodString") type = "string";
    else if (inner?.typeName === "ZodNumber") type = "number";
    else if (inner?.typeName === "ZodBoolean") type = "boolean";
    else if (inner?.typeName === "ZodArray") type = "array";
    else if (inner?.typeName === "ZodObject") type = "object";

    if (field._def?.description) description = field._def.description;

    properties[key] = { type, description };
    if (!field.isOptional()) required.push(key);
  }

  return { type: "object", properties, required };
}

/**
 * Chama a IA com function calling.
 */
export async function chamarIA(
  systemPrompt: string,
  mensagens: Array<{ role: string; content: string | null; tool_calls?: any[]; tool_call_id?: string; name?: string }>,
  ferramentas: ToolDefinition<any, any>[]
): Promise<RespostaIA> {
  const cfg = await resolverConfigIA();

  // Preparar mensagens para a API
  const mensagensAPI = [
    { role: "system", content: systemPrompt },
    ...mensagens.map((m) => ({
      role: m.role,
      content: m.content,
      tool_calls: m.tool_calls,
      tool_call_id: m.tool_call_id,
      name: m.name,
    })),
  ];

  // Usar gerarTextoIA com function calling simulado via JSON
  // Como gerarTextoIA não suporta tools nativamente, usamos abordagem com prompt estruturado
  const toolsDesc = ferramentas
    .map((f) => `- ${f.chave}: ${f.descricao} (params: ${JSON.stringify((f.parametrosSchema as any).shape ?? {})})`)
    .join("\n");

  const promptComTools = `${systemPrompt}

FERRAMENTAS DISPONÍVEIS (use o formato JSON abaixo para chamá-las):
${toolsDesc}

Para chamar uma ferramenta, responda APENAS com um JSON válido no formato:
{
  "tool_calls": [
    { "id": "call_1", "name": "ferramenta_chave", "arguments": { "param": "valor" } }
  ]
}

Se não precisar de ferramentas, responda normalmente em texto.`;

  const r = await gerarTextoIA(promptComTools, mensagensAPI.slice(-1)[0]?.content ?? "", { json: true });

  if (!r.conteudo) {
    return {
      texto: null,
      toolCalls: [],
      tokensEntrada: 0,
      tokensSaida: 0,
      modeloUsado: cfg.modeloTexto,
    };
  }

  try {
    const parsed = JSON.parse(r.conteudo);
    if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
      return {
        texto: null,
        toolCalls: parsed.tool_calls.map((tc: any) => ({
          id: tc.id ?? `call_${Date.now()}`,
          name: tc.name,
          arguments: tc.arguments ?? {},
        })),
        tokensEntrada: 0, // TODO: extrair do response se disponível
        tokensSaida: 0,
        modeloUsado: cfg.modeloTexto,
      };
    }
    return {
      texto: r.conteudo,
      toolCalls: [],
      tokensEntrada: 0,
      tokensSaida: 0,
      modeloUsado: cfg.modeloTexto,
    };
  } catch {
    // Não é JSON - é resposta textual
    return {
      texto: r.conteudo,
      toolCalls: [],
      tokensEntrada: 0,
      tokensSaida: 0,
      modeloUsado: cfg.modeloTexto,
    };
  }
}

/**
 * Loop principal do agente operacional.
 * Retorna a resposta final e metadados da execução.
 */
export async function executarAgenteOperacional(
  ctx: OrquestradorContexto
): Promise<{
  resposta: string;
  toolCalls: Array<{ ferramenta: string; parametros: any; resultado: ToolResult }>;
  tokensEntrada: number;
  tokensSaida: number;
  modeloUsado: string;
  precisaAprovacao: boolean;
  aprovacoesPendentes: Array<{ passoId: string; ferramenta: string; parametros: any }>;
}> {
  const { supabase, supabaseAdmin, agenteId, execucaoId, mensagemUsuario, historico, ferramentasDisponiveis, limiteProfundidade, profundidadeAtual } = ctx;

  if (profundidadeAtual >= limiteProfundidade) {
    return {
      resposta: "Limite de profundidade de execução atingido. Operação cancelada para evitar ciclos.",
      toolCalls: [],
      tokensEntrada: 0,
      tokensSaida: 0,
      modeloUsado: "",
      precisaAprovacao: false,
      aprovacoesPendentes: [],
    };
  }

  // Obter agente e prompt
  const { data: agente } = await supabaseAdmin.from("agentes").select("*").eq("id", agenteId).maybeSingle();
  if (!agente) throw new Error("Agente não encontrado");

  const { data: versaoPrompt } = await supabaseAdmin
    .from("agente_versoes")
    .select("conteudo")
    .eq("agente_id", agenteId)
    .eq("tipo", "prompt")
    .eq("ativo", true)
    .maybeSingle();

  const systemPrompt = montarPromptSistema({
    nome: agente.nome,
    descricao: agente.descricao,
    systemPrompt: (versaoPrompt?.conteudo as { texto?: string } | null)?.texto ?? null,
    ferramentas: ferramentasDisponiveis,
  });

  // Preparar histórico
  const mensagens = [
    ...historico.map((h) => ({ role: h.role, content: h.content, tool_calls: h.tool_calls, tool_call_id: h.tool_call_id, name: h.name })),
    { role: "user" as const, content: mensagemUsuario },
  ];

  // Mapeia `chave` -> `id` (UUID) do catálogo de ferramentas. Os passos guardam
  // o UUID (`ferramenta_id`), enquanto o catálogo em memória é indexado por
  // `chave`; sem este mapa a retomada de aprovações não encontraria a ferramenta.
  const chavesDisponiveis = ferramentasDisponiveis.map((f) => f.chave);
  const { data: catalogoFerramentas } = chavesDisponiveis.length
    ? await supabaseAdmin.from("agente_ferramentas").select("id, chave").in("chave", chavesDisponiveis)
    : { data: [] as Array<{ id: string; chave: string }> };
  const idFerramentaPorChave = new Map((catalogoFerramentas ?? []).map((f) => [f.chave, f.id]));

  const toolCallsExecutados: Array<{ ferramenta: string; parametros: any; resultado: ToolResult }> = [];
  const aprovacoesPendentes: Array<{ passoId: string; ferramenta: string; parametros: any }> = [];
  let tokensEntradaTotal = 0;
  let tokensSaidaTotal = 0;
  let modeloUsado = "";
  let precisaAprovacao = false;
  let iteracao = 0;
  const maxIteracoes = 5; // Evitar loops infinitos

  while (iteracao < maxIteracoes) {
    iteracao++;

    const resposta = await chamarIA(systemPrompt, mensagens, ferramentasDisponiveis);
    modeloUsado = resposta.modeloUsado;

    if (resposta.texto) {
      // Resposta final da IA
      return {
        resposta: resposta.texto,
        toolCalls: toolCallsExecutados,
        tokensEntrada: tokensEntradaTotal,
        tokensSaida: tokensSaidaTotal,
        modeloUsado,
        precisaAprovacao,
        aprovacoesPendentes,
      };
    }

    if (resposta.toolCalls.length === 0) {
      return {
        resposta: "A IA não retornou resposta nem chamada de ferramenta.",
        toolCalls: toolCallsExecutados,
        tokensEntrada: tokensEntradaTotal,
        tokensSaida: tokensSaidaTotal,
        modeloUsado,
        precisaAprovacao,
        aprovacoesPendentes,
      };
    }

    // Executar cada ferramenta chamada
    for (const tc of resposta.toolCalls) {
      const ferramenta = ferramentasDisponiveis.find((f) => f.chave.replace(/\./g, "_") === tc.name);

      // Criar passo de execução
      const { data: passo, error: errPasso } = await supabaseAdmin
        .from("agente_execucao_passos")
        .insert({
          execucao_id: execucaoId,
          ordem: toolCallsExecutados.length,
          tipo: "ferramenta",
          descricao: `Executar ${tc.name}`,
          ferramenta_id: ferramenta ? idFerramentaPorChave.get(ferramenta.chave) ?? null : null,
          parametros: tc.arguments as any,
          status: "executando",
        })
        .select("id")
        .maybeSingle();

      if (errPasso || !passo) {
        toolCallsExecutados.push({
          ferramenta: tc.name,
          parametros: tc.arguments,
          resultado: { ok: false, erro: "Falha ao criar passo de execução" },
        });
        continue;
      }

      const isSensivel = ferramenta?.sensivel ?? false;
      const isAcao = ferramenta?.tipo === "acao";
      // Padrão: ação/sensível exige aprovação; a ferramenta pode dispensar se a
      // política já autoriza a execução direta (ex.: encaminhar_humano).
      const requerAprovacao = ferramenta?.requerAprovacao ?? (isSensivel || isAcao);

      if (requerAprovacao) {
        // Criar solicitação de aprovação
        const { data: aprovacao } = await supabaseAdmin
          .from("agente_aprovacoes")
          .insert({
            execucao_id: execucaoId,
            passo_id: passo.id,
            parametros: tc.arguments as any,
            parametros_hash: `pending_${Date.now()}`, // Será calculado pela function SQL
            status: "pendente",
            solicitado_por: ctx.userId,
            expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          })
          .select("id")
          .maybeSingle();

        // Atualizar passo para aguardando aprovação
        await supabaseAdmin.from("agente_execucao_passos").update({ status: "aguardando_aprovacao" }).eq("id", passo.id);
        await supabaseAdmin.from("agente_execucoes").update({ status: "aguardando_aprovacao" }).eq("id", execucaoId);

        precisaAprovacao = true;
        aprovacoesPendentes.push({
          passoId: passo.id,
          ferramenta: tc.name,
          parametros: tc.arguments,
        });

        toolCallsExecutados.push({
          ferramenta: tc.name,
          parametros: tc.arguments,
          resultado: { ok: true, data: { aguardando_aprovacao: true, aprovacao_id: aprovacao?.id } },
        });
      } else {
        // Executar diretamente (consulta, não sensível)
        const ctxTool: ToolContext = {
          supabase: ctx.supabase,
          supabaseAdmin: ctx.supabaseAdmin,
          userId: ctx.userId,
          agenteId,
          execucaoId,
          passoId: passo.id,
          conversaId: ctx.conversaId ?? null,
          contextoSistema: ctx.contextoSistema ?? false,
        };

        const resultado = await executarFerramenta(ctxTool, ferramentasDisponiveis, tc);

        await supabaseAdmin
          .from("agente_execucao_passos")
          .update({
            status: resultado.ok ? "concluido" : "falha",
            resultado: resultado.data as any ?? null,
            erro: resultado.erro ?? null,
            concluido_em: new Date().toISOString(),
          })
          .eq("id", passo.id);

        // Adicionar resultado ao histórico para a IA
        mensagens.push({
          role: "tool",
          content: JSON.stringify(resultado),
          tool_call_id: tc.id,
          name: tc.name,
        });

        toolCallsExecutados.push({ ferramenta: tc.name, parametros: tc.arguments, resultado });
      }
    }
  }

  return {
    resposta: "Número máximo de iterações atingido. Tente reformular a pergunta.",
    toolCalls: toolCallsExecutados,
    tokensEntrada: tokensEntradaTotal,
    tokensSaida: tokensSaidaTotal,
    modeloUsado,
    precisaAprovacao,
    aprovacoesPendentes,
  };
}
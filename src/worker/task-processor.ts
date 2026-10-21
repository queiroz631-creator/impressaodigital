/**
 * Processador de Tarefas do Worker
 *
 * Responsável por:
 * - Executar uma tarefa reservada do início ao fim
 * - Integrar com o orquestrador (Etapa 4)
 * - Gerenciar aprovações (pausar/retomar)
 * - Controlar idempotência
 * - Atualizar status na tabela `agente_tarefas`
 * - Registrar execução, passos e auditoria
 *
 * NÃO executa ferramentas com efeito externo real - apenas simulação/consulta.
 * Operações de escrita reais ficam para quando houver aprovação e validação completas.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { executarAgenteOperacional, type OrquestradorContexto } from "@/lib/agentes/orchestrator";
import { FERRAMENTAS_SISTEMA, getFerramentaByChave, type ToolDefinition, type ToolContext } from "@/lib/agentes/tools/sistema";
import { executarFerramenta } from "@/lib/agentes/tools/sistema";
import {
  ferramentasAutorizadasAutomacao,
  montarMensagemAutomacao,
  type ContextoAutorizacaoAutomacao,
} from "@/lib/agentes/utils/automacoes";
import { estaForaDoHorario } from "./horario-atendimento";
import { logger } from "./logger";

type Cliente = SupabaseClient<Database>;

export interface TarefaReservada {
  id: string;
  agente_id: string;
  tipo: string;
  payload: any;
  execucao_id: string | null;
  prioridade: number;
  tentativas: number;
  max_tentativas: number;
}

/**
 * Resolve as ferramentas disponíveis para um agente.
 *
 * - Sem vínculos ativos: retorna o catálogo completo (preserva o comportamento anterior).
 * - Com vínculos: retorna apenas as ferramentas cujo `chave` está vinculada ao agente.
 *
 * Os vínculos referenciam `agente_ferramentas.id` (UUID), então é preciso traduzir
 * para `chave` antes de filtrar o catálogo em memória (indexado por `chave`).
 */
async function resolverFerramentasDoAgente(
  supabaseAdmin: Cliente,
  agenteId: string,
  opcoes: { estrito?: boolean } = {},
): Promise<ToolDefinition<any, any>[]> {
  // Modo estrito (automações): nunca recorre ao catálogo completo; em caso de
  // erro ou ausência de vínculos o agente fica SEM ferramentas.
  const fallback = opcoes.estrito ? [] : FERRAMENTAS_SISTEMA;

  const { data: vinculos, error } = await supabaseAdmin
    .from("agente_ferramenta_vinculos")
    .select("ferramenta_id")
    .eq("agente_id", agenteId)
    .eq("ativo", true);

  if (error) {
    logger.warn("Falha ao buscar vínculos de ferramentas do agente", { agenteId, erro: error.message });
    return fallback;
  }

  const ferramentaIds = (vinculos ?? []).map((v) => v.ferramenta_id);
  if (ferramentaIds.length === 0) return fallback;

  const { data: ferramentas, error: errFerramentas } = await supabaseAdmin
    .from("agente_ferramentas")
    .select("chave")
    .in("id", ferramentaIds)
    .eq("ativo", true);

  if (errFerramentas) {
    logger.warn("Falha ao buscar ferramentas do agente", { agenteId, erro: errFerramentas.message });
    return fallback;
  }

  const chavesPermitidas = new Set((ferramentas ?? []).map((f) => f.chave));
  if (chavesPermitidas.size === 0) return [];

  return FERRAMENTAS_SISTEMA.filter((f) => chavesPermitidas.has(f.chave));
}

/**
 * Processa uma tarefa completa.
 */
export async function processarTarefa(
  supabaseAdmin: Cliente,
  workerId: string,
  tarefa: TarefaReservada
): Promise<void> {
  const { id: tarefaId, agente_id, tipo, payload, execucao_id, tentativas, max_tentativas } = tarefa;

  // Roteamento por tipo de tarefa
  if (tipo === "whatsapp_mensagem_recebida") {
    await processarTarefaWhatsApp(supabaseAdmin, workerId, tarefa);
    return;
  }

  if (tipo === "automacao") {
    await processarTarefaAutomacao(supabaseAdmin, workerId, tarefa);
    return;
  }

  // 1. Marcar tarefa como em execução
  await atualizarStatusTarefa(supabaseAdmin, tarefaId, "em_execucao", null, workerId);

  // 2. Buscar agente e verificar se está ativo
  const { data: agente, error: errAgente } = await supabaseAdmin
    .from("agentes")
    .select("id, chave, nome, ativo, modelo, temperatura, system_prompt_atual_id")
    .eq("id", agente_id)
    .maybeSingle();

  if (errAgente || !agente) {
    await concluirTarefaComoFalha(supabaseAdmin, workerId, tarefaId, "Agente não encontrado");
    return;
  }

  if (!agente.ativo) {
    await concluirTarefaComoFalha(supabaseAdmin, workerId, tarefaId, "Agente inativo");
    return;
  }

  // 3. Obter ou criar execução
  let execucaoId = execucao_id;
  if (!execucaoId) {
    const { data: novaExecucao, error: errExec } = await supabaseAdmin
      .from("agente_execucoes")
      .insert({
        agente_id,
        origem: "automacao",
        entrada: payload,
        status: "executando",
        iniciado_em: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();

    if (errExec || !novaExecucao) {
      await concluirTarefaComoFalha(supabaseAdmin, workerId, tarefaId, "Falha ao criar execução");
      return;
    }
    execucaoId = novaExecucao.id;

    // Atualizar tarefa com execucao_id
    await supabaseAdmin.from("agente_tarefas").update({ execucao_id: execucaoId }).eq("id", tarefaId);
  } else {
    // Atualizar execução existente para executando
    await supabaseAdmin
      .from("agente_execucoes")
      .update({ status: "executando", iniciado_em: new Date().toISOString() })
      .eq("id", execucaoId);
  }

  // 4. Preparar ferramentas disponíveis para este agente
  // Buscar vínculos ativos
  const ferramentasDisponiveis = await resolverFerramentasDoAgente(supabaseAdmin, agente_id);

  if (ferramentasDisponiveis.length === 0) {
    await concluirTarefaComoFalha(supabaseAdmin, workerId, tarefaId, "Agente não possui ferramentas vinculadas");
    return;
  }

  // 5. Obter prompt ativo
  let systemPrompt = "";
  if (agente.system_prompt_atual_id) {
    const { data: versao } = await supabaseAdmin
      .from("agente_versoes")
      .select("conteudo")
      .eq("id", agente.system_prompt_atual_id)
      .maybeSingle();
    const texto = (versao?.conteudo as { texto?: string } | null)?.texto;
    if (texto) systemPrompt = texto;
  }

  // 6. Executar via orquestrador
  const ctxOrquestrador: OrquestradorContexto = {
    supabase: supabaseAdmin, // Usar admin para operações internas
    supabaseAdmin,
    userId: payload.usuarioId ?? "system", // Tarefas automáticas usam system
    agenteId: agente_id,
    execucaoId,
    mensagemUsuario: payload.mensagem ?? `Executar tarefa automática: ${tipo}`,
    historico: payload.historico ?? [],
    ferramentasDisponiveis,
    limiteProfundidade: 5,
    profundidadeAtual: 0,
    // Execução do worker: sem usuário logado; o gate por usuário não se aplica.
    contextoSistema: !payload.usuarioId,
  };

  let resultadoOrquestrador;
  try {
    resultadoOrquestrador = await executarAgenteOperacional(ctxOrquestrador);
  } catch (e) {
    await concluirTarefaComoFalha(supabaseAdmin, workerId, tarefaId, `Erro no orquestrador: ${e}`);
    return;
  }

  // 7. Verificar se precisa de aprovação
  if (resultadoOrquestrador.precisaAprovacao && resultadoOrquestrador.aprovacoesPendentes.length > 0) {
    await handleAprovacoesPendentes(
      supabaseAdmin,
      workerId,
      tarefaId,
      execucaoId,
      resultadoOrquestrador.aprovacoesPendentes
    );
    return; // Tarefa fica aguardando; será retomada via polling ou nova tarefa
  }

  // 8. Sucesso - finalizar execução e tarefa
  await supabaseAdmin
    .from("agente_execucoes")
    .update({
      saida: { resposta: resultadoOrquestrador.resposta },
      status: "concluida",
      modelo_usado: resultadoOrquestrador.modeloUsado,
      tokens_entrada: resultadoOrquestrador.tokensEntrada,
      tokens_saida: resultadoOrquestrador.tokensSaida,
      concluido_em: new Date().toISOString(),
    })
    .eq("id", execucaoId);

  await concluirTarefaComoSucesso(supabaseAdmin, workerId, tarefaId, {
    resposta: resultadoOrquestrador.resposta,
    toolCalls: resultadoOrquestrador.toolCalls,
  });
}

/**
 * Processa uma tarefa de automação (agendada, recorrente, manual ou por evento).
 *
 * Segurança: a automação NÃO amplia as permissões do agente. O contexto de
 * autorização é explícito (`ContextoAutorizacaoAutomacao`): só ferramentas de
 * consulta, não sensíveis, vinculadas ao agente E marcadas na automação.
 * Desfechos terminais sem retry (automação/agente indisponível) usam
 * `cancelada`; falhas reais usam `falha` (backoff e `max_tentativas` no banco).
 */
async function processarTarefaAutomacao(
  supabaseAdmin: Cliente,
  workerId: string,
  tarefa: TarefaReservada,
): Promise<void> {
  const { id: tarefaId, agente_id, payload, execucao_id } = tarefa;
  const automacaoId: string | undefined = payload?.automacao_id;
  const origem = (payload?.origem ?? "recorrente") as ContextoAutorizacaoAutomacao["origem"];

  const cancelar = async (motivo: string) => {
    logger.warn("Tarefa de automação cancelada", { tarefaId, automacaoId, motivo });
    await supabaseAdmin.rpc("agente_concluir_tarefa", {
      _tarefa_id: tarefaId,
      _status: "cancelada",
      _erro: motivo,
    });
  };

  if (!automacaoId) {
    await cancelar("Tarefa de automação sem automacao_id.");
    return;
  }

  await atualizarStatusTarefa(supabaseAdmin, tarefaId, "em_execucao", null, workerId);

  const { data: automacao, error: errAutomacao } = await supabaseAdmin
    .from("agente_automacoes")
    .select("id, nome, agente_id, ativo, acao, ferramentas_permitidas")
    .eq("id", automacaoId)
    .maybeSingle();

  if (errAutomacao) {
    await concluirTarefaComoFalha(supabaseAdmin, workerId, tarefaId, `Falha ao ler a automação: ${errAutomacao.message}`);
    return;
  }
  if (!automacao || automacao.agente_id !== agente_id) {
    await cancelar("Automação não encontrada.");
    return;
  }
  // Automação pausada/desativada enquanto a tarefa aguardava. Execução manual
  // é uma solicitação explícita de usuário autorizado e segue mesmo pausada.
  if (origem !== "manual" && !automacao.ativo) {
    await cancelar("Automação desativada antes da execução.");
    return;
  }

  const { data: agente } = await supabaseAdmin
    .from("agentes")
    .select("id, ativo, system_prompt_atual_id")
    .eq("id", agente_id)
    .maybeSingle();
  if (!agente || !agente.ativo) {
    await cancelar("Agente inativo ou não encontrado.");
    return;
  }

  // Execução (reaproveitada nas novas tentativas)
  let execucaoId = execucao_id;
  if (!execucaoId) {
    const { data: nova, error: errExec } = await supabaseAdmin
      .from("agente_execucoes")
      .insert({
        agente_id,
        origem: "automacao",
        entrada: payload,
        status: "executando",
        iniciado_em: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (errExec || !nova) {
      await concluirTarefaComoFalha(supabaseAdmin, workerId, tarefaId, "Falha ao criar execução");
      return;
    }
    execucaoId = nova.id;
    await supabaseAdmin.from("agente_tarefas").update({ execucao_id: execucaoId }).eq("id", tarefaId);
  } else {
    await supabaseAdmin
      .from("agente_execucoes")
      .update({ status: "executando", iniciado_em: new Date().toISOString() })
      .eq("id", execucaoId);
  }

  const vinculadas = await resolverFerramentasDoAgente(supabaseAdmin, agente_id, { estrito: true });
  const ferramentasDisponiveis = ferramentasAutorizadasAutomacao(vinculadas, automacao.ferramentas_permitidas ?? []);

  const contexto: ContextoAutorizacaoAutomacao = {
    automacaoId,
    agenteId: agente_id,
    origem,
    ferramentasPermitidas: ferramentasDisponiveis.map((f) => f.chave),
    modo: "somente_consulta",
  };

  await supabaseAdmin.rpc("agente_registrar_auditoria", {
    _acao: "automacao.execucao_iniciada",
    _agente_id: agente_id,
    _execucao_id: execucaoId,
    _entidade: "agente_automacoes",
    _entidade_id: automacaoId,
    _dados: contexto as unknown as Json,
  });

  let systemPrompt = "";
  if (agente.system_prompt_atual_id) {
    const { data: versao } = await supabaseAdmin
      .from("agente_versoes")
      .select("conteudo")
      .eq("id", agente.system_prompt_atual_id)
      .maybeSingle();
    const texto = (versao?.conteudo as { texto?: string } | null)?.texto;
    if (texto) systemPrompt = texto;
  }

  const ctxOrquestrador: OrquestradorContexto = {
    supabase: supabaseAdmin,
    supabaseAdmin,
    userId: "system",
    agenteId: agente_id,
    execucaoId,
    mensagemUsuario: montarMensagemAutomacao(automacao.acao, automacao.nome, payload?.evento_payload),
    historico: [],
    ferramentasDisponiveis,
    limiteProfundidade: 5,
    profundidadeAtual: 0,
    // Só há ferramentas de consulta/não sensíveis; o conjunto acima é a única
    // autorização (não há gate por usuário em execução automática).
    contextoSistema: true,
  };

  let resultado;
  try {
    resultado = await executarAgenteOperacional(ctxOrquestrador);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin
      .from("agente_execucoes")
      .update({ status: "falha", erro: msg, concluido_em: new Date().toISOString() })
      .eq("id", execucaoId);
    await concluirTarefaComoFalha(supabaseAdmin, workerId, tarefaId, `Erro no orquestrador: ${msg}`);
    return;
  }

  // Defesa em profundidade: com ferramentas só de consulta não deve haver
  // aprovação; se houver, a automação NÃO prossegue.
  if (resultado.precisaAprovacao) {
    await supabaseAdmin
      .from("agente_execucoes")
      .update({ status: "falha", erro: "Automação tentou operação que exige aprovação.", concluido_em: new Date().toISOString() })
      .eq("id", execucaoId);
    await cancelar("Automação tentou operação que exige aprovação (não permitido em automações).");
    return;
  }

  await supabaseAdmin
    .from("agente_execucoes")
    .update({
      saida: { resposta: resultado.resposta },
      status: "concluida",
      modelo_usado: resultado.modeloUsado,
      tokens_entrada: resultado.tokensEntrada,
      tokens_saida: resultado.tokensSaida,
      concluido_em: new Date().toISOString(),
    })
    .eq("id", execucaoId);

  await concluirTarefaComoSucesso(supabaseAdmin, workerId, tarefaId, {
    resposta: resultado.resposta,
    toolCalls: resultado.toolCalls,
  });
}

/**
 * Processa tarefa específica de mensagem WhatsApp recebida.
 * Esta função é chamada quando o tipo da tarefa é "whatsapp_mensagem_recebida".
 */
export async function processarTarefaWhatsApp(
  supabaseAdmin: Cliente,
  workerId: string,
  tarefa: TarefaReservada
): Promise<void> {
  const { id: tarefaId, agente_id, payload, execucao_id, tentativas, max_tentativas } = tarefa;
  const { conversaId, mensagemId, telefone, conteudo, tipoMensagem, whatsappMessageId } = payload;

  logger.info("Processando mensagem WhatsApp", { tarefaId, conversaId, telefone });

  // 1. Marcar tarefa como em execução
  await atualizarStatusTarefa(supabaseAdmin, tarefaId, "em_execucao", null, workerId);

  // 2. Buscar agente e verificar se está ativo
  const { data: agente, error: errAgente } = await supabaseAdmin
    .from("agentes")
    .select("id, chave, nome, ativo, modelo, temperatura, system_prompt_atual_id")
    .eq("id", agente_id)
    .maybeSingle();

  if (errAgente || !agente) {
    await concluirTarefaComoFalha(supabaseAdmin, workerId, tarefaId, "Agente não encontrado");
    return;
  }

  if (!agente.ativo) {
    await concluirTarefaComoFalha(supabaseAdmin, workerId, tarefaId, "Agente inativo");
    return;
  }

  // 3. Buscar configuração do WhatsApp para esta conexão
  const { data: conversa } = await supabaseAdmin
    .from("whatsapp_conversas")
    .select("id, telefone, conexao_id, status, cliente_id, nome_contato, contexto, agente_processando, agente_processando_em")
    .eq("id", conversaId)
    .maybeSingle();

  if (!conversa) {
    await concluirTarefaComoFalha(supabaseAdmin, workerId, tarefaId, "Conversa não encontrada");
    return;
  }

  // Se a conversa está em atendimento humano, não processar pelo agente IA
  if (conversa.status === "em_atendimento") {
    logger.info("Conversa em atendimento humano, ignorando", { conversaId });
    await concluirTarefaComoSucesso(supabaseAdmin, workerId, tarefaId, {
      resposta: "Conversa em atendimento humano",
      ignorado: true,
    });
    return;
  }

  // Trava por conversa: evita que duas mensagens do mesmo cliente sejam
  // processadas em paralelo (respostas duplicadas / fora de ordem). A trava
  // expira em 2 minutos para não prender a conversa se um worker morrer.
  const TRAVA_MS = 2 * 60 * 1000;
  if (conversa.agente_processando) {
    const desde = conversa.agente_processando_em ? new Date(conversa.agente_processando_em).getTime() : 0;
    if (desde && Date.now() - desde < TRAVA_MS) {
      logger.info("Conversa já está sendo processada pelo agente; reagendando tarefa", { conversaId });
      // Reagenda sem consumir tentativa: a mensagem será processada quando a
      // trava liberar (não é falha, é apenas ordem de chegada).
      await reagendarTarefa(supabaseAdmin, tarefaId, 60);
      return;
    }
  }

  // Assume a trava desta conversa (renova o carimbo para o parâmetro de
  // expiração acima valer a partir de agora).
  await supabaseAdmin
    .from("whatsapp_conversas")
    .update({ agente_processando: true, agente_processando_em: new Date().toISOString() })
    .eq("id", conversaId);

  const conexaoId = conversa.conexao_id ?? "";

  // Buscar configuração do agente para esta conexão
  const { data: cfgAgente } = conexaoId
    ? await supabaseAdmin
        .from("whatsapp_config")
        .select("agente_atendimento_horario_inicio, agente_atendimento_horario_fim, agente_atendimento_dias_semana, agente_atendimento_msg_fora_horario, agente_atendimento_msg_ativacao, agente_atendimento_msg_transferencia, agente_atendimento_max_contexto_mensagens")
        .eq("conexao_id", conexaoId)
        .maybeSingle()
    : { data: null };

  // 4. Verificar horário de atendimento
  if (cfgAgente) {
    const foraHorario = estaForaDoHorario(cfgAgente);

    if (foraHorario && cfgAgente.agente_atendimento_msg_fora_horario) {
      // Enviar mensagem de fora de horário via Z-API
      await enviarMensagemWhatsapp(conversaId, cfgAgente.agente_atendimento_msg_fora_horario, supabaseAdmin, {
        autor: "Sistema",
      });
      await liberarConversa(supabaseAdmin, conversaId);

      await concluirTarefaComoSucesso(supabaseAdmin, workerId, tarefaId, {
        resposta: "Fora de horário - mensagem automática enviada",
        foraHorario: true,
      });
      return;
    }
  }

  // 5. Obter ou criar execução
  let execucaoId = execucao_id;
  if (!execucaoId) {
    const { data: novaExecucao, error: errExec } = await supabaseAdmin
      .from("agente_execucoes")
      .insert({
        agente_id,
        origem: "whatsapp",
        entrada: { conversaId, telefone, mensagem: conteudo, tipoMensagem },
        status: "executando",
        iniciado_em: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();

    if (errExec || !novaExecucao) {
      await liberarConversa(supabaseAdmin, conversaId);
      await concluirTarefaComoFalha(supabaseAdmin, workerId, tarefaId, "Falha ao criar execução");
      return;
    }
    execucaoId = novaExecucao.id;

    await supabaseAdmin.from("agente_tarefas").update({ execucao_id: execucaoId }).eq("id", tarefaId);
  } else {
    await supabaseAdmin
      .from("agente_execucoes")
      .update({ status: "executando", iniciado_em: new Date().toISOString() })
      .eq("id", execucaoId);
  }

  // 6. Buscar histórico de mensagens da conversa (para contexto)
  const maxContexto = cfgAgente?.agente_atendimento_max_contexto_mensagens ?? 20;
  const { data: mensagensHistorico } = await supabaseAdmin
    .from("whatsapp_mensagens")
    .select("direcao, autor, tipo, texto, arquivo_nome, data_hora")
    .eq("conversa_id", conversaId)
    .order("data_hora", { ascending: true })
    .limit(maxContexto);

  const historico = (mensagensHistorico ?? []).map((m) => ({
    role: (m.direcao === "entrada" ? "user" : "assistant") as "user" | "assistant",
    content: m.texto ?? (m.tipo === "imagem" ? "[Imagem]" : m.tipo === "audio" ? "[Áudio]" : m.tipo === "documento" ? `[Documento: ${m.arquivo_nome}]` : `[${m.tipo}]`),
  }));

  // 7. Preparar ferramentas disponíveis
  const ferramentasDisponiveis = await resolverFerramentasDoAgente(supabaseAdmin, agente_id);

  if (ferramentasDisponiveis.length === 0) {
    await liberarConversa(supabaseAdmin, conversaId);
    await concluirTarefaComoFalha(supabaseAdmin, workerId, tarefaId, "Agente não possui ferramentas vinculadas");
    return;
  }

  // 8. Obter prompt ativo
  let systemPrompt = "";
  if (agente.system_prompt_atual_id) {
    const { data: versao } = await supabaseAdmin
      .from("agente_versoes")
      .select("conteudo")
      .eq("id", agente.system_prompt_atual_id)
      .maybeSingle();
    const texto = (versao?.conteudo as { texto?: string } | null)?.texto;
    if (texto) systemPrompt = texto;
  }

  // 9. Preparar contexto do orquestrador
  const ctxOrquestrador: OrquestradorContexto = {
    supabase: supabaseAdmin,
    supabaseAdmin,
    userId: "system",
    agenteId: agente_id,
    execucaoId,
    mensagemUsuario: conteudo,
    historico,
    ferramentasDisponiveis,
    limiteProfundidade: 5,
    profundidadeAtual: 0,
    conversaId,
    contextoSistema: true,
  };

  // 10. Executar via orquestrador
  let resultadoOrquestrador;
  try {
    resultadoOrquestrador = await executarAgenteOperacional(ctxOrquestrador);
  } catch (e) {
    await liberarConversa(supabaseAdmin, conversaId);
    await concluirTarefaComoFalha(supabaseAdmin, workerId, tarefaId, `Erro no orquestrador: ${e}`);
    return;
  }

  // 11. Verificar se precisa de aprovação
  if (resultadoOrquestrador.precisaAprovacao && resultadoOrquestrador.aprovacoesPendentes.length > 0) {
    await liberarConversa(supabaseAdmin, conversaId);
    await handleAprovacoesPendentes(
      supabaseAdmin,
      workerId,
      tarefaId,
      execucaoId,
      resultadoOrquestrador.aprovacoesPendentes
    );
    return;
  }

  // 12. Encaminhamento humano: quando o agente transferiu a conversa, envia a
  // mensagem de transferência configurada (em vez da resposta normal), para
  // não duplicar mensagens nem continuar a automação.
  const transferiuParaHumano = resultadoOrquestrador.toolCalls.some(
    (tc) => tc.ferramenta === "whatsapp_encaminhar_humano" && tc.resultado.ok,
  );

  if (transferiuParaHumano) {
    const msgTransferencia =
      cfgAgente?.agente_atendimento_msg_transferencia?.trim() ||
      "Vou transferir você para um atendente humano. Por favor, aguarde.";
    await enviarMensagemWhatsapp(conversaId, msgTransferencia, supabaseAdmin, { autor: "Sistema" });
  } else if (resultadoOrquestrador.resposta && resultadoOrquestrador.resposta.trim()) {
    // 12b. Enviar resposta via Z-API se houver resposta
    const envio = await enviarMensagemWhatsapp(conversaId, resultadoOrquestrador.resposta, supabaseAdmin);
    if (!envio.ok) {
      // Resultado de envio indeterminado: não repetir automaticamente. A
      // mensagem fica registrada como erro e a tarefa é concluída para não
      // reenviar (reconciliação manual posterior).
      logger.warn("Resposta do agente não confirmada pela Z-API", {
        conversaId,
        erro: envio.erro,
      });
    }
  }

  // 13. Atualizar status da conversa para 'automatico' se estava aguardando
  // (nunca reverter uma conversa transferida para humano).
  if (!transferiuParaHumano && conversa.status === "aguardando") {
    await supabaseAdmin
      .from("whatsapp_conversas")
      .update({ status: "automatico", etapa: "automatico" })
      .eq("id", conversaId);
  }

  // 14. Limpar flag de processamento do agente
  await liberarConversa(supabaseAdmin, conversaId);

  // 15. Sucesso - finalizar execução e tarefa
  await supabaseAdmin
    .from("agente_execucoes")
    .update({
      saida: { resposta: resultadoOrquestrador.resposta },
      status: "concluida",
      modelo_usado: resultadoOrquestrador.modeloUsado,
      tokens_entrada: resultadoOrquestrador.tokensEntrada,
      tokens_saida: resultadoOrquestrador.tokensSaida,
      concluido_em: new Date().toISOString(),
    })
    .eq("id", execucaoId);

  await concluirTarefaComoSucesso(supabaseAdmin, workerId, tarefaId, {
    resposta: resultadoOrquestrador.resposta,
    toolCalls: resultadoOrquestrador.toolCalls,
  });
}

/**
 * Envia mensagem via Z-API para o WhatsApp.
 *
 * Usa o helper compartilhado (`enviarTextoDaConversa`), que resolve as
 * credenciais da conexão e registra a saída no histórico. A auditoria do
 * agente é registrada aqui, pois é específica do canal WhatsApp do agente.
 */
async function enviarMensagemWhatsapp(
  conversaId: string,
  texto: string,
  supabaseAdmin: Cliente,
  opcoes: { autor?: string } = {},
): Promise<{ ok: boolean; erro: string | null }> {
  try {
    const { enviarTextoDaConversa } = await import("@/lib/whatsapp-envio.server");
    const r = await enviarTextoDaConversa({
      conversaId,
      texto,
      autor: opcoes.autor ?? "Agente IA",
    });

    await supabaseAdmin.rpc("agente_registrar_auditoria", {
      _acao: r.ok ? "whatsapp.resposta_enviada" : "whatsapp.falha_envio",
      _dados: { conversa_id: conversaId, tamanho_resposta: texto.length, erro: r.erro },
      _entidade: "whatsapp_conversas",
      _entidade_id: conversaId,
    });

    return { ok: r.ok, erro: r.erro };
  } catch (e) {
    logger.error("Erro ao enviar mensagem WhatsApp", { conversaId, erro: String(e) });
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Lida com aprovações pendentes - pausa a tarefa e aguarda decisão humana.
 *
 * A retomada não é feita por polling: quem decide a aprovação enfileira uma
 * tarefa do tipo `retomar_execucao` (ver `agente_decidir_aprovacao`).
 */
async function handleAprovacoesPendentes(
  supabaseAdmin: Cliente,
  workerId: string,
  tarefaId: string,
  execucaoId: string,
  aprovacoes: Array<{ passoId: string; ferramenta: string; parametros: any }>
): Promise<void> {
  // Atualizar status da tarefa e execução
  await supabaseAdmin
    .from("agente_tarefas")
    .update({ status: "aguardando_aprovacao" })
    .eq("id", tarefaId);

  await supabaseAdmin
    .from("agente_execucoes")
    .update({ status: "aguardando_aprovacao" })
    .eq("id", execucaoId);

  await concluirTarefaComoSucesso(supabaseAdmin, workerId, tarefaId, {
    aguardando_aprovacao: true,
    aprovacoes: aprovacoes.map((a) => ({ passoId: a.passoId, ferramenta: a.ferramenta })),
  });
}

/**
 * Retoma execução após aprovação (chamado por nova tarefa de retomada).
 */
export async function retomarExecucaoAposAprovacao(
  supabaseAdmin: Cliente,
  workerId: string,
  tarefa: TarefaReservada
): Promise<void> {
  const { id: tarefaId, execucao_id, payload } = tarefa;
  const execucaoId = execucao_id ?? payload.execucaoId;
  const aprovacaoId = payload.aprovacaoId;
  const decisao = payload.decisao;

  if (!execucaoId || !aprovacaoId || !decisao) {
    await concluirTarefaComoFalha(supabaseAdmin, workerId, tarefaId, "Dados insuficientes para retomada");
    return;
  }

  // Verificar decisão da aprovação
  const { data: aprovacao } = await supabaseAdmin
    .from("agente_aprovacoes")
    .select("id, status, parametros, parametros_hash, passo_id")
    .eq("id", aprovacaoId)
    .maybeSingle();

  if (!aprovacao || aprovacao.status !== "aprovada") {
    await concluirTarefaComoFalha(supabaseAdmin, workerId, tarefaId, `Aprovação não concedida: ${aprovacao?.status ?? "não encontrada"}`);
    return;
  }

  // Verificar hash dos parâmetros (segurança)
  const { data: hashValido } = await supabaseAdmin.rpc("agente_hash_parametros", {
    _parametros: aprovacao.parametros,
  });
  if (hashValido !== aprovacao.parametros_hash) {
    await concluirTarefaComoFalha(supabaseAdmin, workerId, tarefaId, "Hash dos parâmetros alterado - aprovação inválida");
    return;
  }

  // Executar a ferramenta aprovada
  const passoIdAprovado = aprovacao.passo_id;
  if (!passoIdAprovado) {
    await concluirTarefaComoFalha(supabaseAdmin, workerId, tarefaId, "Aprovação sem passo associado");
    return;
  }

  const { data: passo } = await supabaseAdmin
    .from("agente_execucao_passos")
    .select("id, ferramenta_id, parametros")
    .eq("id", passoIdAprovado)
    .maybeSingle();

  if (!passo?.ferramenta_id) {
    await concluirTarefaComoFalha(supabaseAdmin, workerId, tarefaId, "Passo sem ferramenta associada");
    return;
  }

  // Traduzir o UUID da ferramenta para a chave do catálogo (o passo guarda o
  // `ferramenta_id`; o catálogo em memória é indexado por `chave`).
  const { data: registroFerramenta } = await supabaseAdmin
    .from("agente_ferramentas")
    .select("chave")
    .eq("id", passo.ferramenta_id)
    .maybeSingle();

  const ferramenta = registroFerramenta?.chave
    ? getFerramentaByChave(registroFerramenta.chave)
    : undefined;

  if (!ferramenta) {
    await concluirTarefaComoFalha(supabaseAdmin, workerId, tarefaId, "Ferramenta não encontrada");
    return;
  }

  // Reconstruir o contexto do orquestrador (não existe no escopo desta tarefa
  // de retomada): agente, catálogo de ferramentas e conversa de origem.
  const { data: execucao } = await supabaseAdmin
    .from("agente_execucoes")
    .select("id, agente_id, entrada")
    .eq("id", execucaoId)
    .maybeSingle();

  const agenteId = tarefa.agente_id ?? execucao?.agente_id;
  if (!agenteId) {
    await concluirTarefaComoFalha(supabaseAdmin, workerId, tarefaId, "Agente da execução não encontrado");
    return;
  }

  const ferramentasDisponiveis = await resolverFerramentasDoAgente(supabaseAdmin, agenteId);
  const entrada = (execucao?.entrada ?? {}) as { conversaId?: string };

  const ctxOrquestrador: OrquestradorContexto = {
    supabase: supabaseAdmin,
    supabaseAdmin,
    userId: "system",
    agenteId,
    execucaoId,
    mensagemUsuario: "Continuar execução após aprovação.",
    historico: [],
    ferramentasDisponiveis,
    limiteProfundidade: 5,
    profundidadeAtual: 0,
    conversaId: entrada.conversaId ?? null,
    contextoSistema: true,
  };

  // Idempotência
  const chaveIdempotencia = `execucao:${execucaoId}:passo:${passo.id}`;
  const { data: idempotencia } = await supabaseAdmin
    .from("agente_idempotencia")
    .select("status, resultado")
    .eq("chave", chaveIdempotencia)
    .maybeSingle();

  if (idempotencia?.status === "concluido") {
    logger.info("Passo já executado (idempotência)", { execucaoId, passoId: passo.id });
    await retomarOrquestrador(supabaseAdmin, workerId, tarefaId, execucaoId, ctxOrquestrador);
    return;
  }

  if (idempotencia?.status === "iniciado") {
    await concluirTarefaComoFalha(supabaseAdmin, workerId, tarefaId, "Passo já em execução");
    return;
  }

  // Registrar início de idempotência
  await supabaseAdmin.from("agente_idempotencia").insert({
    chave: chaveIdempotencia,
    escopo: "ferramenta",
    agente_id: agenteId,
    execucao_id: execucaoId,
    passo_id: passo.id,
    ferramenta_id: passo.ferramenta_id,
    status: "iniciado",
  });

  // Executar ferramenta
  const ctxTool: ToolContext = {
    supabase: supabaseAdmin,
    supabaseAdmin,
    userId: "system",
    agenteId,
    execucaoId,
    passoId: passo.id,
    conversaId: ctxOrquestrador.conversaId ?? null,
    contextoSistema: true,
  };

  const resultado = await executarFerramenta(ctxTool, [ferramenta], {
    id: `call_${Date.now()}`,
    name: ferramenta.chave.replace(/\./g, "_"),
    arguments: passo.parametros as Record<string, unknown>,
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

  // Atualizar idempotência
  await supabaseAdmin
    .from("agente_idempotencia")
    .update({
      status: resultado.ok ? "concluido" : "falha",
      resultado: resultado.data as any ?? null,
      resolvido_em: new Date().toISOString(),
    })
    .eq("chave", chaveIdempotencia);

  if (!resultado.ok) {
    await concluirTarefaComoFalha(supabaseAdmin, workerId, tarefaId, `Falha na ferramenta: ${resultado.erro}`);
    return;
  }

  // Retomar orquestrador para continuar
  await retomarOrquestrador(supabaseAdmin, workerId, tarefaId, execucaoId, ctxOrquestrador);
}

/**
 * Retoma o orquestrador após aprovação/ferramenta executada.
 */
async function retomarOrquestrador(
  supabaseAdmin: Cliente,
  workerId: string,
  tarefaId: string,
  execucaoId: string,
  ctxOrquestrador: OrquestradorContexto
): Promise<void> {
  // Buscar histórico atualizado
  const { data: mensagens } = await supabaseAdmin
    .from("agente_mensagens")
    .select("conteudo")
    .eq("execucao_id", execucaoId)
    .order("criado_em");

  const historico = (mensagens ?? []).map((m) => m.conteudo as any);

  const ctxAtualizado: OrquestradorContexto = {
    ...ctxOrquestrador,
    historico,
    mensagemUsuario: "Continuar execução após aprovação.",
  };

  const resultado = await executarAgenteOperacional(ctxAtualizado);

  if (resultado.precisaAprovacao && resultado.aprovacoesPendentes.length > 0) {
    // Nova aprovação necessária - ciclo continua
    await handleAprovacoesPendentes(supabaseAdmin, workerId, tarefaId, execucaoId, resultado.aprovacoesPendentes);
    return;
  }

  // Finalizar
  await supabaseAdmin
    .from("agente_execucoes")
    .update({
      saida: { resposta: resultado.resposta },
      status: "concluida",
      modelo_usado: resultado.modeloUsado,
      tokens_entrada: resultado.tokensEntrada,
      tokens_saida: resultado.tokensSaida,
      concluido_em: new Date().toISOString(),
    })
    .eq("id", execucaoId);

  await concluirTarefaComoSucesso(supabaseAdmin, workerId, tarefaId, {
    resposta: resultado.resposta,
    toolCalls: resultado.toolCalls,
  });
}

// ============================================================
// Helpers de status
// ============================================================

/**
 * Devolve uma tarefa à fila com atraso, SEM consumir tentativa.
 *
 * Usado quando a tarefa não pode rodar agora mas não falhou (ex.: conversa
 * travada por outra mensagem em processamento). Diferente de
 * `agente_concluir_tarefa('falha')`, não gera backoff de erro nem conta para
 * `max_tentativas`.
 */
async function reagendarTarefa(
  supabaseAdmin: Cliente,
  tarefaId: string,
  atrasoSegundos: number,
): Promise<void> {
  await supabaseAdmin
    .from("agente_tarefas")
    .update({
      status: "aguardando",
      reservado_por: null,
      lease_ate: null,
      agendado_para: new Date(Date.now() + atrasoSegundos * 1000).toISOString(),
    })
    .eq("id", tarefaId);
}

/**
 * Libera a trava de processamento da conversa (`agente_processando`).
 * Chamado em todo desfecho (sucesso ou falha) para não prender a conversa.
 */
async function liberarConversa(supabaseAdmin: Cliente, conversaId: string): Promise<void> {
  await supabaseAdmin
    .from("whatsapp_conversas")
    .update({ agente_processando: false, agente_processando_em: null })
    .eq("id", conversaId);
}

async function atualizarStatusTarefa(
  supabaseAdmin: Cliente,
  tarefaId: string,
  status: "aguardando" | "em_execucao" | "concluida" | "falha" | "cancelada" | "aguardando_aprovacao" | "aguardando_reconciliacao",
  erro: string | null,
  workerId: string
) {
  await supabaseAdmin
    .from("agente_tarefas")
    .update({
      status,
      reservado_por: workerId,
      lease_ate: status === "em_execucao" ? new Date(Date.now() + 60 * 1000).toISOString() : null,
      ultimo_erro: erro,
    })
    .eq("id", tarefaId);
}

async function concluirTarefaComoSucesso(
  supabaseAdmin: Cliente,
  workerId: string,
  tarefaId: string,
  resultado: any
) {
  await supabaseAdmin.rpc("agente_concluir_tarefa", {
    _tarefa_id: tarefaId,
    _status: "concluida",
  });
  // O RPC já atualiza a tarefa e libera o lease
}

async function concluirTarefaComoFalha(
  supabaseAdmin: Cliente,
  workerId: string,
  tarefaId: string,
  erro: string
) {
  await supabaseAdmin.rpc("agente_concluir_tarefa", {
    _tarefa_id: tarefaId,
    _status: "falha",
    _erro: erro,
  });
  // O RPC já trata backoff e reagendamento se tentativas < max_tentativas
}
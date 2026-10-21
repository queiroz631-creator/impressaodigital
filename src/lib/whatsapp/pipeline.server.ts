/**
 * Pipeline comum de eventos do WhatsApp (independente do provedor). Somente servidor.
 *
 * Recebe um EVENTO JÁ NORMALIZADO (ver providers/tipos.ts) e aplica as regras
 * de atendimento: cliente, conversa, histórico, cortesia, reabertura, número
 * liberado, Agente de IA por conexão e fila do bot.
 *
 * A lógica foi movida do webhook original (formato Z-API) SEM alteração de
 * regra: o que mudou é apenas a origem dos dados (evento normalizado em vez do
 * corpo bruto da Z-API). Os testes de caracterização do webhook garantem a paridade.
 */

import { dentroDaJanela, ehMensagemCortesia, lerCfgCortesia } from "@/lib/whatsapp-cortesia";
import { montarUrlMidiaProvedor } from "./providers/evolution-ids";
import type { EventoIgnorado, EventoMensagem, EventoNormalizado, EventoRevogacao, EventoStatusMensagem } from "./providers/tipos";

export type DesfechoEvento = "processado" | "ignorado" | "erro";

export interface ResultadoPipeline {
  resposta: Response;
  desfecho: DesfechoEvento;
  erro?: string;
}

function json(corpo: Record<string, unknown>): ResultadoPipeline {
  return { resposta: Response.json(corpo), desfecho: corpo["ignorado"] === true ? "ignorado" : "processado" };
}

/**
 * Mensagem que já existe no banco: a resposta é de leitura, o provedor reenviou.
 * `duplicada` usa 200 (reentrega normal); `duplicada_em_curso` usa 409 para que o
 * provedor tente de novo quando a gravação ainda está em andamento.
 */
function duplicada(motivo: "duplicada" | "duplicada_em_curso"): ResultadoPipeline {
  return {
    resposta: Response.json({ ok: true, ignorado: true, motivo }, { status: motivo === "duplicada" ? 200 : 409 }),
    desfecho: "ignorado",
  };
}

function falha(mensagem: string, status: number): ResultadoPipeline {
  return { resposta: new Response(mensagem, { status }), desfecho: "erro", erro: mensagem };
}

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Cliente editou uma mensagem já recebida: atualiza o texto no histórico. */
async function aplicarEdicao(db: Admin, edicao: { idAlvo: string; novoTexto: string }): Promise<boolean> {
  const { data: msg } = await db
    .from("whatsapp_mensagens")
    .select("id, texto, texto_original")
    .eq("whatsapp_message_id", edicao.idAlvo)
    .maybeSingle();
  if (!msg?.id) return false;

  await db
    .from("whatsapp_mensagens")
    .update({
      texto: edicao.novoTexto,
      texto_original: msg.texto_original ?? msg.texto,
      editada: true,
      editada_em: new Date().toISOString(),
    })
    .eq("id", msg.id);
  return true;
}

/**
 * Mensagem apagada pelo cliente (ou pela loja fora do sistema): marca como
 * apagada no histórico e não aciona o bot.
 */
async function processarRevogacao(db: Admin, ev: EventoRevogacao): Promise<ResultadoPipeline> {
  const alvo = ev.idAlvo;
  if (alvo) {
    const { data: msg } = await db
      .from("whatsapp_mensagens")
      .select("id, conversa_id, data_hora")
      .eq("whatsapp_message_id", alvo)
      .maybeSingle();
    if (msg?.id) {
      await db
        .from("whatsapp_mensagens")
        .update({ apagada: true, apagada_em: new Date().toISOString() })
        .eq("id", msg.id);

      const { data: conv } = await db
        .from("whatsapp_conversas")
        .select("ultima_mensagem_em")
        .eq("id", msg.conversa_id)
        .maybeSingle();
      const ultimaEm = (conv as { ultima_mensagem_em?: string | null } | null)?.ultima_mensagem_em;
      if (!ultimaEm || !msg.data_hora || new Date(msg.data_hora) >= new Date(ultimaEm)) {
        await db.from("whatsapp_conversas").update({ ultima_mensagem: "Mensagem apagada" }).eq("id", msg.conversa_id);
      }
    }
  }
  return json({ ok: true, ignorado: true, motivo: "revogacao" });
}

async function processarIgnorado(db: Admin, ev: EventoIgnorado): Promise<ResultadoPipeline> {
  if (ev.edicao && (await aplicarEdicao(db, ev.edicao))) {
    return json({ ok: true, ignorado: true, motivo: "edicao" });
  }
  return json({ ok: true, ignorado: true, ...(ev.motivo ? { motivo: ev.motivo } : {}) });
}

/**
 * Aviso de entrega/leitura de mensagem já enviada: atualiza os tiques das
 * mensagens de saída. Nunca rebaixa um status (lida não volta a entregue) e
 * nunca aciona o bot. Só mensagens de saída são afetadas.
 */
async function processarStatusMensagem(db: Admin, ev: EventoStatusMensagem): Promise<ResultadoPipeline> {
  const bloqueados = ev.status === "lida" ? ["lida", "erro"] : ["entregue", "lida", "erro"];
  const campos =
    ev.status === "lida"
      ? { status: ev.status, lida_em: ev.quando }
      : { status: ev.status, entregue_em: ev.quando };
  const { error } = await db
    .from("whatsapp_mensagens")
    .update(campos as never)
    .in("whatsapp_message_id", ev.ids)
    .eq("direcao", "saida")
    .not("status", "in", `(${bloqueados.join(",")})`);
  if (error) return falha("Falha ao registrar status", 500);
  return json({ ok: true, status: ev.status });
}

async function processarMensagem(db: Admin, conexaoId: string, ev: EventoMensagem): Promise<ResultadoPipeline> {
  // Cliente editou mensagem já recebida: atualiza o histórico em vez de gravar outra.
  if (ev.edicao && (await aplicarEdicao(db, ev.edicao))) {
    return json({ ok: true, ignorado: true, motivo: "edicao" });
  }

  // Mensagem enviada pelo próprio número (celular/WhatsApp Web, fora do
  // sistema): é registrada como saída para o histórico ficar completo,
  // mas nunca aciona o bot nem reabre atendimento.
  const ehSaidaPropria = ev.tipo === "mensagem_enviada_fora";
  const { telefone, lid: lidNormalizado, nomeContato, conteudo } = ev;
  const agora = new Date().toISOString();

  // Quais números o bot atende é definido na tela BOT > Números.
  // "todos": responde a todos, menos os bloqueados.
  // "somente_liberados": responde apenas aos liberados e ativos.
  const [{ data: cfgBot }, { data: regraNumero }] = await Promise.all([
    db
      .from("whatsapp_config")
      .select("modo_numeros, ignorar_agradecimentos")
      .eq("conexao_id", conexaoId)
      .limit(1)
      .maybeSingle(),
    telefone
      ? db
          .from("bot_numeros")
          .select("permitido, ativo")
          .eq("telefone", telefone)
          .eq("conexao_id", conexaoId)
          .maybeSingle()
      : Promise.resolve({ data: null as { permitido: boolean; ativo: boolean } | null }),
  ]);
  const modoNumeros = cfgBot?.modo_numeros ?? "todos";
  const regraValida = regraNumero?.ativo ? regraNumero : null;
  const botLiberadoParaNumero =
    modoNumeros === "somente_liberados"
      ? Boolean(regraValida?.permitido)
      : regraValida
        ? regraValida.permitido
        : true;

  // Evita reprocessar a mesma mensagem quando o provedor reenvia o callback.
  if (ev.idExterno) {
    const { data: jaExiste } = await db
      .from("whatsapp_mensagens")
      .select("id")
      .eq("whatsapp_message_id", ev.idExterno)
      .maybeSingle();
    if (jaExiste?.id) {
      // A mensagem está gravada, mas a conversa ainda pode estar sendo atualizada
      // (falha entre o insert e o update). Nesse caso o reenvio precisa ser
      // PROCESSADO de novo para consertar a conversa; só é descartado quando o
      // último registro da conversa já é esta mensagem.
      const { data: conversa } = await db
        .from("whatsapp_conversas")
        .select("ultima_mensagem_id")
        .eq("telefone", ev.telefone)
        .eq("conexao_id", conexaoId)
        .maybeSingle();
      const ultimaMensagemId = (conversa as { ultima_mensagem_id?: string | null } | null)?.ultima_mensagem_id;
      if (ultimaMensagemId === jaExiste.id) return duplicada("duplicada");
      return duplicada("duplicada_em_curso");
    }
  }

  type ConversaBase = {
    id: string;
    total_mensagens: number | null;
    nao_lidas: number | null;
    status: string;
    atendimento_numero: number | null;
    data_finalizacao: string | null;
    cliente_id?: string | null;
    nome_manual?: boolean | null;
  };
  const colunasConversa =
    "id, total_mensagens, nao_lidas, status, atendimento_numero, data_finalizacao, cliente_id, nome_manual";

  let conversaAberta: ConversaBase | null = null;
  let clienteId: string | null = null;

  if (!telefone) {
    // Mensagem enviada pelo celular: só temos o identificador interno do
    // chat. Localizamos a conversa já existente por ele; sem isso a
    // mensagem é ignorada (nunca criamos contato a partir de um LID).
    const { data } = await db
      .from("whatsapp_conversas")
      .select(colunasConversa)
      .eq("chat_lid", lidNormalizado ?? "")
      .eq("conexao_id", conexaoId)
      .maybeSingle();
    if (!data) return json({ ok: true, ignorado: true, motivo: "lid_sem_conversa" });
    conversaAberta = data as ConversaBase;
    clienteId = data.cliente_id ?? null;
  } else {
    // Cliente
    const { data: clienteExistente } = await db
      .from("clientes")
      .select("id, nome")
      .eq("telefone_normalizado", telefone)
      .maybeSingle();

    clienteId = clienteExistente?.id ?? null;
    if (!clienteId) {
      const { data: novo } = await db
        .from("clientes")
        .insert({ nome: nomeContato ?? "", telefone, telefone_normalizado: telefone })
        .select("id")
        .maybeSingle();
      clienteId = novo?.id ?? null;
    }

    // Conversa do cliente (única por telefone + conexão: atendimentos são numerados
    // dentro dela). Duas mensagens simultâneas do mesmo cliente não podem criar duas
    // conversas: se o INSERT esbarrar na constraint (outra requisição criou a linha
    // entre o SELECT e o INSERT), a busca seguinte recupera a linha existente.
    for (let tentativa = 0; tentativa < 2 && !conversaAberta; tentativa += 1) {
      const { data } = await db
        .from("whatsapp_conversas")
        .select(colunasConversa)
        .eq("telefone", telefone)
        .eq("conexao_id", conexaoId)
        .maybeSingle();

      if (data) {
        conversaAberta = data as ConversaBase;
        break;
      }

      const { error: erroNova } = await db.from("whatsapp_conversas").insert({
        telefone,
        conexao_id: conexaoId,
        cliente_id: clienteId,
        nome_contato: nomeContato,
        status: "automatico",
        etapa: "inicio",
        ...(lidNormalizado ? { chat_lid: lidNormalizado } : {}),
      });

      // 23505 = unique_violation: outra requisição concorrente já criou a
      // conversa deste telefone; a próxima volta do loop apenas a lê.
      if (erroNova && erroNova.code !== "23505") {
        return falha("Falha ao registrar a conversa", 500);
      }
    }
  }

  const conversaId = conversaAberta?.id ?? null;
  const totalMensagens = conversaAberta?.total_mensagens ?? 0;
  const naoLidas = conversaAberta?.nao_lidas ?? 0;

  if (!conversaId) return falha("Falha ao registrar a conversa", 500);

  // Eco da própria resposta do sistema (o provedor devolve com outro
  // identificador): não registra cópia duplicada.
  if (ehSaidaPropria && conteudo.texto) {
    const limite = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: repetida } = await db
      .from("whatsapp_mensagens")
      .select("id")
      .eq("conversa_id", conversaId)
      .eq("direcao", "saida")
      .eq("texto", conteudo.texto)
      .gte("data_hora", limite)
      .limit(1)
      .maybeSingle();
    if (repetida?.id) return json({ ok: true, ignorado: true, motivo: "eco_do_sistema" });
  }

  // Agradecimento/despedida logo após finalizar: registra a mensagem,
  // mas não reabre o atendimento nem aciona o bot (BOT > Inatividade).
  const cfgCortesia = lerCfgCortesia((cfgBot as { ignorar_agradecimentos?: unknown } | null)?.ignorar_agradecimentos);
  const cortesiaIgnorada =
    !ehSaidaPropria &&
    conversaAberta?.status === "finalizado" &&
    conteudo.tipo === "texto" &&
    cfgCortesia.ativo &&
    dentroDaJanela(conversaAberta?.data_finalizacao, cfgCortesia.janela_minutos, new Date()) &&
    ehMensagemCortesia(conteudo.texto, cfgCortesia.frases);

  if (!ehSaidaPropria && conversaAberta?.status === "finalizado" && !cortesiaIgnorada) {
    // Atendimento anterior encerrado: abre o próximo na mesma conversa.
    const numero = Number(conversaAberta.atendimento_numero ?? 1) + 1;
    await db
      .from("whatsapp_conversas")
      .update({
        status: "automatico",
        etapa: "inicio",
        atendimento_numero: numero,
        contexto: {} as never,
        data_finalizacao: null,
        motivo_finalizacao: null,
        motivo_pendencia: null,
        motivo_encaminhamento: null,
        atendente_id: null,
        atendente_nome: null,
        inatividade_avisada: false,
        inatividade_etapa: 0,
      })
      .eq("id", conversaId);

    await db.from("whatsapp_mensagens").insert({
      conversa_id: conversaId,
      direcao: "saida",
      tipo: "sistema",
      texto: `ATENDIMENTO ${numero}`,
      autor: "Sistema",
      status: "enviada",
      data_hora: agora,
    });
  }

  // Mídia que o provedor não entrega por URL (Evolution): guarda uma referência
  // interna; o arquivo é baixado depois, pela conexão (mesma rotina da fila).
  const arquivoUrl = conteudo.midia ? montarUrlMidiaProvedor(conexaoId, conteudo.midia.idMensagem) : conteudo.url;

  const { data: mensagem, error: erroMensagem } = await db
    .from("whatsapp_mensagens")
    .insert({
      conversa_id: conversaId,
      whatsapp_message_id: ev.idExterno,
      direcao: ehSaidaPropria ? "saida" : "entrada",
      autor: ehSaidaPropria ? "Atendente (WhatsApp)" : nomeContato,
      tipo: conteudo.tipo,
      texto: conteudo.texto,
      arquivo_url: arquivoUrl,
      arquivo_nome: conteudo.nome,
      mime_type: conteudo.mime,
      payload: ev.bruto as never,
      status: ehSaidaPropria ? "enviada" : "recebida",
      data_hora: agora,
    })
    .select("id")
    .maybeSingle();

  // O índice único é a proteção definitiva contra callbacks repetidos
  // que chegam em paralelo antes da consulta de deduplicação acima.
  if (erroMensagem?.code === "23505") {
    return json({ ok: true, ignorado: true, motivo: "duplicada" });
  }
  if (erroMensagem || !mensagem?.id) {
    return falha("Falha ao registrar a mensagem", 500);
  }

  // Registra imediatamente os metadados. A cópia da mídia para o
  // armazenamento privado é feita depois, pela rotina da fila.
  if (!ehSaidaPropria && arquivoUrl && (conteudo.tipo === "documento" || conteudo.tipo === "imagem")) {
    await db.from("whatsapp_arquivos").insert({
      conversa_id: conversaId,
      mensagem_id: mensagem.id,
      cliente_id: clienteId,
      nome: conteudo.nome ?? "arquivo",
      tipo: (conteudo.nome ?? "").split(".").pop()?.toUpperCase() ?? conteudo.tipo.toUpperCase(),
      mime_type: conteudo.mime,
      url: arquivoUrl,
      paginas: conteudo.paginas ?? 1,
      paginas_manuais: conteudo.tipo === "documento" && !conteudo.paginas,
    });
  }

  const resumo =
    conteudo.texto ||
    (conteudo.tipo === "documento"
      ? `📄 ${conteudo.nome}`
      : conteudo.tipo === "imagem"
        ? "🖼️ Imagem"
        : conteudo.tipo === "audio"
          ? "🎤 Áudio"
          : "Mensagem recebida");

  await db
    .from("whatsapp_conversas")
    .update({
      cliente_id: clienteId,
      // Guarda o identificador interno do chat para casar as mensagens
      // enviadas pelo celular com esta mesma conversa.
      ...(lidNormalizado ? ({ chat_lid: lidNormalizado } as Record<string, string>) : {}),
      // "…@lid" não é nome de contato: nunca sobrescreve o nome real.
      // Nome definido manualmente pelo atendente também nunca é sobrescrito.
      ...(nomeContato && !/@lid$/i.test(nomeContato) && !conversaAberta?.nome_manual
        ? { nome_contato: nomeContato }
        : {}),
      ultima_mensagem: resumo.slice(0, 300),
      // `ultima_mensagem_id` fecha a janela de duplicação: enquanto ele não
      // apontar para esta mensagem, um reenvio é reprocessado para consertar
      // a conversa (nunca duplica o registro, protegido pelo índice único).
      ultima_mensagem_id: mensagem.id,
      ultima_mensagem_em: agora,
      total_mensagens: totalMensagens + 1,
      // Resposta do atendente pelo celular não é mensagem não lida.
      nao_lidas: ehSaidaPropria ? naoLidas : naoLidas + 1,
    })
    .eq("id", conversaId);

  // Mensagem enviada fora do sistema (celular/WhatsApp Web): fica
  // registrada no histórico e o bot não é acionado. Ecos das mensagens
  // enviadas pelo próprio sistema já foram descartados acima (messageId
  // repetido ou texto idêntico), então aqui é sempre um envio manual:
  // finalizado/automático/aguardando/aguardando finalização passam para
  // "Em Atendimento"; pendente e em atendimento não mudam.
  if (ehSaidaPropria) {
    const statusAtual = conversaAberta?.status ?? "";
    if (statusAtual && statusAtual !== "em_atendimento" && statusAtual !== "pendente") {
      await db
        .from("whatsapp_conversas")
        .update({
          status: "em_atendimento",
          etapa: "em_atendimento",
          inicio_atendimento: agora,
          inatividade_avisada: false,
          inatividade_etapa: 0,
        })
        .eq("id", conversaId);
    }
    return json({ ok: true, bot: false, motivo: "enviada_fora_do_sistema" });
  }

  if (cortesiaIgnorada) {
    await db.from("whatsapp_auditoria").insert({
      conversa_id: conversaId,
      usuario_nome: "Bot",
      acao: "cortesia_ignorada",
      detalhe: `Agradecimento/despedida ignorado após finalização: "${conteudo.texto.slice(0, 120)}"`,
    });
    return json({ ok: true, bot: false, motivo: "cortesia_ignorada" });
  }

  // A mensagem fica registrada na conversa mesmo quando o bot não pode
  // responder ao número (configuração em BOT > Números).
  if (!botLiberadoParaNumero) {
    return json({ ok: true, bot: false, motivo: "numero_desativado" });
  }

  // Verificar se o Agente de Atendimento IA está ativo para esta conexão
  const { data: cfgAgente } = await db
    .from("whatsapp_config")
    .select("agente_atendimento_ativo, agente_atendimento_id")
    .eq("conexao_id", conexaoId)
    .maybeSingle();

  const agenteAtivo = cfgAgente?.agente_atendimento_ativo === true && cfgAgente?.agente_atendimento_id;
  const agenteId = cfgAgente?.agente_atendimento_id;

  if (agenteAtivo && agenteId) {
    // Enfileirar tarefa para o Agente de Atendimento IA. A chave de idempotência
    // usa o id da mensagem no provedor; sem ele, o id interno (evita colisão entre
    // mensagens sem identificador).
    const { error: erroEnfileirar } = await db.rpc("agente_enfileirar_tarefa", {
      _agente_id: agenteId,
      _tipo: "whatsapp_mensagem_recebida",
      _payload: {
        conversaId,
        mensagemId: mensagem.id,
        telefone,
        conteudo: conteudo.texto ?? "",
        tipoMensagem: conteudo.tipo,
        whatsappMessageId: ev.idExterno,
      },
      _prioridade: 10,
      _idempotency_key: `whatsapp:${conversaId}:${ev.idExterno ?? mensagem.id}`,
    });

    if (erroEnfileirar) {
      console.error("Erro ao enfileirar tarefa do agente:", erroEnfileirar);
      // Fallback: marcar como bot_pendente para o bot antigo processar
      await db
        .from("whatsapp_conversas")
        .update({ bot_pendente: true, bot_pendente_em: agora } as never)
        .eq("id", conversaId);
    }
    // Obs.: o webhook NÃO marca `agente_processando`. Essa trava é propriedade
    // exclusiva do worker (`task-processor`), que a ativa ao assumir a conversa
    // e a libera no fim. Mensagens repetidas do mesmo id já são deduplicadas pela
    // `_idempotency_key` acima, e mensagens distintas são serializadas pela trava
    // por conversa do worker.
    return json({ ok: true, agente: true });
  }

  // Fallback: bot antigo (bot_pendente)
  await db
    .from("whatsapp_conversas")
    .update({ bot_pendente: true, bot_pendente_em: agora } as never)
    .eq("id", conversaId);

  return json({ ok: true });
}

/** Aplica as regras de atendimento a um evento normalizado de qualquer provedor. */
export async function processarEventoNormalizado(conexaoId: string, ev: EventoNormalizado): Promise<ResultadoPipeline> {
  const db = await admin();
  switch (ev.tipo) {
    case "ignorado":
      return processarIgnorado(db, ev);
    case "mensagem_revogada":
      return processarRevogacao(db, ev);
    case "status_mensagem":
      return processarStatusMensagem(db, ev);
    default:
      return processarMensagem(db, conexaoId, ev);
  }
}

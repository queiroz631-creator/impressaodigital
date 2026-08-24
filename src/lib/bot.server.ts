/**
 * Atendimento automático (bot) do WhatsApp. Somente servidor.
 *
 * Regra fundamental: TODO valor é calculado por src/lib/calc.ts, com os
 * materiais e acabamentos cadastrados no sistema. A IA só é usada para
 * interpretar o que o cliente escreveu.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chamarZapi } from "@/lib/zapi.server";
import {
  FORMATOS,
  acabamentosDoTipo,
  calcularAcabamentos,
  calcularLinhas,
  totalAcabamentos,
  type Acabamento,
  type FormatoPapel,
  type Material,
  type SelecaoAcabamento,
  type TipoServico,
} from "@/lib/calc";
import {
  aplicarModelo,
  escolherOpcao,
  extrairNome,
  moeda,
  pediuAtendente,
  primeiroNumero,
  simOuNao,
  terminouEnvio,
  todosNumeros,
} from "@/lib/bot-parse";
import { interpretarOpcao, interpretarQuantidade, interpretarSimNao } from "@/lib/ia.server";

interface ContextoBot {
  nome?: string;
  tipoServico?: TipoServico;
  formato?: FormatoPapel;
  materialId?: string;
  copiasAdicionais?: number;
  frenteVerso?: boolean;
  acabamentos?: string[];
  observacao?: string;
}

interface ConversaBot {
  id: string;
  telefone: string;
  nome_contato: string | null;
  cliente_id: string | null;
  status: string;
  etapa: string;
  contexto: unknown;
  pedido_id: string | null;
}

interface ConfigBot {
  bot_ativo: boolean;
  permitir_orcamento_automatico: boolean;
  exigir_revisao_humana: boolean;
  permitir_link: boolean;
  msg_inicial: string;
  msg_boas_vindas: string;
  msg_transferencia: string;
  msg_orcamento_gerado: string;
  msg_revisao: string;
  msg_orcamento_confirmado: string;
}

export interface EntradaBot {
  tipo: string;
  texto: string;
}

const TIPOS: { valor: TipoServico; rotulo: string }[] = [
  { valor: "simples", rotulo: "Impressão Simples" },
  { valor: "especial", rotulo: "Impressão Especial" },
];

/** Envia a mensagem pelo WhatsApp e registra na conversa. */
async function responder(conversa: ConversaBot, texto: string, botoes?: string[]) {
  let r = { ok: false, erro: "Falha no envio" } as { ok: boolean; erro?: string | null };

  if (botoes && botoes.length > 0) {
    r = await chamarZapi("send-button-list", {
      metodo: "POST",
      corpo: {
        phone: conversa.telefone,
        message: texto,
        buttonList: { buttons: botoes.map((b, i) => ({ id: String(i + 1), label: b })) },
      },
    });
  }

  if (!r.ok) {
    const complemento = botoes && botoes.length > 0 ? `\n\n_Responda: ${botoes.join(" ou ")}_` : "";
    r = await chamarZapi("send-text", {
      metodo: "POST",
      corpo: { phone: conversa.telefone, message: `${texto}${complemento}` },
    });
  }

  await supabaseAdmin.from("whatsapp_mensagens").insert({
    conversa_id: conversa.id,
    direcao: "saida",
    tipo: "texto",
    texto,
    autor: "Bot",
    status: r.ok ? "enviada" : "erro",
    erro: r.ok ? null : (r.erro ?? "Falha no envio"),
  });

  await supabaseAdmin
    .from("whatsapp_conversas")
    .update({ ultima_mensagem: texto.slice(0, 300), ultima_mensagem_em: new Date().toISOString() })
    .eq("id", conversa.id);
}


type AtualizacaoConversa = Partial<{
  status: string;
  etapa: string;
  contexto: never;
  nome_contato: string;
  pedido_id: string | null;
  orcamento_id: string | null;
  motivo_encaminhamento: string | null;
  motivo_pendencia: string | null;
  motivo_finalizacao: string | null;
  ultima_mensagem: string;
  ultima_mensagem_em: string;
}>;

async function salvar(conversa: ConversaBot, dados: AtualizacaoConversa) {
  await supabaseAdmin.from("whatsapp_conversas").update(dados).eq("id", conversa.id);
}

async function salvarContexto(conversa: ConversaBot, ctx: ContextoBot, etapa?: string) {
  await salvar(conversa, { contexto: ctx as never, ...(etapa ? { etapa } : {}) });
  conversa.contexto = ctx;
  if (etapa) conversa.etapa = etapa;
}

async function auditar(conversaId: string, acao: string, detalhe?: string) {
  await supabaseAdmin.from("whatsapp_auditoria").insert({
    conversa_id: conversaId,
    usuario_nome: "Bot",
    acao,
    detalhe: detalhe ?? null,
  });
}

/** Passa a conversa para a fila humana. */
async function transferir(conversa: ConversaBot, config: ConfigBot, motivo: string, mensagem?: string) {
  await responder(conversa, mensagem ?? config.msg_transferencia);
  await salvar(conversa, {
    status: "aguardando",
    etapa: "aguardando_atendente",
    motivo_encaminhamento: motivo,
  });
  await auditar(conversa.id, "bot_transferiu", motivo);
}

function listar(opcoes: string[]) {
  return opcoes.map((o, i) => `${i + 1}. ${o}`).join("\n");
}

// ---------- Perguntas de cada etapa ----------

async function perguntarArquivos(conversa: ConversaBot) {
  await responder(
    conversa,
    "Perfeito! 📎 Agora me envie os arquivos que deseja imprimir (PDF, imagem ou Word).\n\n" +
      "Pode mandar quantos quiser. Quando terminar, escreva *PRONTO*.",
  );
  await salvar(conversa, { etapa: "aguardando_arquivos" });
  conversa.etapa = "aguardando_arquivos";
}

async function perguntarTipo(conversa: ConversaBot) {
  await responder(conversa, `Qual o tipo de impressão?\n\n${listar(TIPOS.map((t) => t.rotulo))}`);
  await salvar(conversa, { etapa: "aguardando_tipo" });
  conversa.etapa = "aguardando_tipo";
}

async function perguntarFormato(conversa: ConversaBot) {
  await responder(conversa, `Qual o formato do papel?\n\n${listar(FORMATOS.map((f) => f.rotulo))}`);
  await salvar(conversa, { etapa: "aguardando_formato" });
  conversa.etapa = "aguardando_formato";
}

async function materiaisDisponiveis(ctx: ContextoBot) {
  const { data } = await supabaseAdmin.from("materiais").select("*").eq("ativo", true).order("ordem");
  const lista = (data ?? []) as unknown as Material[];
  return lista.filter(
    (m) =>
      (m.tipo_impressao ?? "simples") === (ctx.tipoServico ?? "simples") &&
      (m.formato ?? "A4") === (ctx.formato ?? "A4"),
  );
}

async function acabamentosDisponiveis(ctx: ContextoBot) {
  const { data } = await supabaseAdmin.from("acabamentos").select("*").eq("ativo", true).order("ordem");
  const lista = (data ?? []) as unknown as Acabamento[];
  return acabamentosDoTipo(lista, ctx.tipoServico);
}

async function perguntarMaterial(conversa: ConversaBot, config: ConfigBot, ctx: ContextoBot) {
  const materiais = await materiaisDisponiveis(ctx);

  if (materiais.length === 0) {
    await transferir(
      conversa,
      config,
      "sem material para o tipo/formato escolhido",
      "Não encontrei uma opção cadastrada para essa combinação. Vou chamar um atendente para te ajudar. 😊",
    );
    return;
  }

  if (materiais.length === 1) {
    const unico = materiais[0]!;
    await salvarContexto(conversa, { ...ctx, materialId: unico.id });
    await responder(conversa, `Vou usar: *${unico.nome}*.`);
    await perguntarCopias(conversa);
    return;
  }

  await responder(
    conversa,
    `Escolha o material/papel:\n\n${listar(
      materiais.map((m) => (m.descricao ? `${m.nome} — ${m.descricao}` : m.nome)),
    )}`,
  );
  await salvar(conversa, { etapa: "aguardando_material" });
  conversa.etapa = "aguardando_material";
}

async function perguntarCopias(conversa: ConversaBot) {
  await responder(
    conversa,
    "Quantas cópias de cada arquivo você precisa? (responda com um número, por exemplo *1*)",
  );
  await salvar(conversa, { etapa: "aguardando_copias" });
  conversa.etapa = "aguardando_copias";
}

async function perguntarFrenteVerso(conversa: ConversaBot) {
  await responder(conversa, "A impressão deve ser em *frente e verso*? (responda *SIM* ou *NÃO*)");
  await salvar(conversa, { etapa: "aguardando_frente_verso" });
  conversa.etapa = "aguardando_frente_verso";
}

async function perguntarAcabamento(conversa: ConversaBot, ctx: ContextoBot) {
  const acabamentos = await acabamentosDisponiveis(ctx);

  if (acabamentos.length === 0) {
    await calcularOrcamento(conversa, ctx);
    return;
  }

  await responder(
    conversa,
    `Deseja algum acabamento? Responda com os números separados por vírgula, ou *0* para nenhum.\n\n${listar(
      acabamentos.map((a) => a.nome),
    )}`,
  );
  await salvar(conversa, { etapa: "aguardando_acabamento" });
  conversa.etapa = "aguardando_acabamento";
}

// ---------- Cálculo e criação do orçamento ----------

async function arquivosDaConversa(conversaId: string) {
  const { data } = await supabaseAdmin
    .from("whatsapp_arquivos")
    .select("*")
    .eq("conversa_id", conversaId)
    .order("created_at");
  return (data ?? []) as {
    id: string;
    nome: string;
    tipo: string;
    paginas: number;
    copias: number;
    frente_verso: boolean;
  }[];
}

async function usuarioResponsavel(): Promise<string | null> {
  const { data } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();
  return data?.user_id ?? null;
}

async function calcularOrcamento(conversa: ConversaBot, ctx: ContextoBot) {
  const config = await lerConfig();
  if (!config) return;

  const materiais = await materiaisDisponiveis(ctx);
  const material = materiais.find((m) => m.id === ctx.materialId) ?? materiais[0];

  if (!material) {
    await transferir(conversa, config, "material não encontrado no cálculo");
    return;
  }

  const arquivos = await arquivosDaConversa(conversa.id);
  const copiasPorArquivo = Math.max(1, Number(ctx.copiasAdicionais ?? 1) || 1);

  const quantidadeArquivos = arquivos.length;
  const paginasTotal = arquivos.reduce((acc, a) => acc + Math.max(1, a.paginas || 1), 0);
  const paginasAdicionais = arquivos.reduce((acc, a) => acc + Math.max(0, (a.paginas || 1) - 1), 0);
  const copiasAdicionais = arquivos.reduce((acc, a) => {
    const paginas = Math.max(1, a.paginas || 1);
    return acc + paginas * copiasPorArquivo - paginas;
  }, 0);

  const [linha] = calcularLinhas([material], {
    arquivos: quantidadeArquivos,
    paginasAdicionais,
    copiasAdicionais,
    tipoServico: ctx.tipoServico ?? "simples",
    formato: ctx.formato ?? "A4",
  });

  if (!linha) {
    await transferir(conversa, config, "não foi possível calcular o orçamento");
    return;
  }

  const acabamentos = await acabamentosDisponiveis(ctx);
  const selecionadosIds = new Set(ctx.acabamentos ?? []);
  const paginasParaAcabamento = quantidadeArquivos + paginasAdicionais + copiasAdicionais;

  const selecao: Record<string, SelecaoAcabamento> = {};
  for (const a of acabamentos) {
    if (selecionadosIds.has(a.id)) selecao[a.id] = { ativo: true, quantidade: quantidadeArquivos || 1 };
  }

  const linhasAcabamento = calcularAcabamentos(acabamentos, selecao, { paginas: paginasParaAcabamento });
  const valorAcabamento = totalAcabamentos(linhasAcabamento);
  const total = linha.total + valorAcabamento;

  const usuarioId = await usuarioResponsavel();
  if (!usuarioId) {
    await transferir(conversa, config, "nenhum usuário administrador para registrar o orçamento");
    return;
  }

  const nomeCliente = ctx.nome || conversa.nome_contato || "Cliente WhatsApp";

  const { data: pedido, error: erroPedido } = await supabaseAdmin
    .from("pedidos")
    .insert({
      usuario_id: usuarioId,
      cliente_id: conversa.cliente_id,
      cliente_nome: nomeCliente,
      cliente_telefone: conversa.telefone,
      status: "pendente_envio",
      valor_total: total,
    })
    .select("id, numero")
    .maybeSingle();

  if (erroPedido || !pedido) {
    await transferir(conversa, config, `falha ao registrar o pedido: ${erroPedido?.message ?? "desconhecida"}`);
    return;
  }

  const { data: orcamento } = await supabaseAdmin
    .from("orcamentos")
    .insert({
      usuario_id: usuarioId,
      pedido_id: pedido.id,
      cliente_id: conversa.cliente_id,
      cliente_nome: nomeCliente,
      cliente_telefone: conversa.telefone,
      material_id: material.id,
      material_nome: material.nome,
      arquivos: arquivos.map((a) => ({
        nome: a.nome,
        tipo: a.tipo,
        paginas: Math.max(1, a.paginas || 1),
        copias: copiasPorArquivo,
        frenteVerso: ctx.frenteVerso === true,
      })) as never,
      acabamentos: linhasAcabamento.map((l) => ({
        nome: l.acabamento.nome,
        quantidade: l.quantidade,
        total: l.total,
        incluso: true,
      })) as never,
      tipo_impressao: ctx.tipoServico ?? "simples",
      tamanho: ctx.formato ?? "A4",
      frente_verso: ctx.frenteVerso === true,
      quantidade_arquivos: quantidadeArquivos,
      paginas_total: paginasTotal,
      paginas_adicionais: paginasAdicionais,
      copias_adicionais: copiasAdicionais,
      valor_unitario: linha.valorUnitario,
      valor_acabamento: valorAcabamento,
      valor_total: total,
      status: "pendente_envio",
      ordem: 1,
      origem_orcamento: "whatsapp",
      revisao_necessaria: config.exigir_revisao_humana,
    })
    .select("id")
    .maybeSingle();

  await supabaseAdmin
    .from("whatsapp_arquivos")
    .update({ pedido_id: pedido.id })
    .eq("conversa_id", conversa.id);

  const resumo = [
    config.msg_orcamento_gerado,
    "",
    `*Pedido:* ${pedido.numero}`,
    `*Cliente:* ${nomeCliente}`,
    `*Material:* ${material.nome}`,
    `*Formato:* ${ctx.formato ?? "A4"}`,
    `*Arquivos:* ${quantidadeArquivos}`,
    `*Páginas:* ${paginasTotal}`,
    `*Cópias por arquivo:* ${copiasPorArquivo}`,
    `*Frente e verso:* ${ctx.frenteVerso ? "Sim" : "Não"}`,
    ...(linhasAcabamento.length > 0
      ? [`*Acabamentos:* ${linhasAcabamento.map((l) => l.acabamento.nome).join(", ")}`]
      : []),
    "",
    `*Total:* ${moeda(total)}`,
  ].join("\n");

  await responder(conversa, resumo);

  // Link público do orçamento (quando habilitado nas configurações).
  if (config.permitir_link && orcamento?.id) {
    try {
      const { criarLink } = await import("@/lib/link.server");
      const { urlBase } = await import("@/lib/link-dados.server");
      const token = await criarLink(orcamento.id, pedido.id, conversa.id);
      const base = urlBase();
      if (base) {
        await responder(
          conversa,
          `Você também pode conferir e ajustar o pedido por aqui:\n${base}/orcamento/${token}`,
        );
      }
    } catch {
      /* o link é opcional: falhas não interrompem o atendimento */
    }
  }

  await salvar(conversa, {
    pedido_id: pedido.id,
    orcamento_id: orcamento?.id ?? null,
    contexto: ctx as never,
  });
  conversa.pedido_id = pedido.id;

  await auditar(conversa.id, "bot_gerou_orcamento", `Pedido ${pedido.numero} — ${moeda(total)}`);

  if (config.exigir_revisao_humana) {
    await responder(conversa, config.msg_revisao);
    await salvar(conversa, { status: "pendente", etapa: "aguardando_revisao", motivo_pendencia: "revisão do orçamento gerado pelo bot" });
  } else {
    await responder(conversa, "Podemos confirmar este pedido? Responda *SIM* para confirmar ou *NÃO* para falar com um atendente.");
    await salvar(conversa, { etapa: "aguardando_confirmacao" });
  }
}

// ---------- Leitura de configuração ----------

async function lerConfig(): Promise<ConfigBot | null> {
  const { data } = await supabaseAdmin.from("whatsapp_config").select("*").limit(1).maybeSingle();
  return (data ?? null) as ConfigBot | null;
}

function mesmoDia(valor: string | null | undefined, agora: Date) {
  if (!valor) return false;
  const f = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return f(new Date(valor)) === f(agora);
}

// ---------- Ações do menu ----------

async function acaoConsultarPedido(conversa: ConversaBot) {
  const { data } = await supabaseAdmin
    .from("pedidos")
    .select("numero, status, valor_total, valor_pago, created_at")
    .eq("cliente_telefone", conversa.telefone)
    .order("created_at", { ascending: false })
    .limit(3);

  const pedidos = data ?? [];
  if (pedidos.length === 0) {
    await responder(conversa, "Não encontrei nenhum pedido para este número. 😕");
    return;
  }

  const linhas = pedidos.map((p) => {
    const restante = Number(p.valor_total ?? 0) - Number(p.valor_pago ?? 0);
    return [
      `*Pedido:* ${p.numero}`,
      `*Situação:* ${rotuloStatus(p.status)}`,
      `*Total:* ${moeda(Number(p.valor_total ?? 0))}`,
      restante > 0 ? `*Restante:* ${moeda(restante)}` : "*Pagamento:* quitado",
    ].join("\n");
  });

  await responder(conversa, `Encontrei estes pedidos:\n\n${linhas.join("\n\n")}`);
}

function rotuloStatus(status: string) {
  const mapa: Record<string, string> = {
    pendente_envio: "Aguardando envio",
    enviado: "Enviado",
    aprovado: "Aprovado",
    em_producao: "Em produção",
    pendente_pagamento: "Aguardando pagamento",
    finalizado: "Finalizado",
    cancelado: "Cancelado",
  };
  return mapa[status] ?? status;
}

async function acaoCurriculo(conversa: ConversaBot) {
  try {
    const { gerarLinkNovo } = await import("@/lib/curriculo.server");
    const { url } = await gerarLinkNovo();
    await responder(conversa, `Para montar seu currículo, é só preencher por aqui:\n${url}\n\nO link vale por 24 horas.`);
  } catch {
    await responder(conversa, "Não consegui gerar o link do currículo agora. Vou chamar um atendente. 😊");
  }
}

/** Executa a ação escolhida no menu e devolve true quando o fluxo continua em outra etapa. */
async function executarAcaoMenu(
  conversa: ConversaBot,
  config: ConfigBot,
  ctx: ContextoBot,
  acao: AcaoBot,
): Promise<boolean> {
  switch (acao) {
    case "orcamento": {
      if (!config.permitir_orcamento_automatico) {
        await transferir(conversa, config, "orçamento automático desativado");
        return true;
      }
      const arquivos = await arquivosDaConversa(conversa.id);
      await salvarContexto(conversa, { ...ctx, nome: ctx.nome || conversa.nome_contato || "" });
      if (arquivos.length > 0) {
        await responder(conversa, `Já tenho *${arquivos.length}* arquivo(s) seu(s). Envie mais ou escreva *PRONTO*.`);
        await salvar(conversa, { etapa: "aguardando_arquivos" });
        conversa.etapa = "aguardando_arquivos";
      } else {
        await perguntarArquivos(conversa);
      }
      return true;
    }

    case "consultar_pedido": {
      await acaoConsultarPedido(conversa);
      await responder(conversa, "Posso ajudar em algo mais?", ["SIM", "NÃO"]);
      await salvar(conversa, { etapa: "pos_resposta" });
      return true;
    }

    case "curriculo": {
      await acaoCurriculo(conversa);
      await responder(conversa, "Posso ajudar em algo mais?", ["SIM", "NÃO"]);
      await salvar(conversa, { etapa: "pos_resposta" });
      return true;
    }

    case "atendente": {
      await transferir(conversa, config, "cliente escolheu falar com atendente");
      return true;
    }

    default:
      return false;
  }
}

// ---------- Máquina de estados ----------

export async function processarBot(conversaId: string, entrada: EntradaBot): Promise<void> {
  const config = await lerConfig();
  if (!config?.bot_ativo) return;

  const { data } = await supabaseAdmin
    .from("whatsapp_conversas")
    .select("id, telefone, nome_contato, cliente_id, status, etapa, contexto, pedido_id, saudacao_em")
    .eq("id", conversaId)
    .maybeSingle();

  const conversa = (data ?? null) as ConversaBot | null;
  if (!conversa) return;

  // O bot só atua enquanto a conversa estiver no modo automático.
  if (conversa.status !== "automatico") return;

  const ctx: ContextoBot = (conversa.contexto ?? {}) as ContextoBot;
  const texto = (entrada.texto ?? "").trim();
  const ehArquivo = entrada.tipo === "documento" || entrada.tipo === "imagem";
  const agora = new Date();

  // Qualquer mensagem do cliente reinicia o controle de inatividade.
  await supabaseAdmin.from("whatsapp_conversas").update({ inatividade_avisada: false }).eq("id", conversa.id);

  if (texto && pediuAtendente(texto)) {
    await transferir(conversa, config, "cliente pediu atendimento humano");
    return;
  }

  // Etapas de saudação, menu, palavras-chave e respostas automáticas.
  if (ETAPAS_MENU.has(conversa.etapa) || conversa.etapa === "finalizado") {
    const dados = await carregarDadosBot();
    if (!dados) return;

    const primeiraDoDia = !mesmoDia(conversa.saudacao_em, agora);
    const etapaAtual = conversa.etapa === "finalizado" ? "inicio" : conversa.etapa;

    if (etapaAtual === "inicio" && !dentroDoHorario(dados, agora) && dados.config.msg_fora_horario.trim()) {
      await responder(
        conversa,
        aplicarVariaveis(dados.config.msg_fora_horario, {
          nome: conversa.nome_contato ?? "",
          telefone: conversa.telefone,
          agora,
        }),
      );
    }

    const saida = await processarMenu(
      dados,
      { etapa: etapaAtual, pendenteTipo: ctx.pendenteTipo ?? null, pendenteId: ctx.pendenteId ?? null },
      {
        texto,
        tipo: entrada.tipo,
        nome: conversa.nome_contato ?? "",
        telefone: conversa.telefone,
        primeiraDoDia,
      },
      {
        opcao: (pergunta, resposta, opcoes) => interpretarOpcao(pergunta, resposta, opcoes),
        simNao: (pergunta, resposta) => interpretarSimNao(pergunta, resposta),
      },
      agora,
    );

    if (saida.mensagens.length === 0 && etapaAtual !== "inicio" && texto && dados.config.msg_nao_entendi.trim()) {
      await responder(conversa, dados.config.msg_nao_entendi);
    }

    for (const m of saida.mensagens) await responder(conversa, m.texto, m.botoes);

    await salvarContexto(
      conversa,
      { ...ctx, pendenteTipo: saida.estado.pendenteTipo ?? null, pendenteId: saida.estado.pendenteId ?? null },
      saida.estado.etapa,
    );

    if (etapaAtual === "inicio") {
      await salvar(conversa, { saudacao_em: agora.toISOString() });
    }

    if (saida.estado.etapa === "finalizado") {
      await salvar(conversa, { status: "finalizado", data_finalizacao: agora.toISOString() });
      await auditar(conversa.id, "bot_finalizou", "cliente não precisava de mais nada");
      return;
    }

    if (saida.acao) await executarAcaoMenu(conversa, config, ctx, saida.acao);
    return;
  }

  switch (conversa.etapa) {


    case "aguardando_arquivos": {
      if (ehArquivo) {
        const arquivos = await arquivosDaConversa(conversa.id);
        await responder(
          conversa,
          `Recebi! 📄 Já tenho *${arquivos.length}* arquivo(s).\n\nEnvie mais arquivos ou escreva *PRONTO* para continuar.`,
        );
        return;
      }

      if (terminouEnvio(texto)) {
        const arquivos = await arquivosDaConversa(conversa.id);
        if (arquivos.length === 0) {
          await responder(conversa, "Ainda não recebi nenhum arquivo. Pode enviar o material que deseja imprimir? 😊");
          return;
        }
        await perguntarTipo(conversa);
        return;
      }

      await responder(
        conversa,
        "Estou aguardando os arquivos 📎. Envie-os aqui pelo WhatsApp e escreva *PRONTO* quando terminar.",
      );
      return;
    }

    case "aguardando_tipo": {
      const rotulos = TIPOS.map((t) => t.rotulo);
      let indice = escolherOpcao(texto, rotulos);
      if (indice === null) indice = await interpretarOpcao("Qual o tipo de impressão?", texto, rotulos);

      if (indice === null) {
        await responder(conversa, `Não entendi. Escolha uma opção:\n\n${listar(rotulos)}`);
        return;
      }

      await salvarContexto(conversa, { ...ctx, tipoServico: TIPOS[indice]!.valor });
      await perguntarFormato(conversa);
      return;
    }

    case "aguardando_formato": {
      const rotulos = FORMATOS.map((f) => f.rotulo);
      let indice = escolherOpcao(texto, rotulos);
      if (indice === null) indice = await interpretarOpcao("Qual o formato do papel?", texto, rotulos);

      if (indice === null) {
        await responder(conversa, `Não entendi. Escolha o formato:\n\n${listar(rotulos)}`);
        return;
      }

      const novoCtx: ContextoBot = { ...ctx, formato: FORMATOS[indice]!.valor };
      await salvarContexto(conversa, novoCtx);
      await perguntarMaterial(conversa, config, novoCtx);
      return;
    }

    case "aguardando_material": {
      const materiais = await materiaisDisponiveis(ctx);
      const rotulos = materiais.map((m) => m.nome);

      let indice = escolherOpcao(texto, rotulos);
      if (indice === null) indice = await interpretarOpcao("Escolha o material/papel", texto, rotulos);

      if (indice === null || !materiais[indice]) {
        await responder(conversa, `Não entendi. Escolha o material:\n\n${listar(rotulos)}`);
        return;
      }

      await salvarContexto(conversa, { ...ctx, materialId: materiais[indice]!.id });
      await perguntarCopias(conversa);
      return;
    }

    case "aguardando_copias": {
      let quantidade = primeiroNumero(texto);
      if (quantidade === null) quantidade = await interpretarQuantidade("Quantas cópias de cada arquivo?", texto);

      if (quantidade === null || quantidade < 1 || quantidade > 10000) {
        await responder(conversa, "Me informe a quantidade de cópias em número, por exemplo *1* ou *5*.");
        return;
      }

      await salvarContexto(conversa, { ...ctx, copiasAdicionais: quantidade });
      await perguntarFrenteVerso(conversa);
      return;
    }

    case "aguardando_frente_verso": {
      let resposta = simOuNao(texto);
      if (resposta === null) resposta = await interpretarSimNao("A impressão deve ser frente e verso?", texto);

      if (resposta === null) {
        await responder(conversa, "Responda *SIM* ou *NÃO* para frente e verso, por favor. 😊");
        return;
      }

      const novoCtx: ContextoBot = { ...ctx, frenteVerso: resposta };
      await salvarContexto(conversa, novoCtx);
      await perguntarAcabamento(conversa, novoCtx);
      return;
    }

    case "aguardando_acabamento": {
      const acabamentos = await acabamentosDisponiveis(ctx);
      const rotulos = acabamentos.map((a) => a.nome);
      const numeros = todosNumeros(texto);

      let escolhidos: string[] = [];

      if (numeros.includes(0) || simOuNao(texto) === false) {
        escolhidos = [];
      } else if (numeros.length > 0) {
        escolhidos = numeros
          .filter((n) => n >= 1 && n <= acabamentos.length)
          .map((n) => acabamentos[n - 1]!.id);
        if (escolhidos.length === 0) {
          await responder(conversa, `Não entendi. Responda com os números da lista ou *0* para nenhum.\n\n${listar(rotulos)}`);
          return;
        }
      } else {
        const indice = escolherOpcao(texto, rotulos) ?? (await interpretarOpcao("Qual acabamento deseja?", texto, rotulos));
        if (indice === null) {
          await responder(conversa, `Não entendi. Responda com os números da lista ou *0* para nenhum.\n\n${listar(rotulos)}`);
          return;
        }
        escolhidos = [acabamentos[indice]!.id];
      }

      const novoCtx: ContextoBot = { ...ctx, acabamentos: escolhidos };
      await salvarContexto(conversa, novoCtx, "calculando");
      await responder(conversa, "Ótimo! Estou calculando seu orçamento... ⏳");
      await calcularOrcamento(conversa, novoCtx);
      return;
    }

    case "aguardando_confirmacao": {
      let resposta = simOuNao(texto);
      if (resposta === null) resposta = await interpretarSimNao("Podemos confirmar este pedido?", texto);

      if (resposta === true) {
        await responder(conversa, config.msg_orcamento_confirmado);
        if (conversa.pedido_id) {
          await supabaseAdmin.from("pedidos").update({ status: "aprovado" }).eq("id", conversa.pedido_id);
          await supabaseAdmin.from("orcamentos").update({ status: "aprovado" }).eq("pedido_id", conversa.pedido_id);
        }
        await salvar(conversa, { status: "pendente", etapa: "aguardando_atendente", motivo_pendencia: "pedido confirmado pelo cliente" });
        await auditar(conversa.id, "cliente_confirmou_orcamento");
        return;
      }

      if (resposta === false) {
        await transferir(conversa, config, "cliente não confirmou o orçamento");
        return;
      }

      await responder(conversa, "Responda *SIM* para confirmar o pedido ou *NÃO* para falar com um atendente.");
      return;
    }

    default:
      // Etapas em espera humana (revisão/atendente/finalizado): o bot não responde.
      return;
  }
}

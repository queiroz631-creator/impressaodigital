/**
 * Atendimento automático (bot) do WhatsApp. Somente servidor.
 *
 * Regra fundamental: TODO valor é calculado por src/lib/calc.ts, com os
 * materiais e acabamentos cadastrados no sistema. A IA só é usada para
 * interpretar o que o cliente escreveu.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chamarZapi, enviarPresencaDigitando } from "@/lib/zapi.server";
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
  escolherOpcao,
  moeda,
  pediuAtendente,
  primeiroNumero,
  simOuNao,
  terminouEnvio,
  todosNumeros,
} from "@/lib/bot-parse";
import { interpretarOpcao, interpretarQuantidade, interpretarSimNao } from "@/lib/ia.server";
import { carregarDadosBot, carregarFluxos } from "@/lib/bot-dados.server";
import {
  ETAPAS_MENU,
  aplicarVariaveis,
  dentroDoHorario,
  escolherRegra,
  processarMenu,
  reconhecerResposta,
  type AcaoBot,
  type BotDados,
  type BotResposta,
  type MidiaBot,
  type RegraPrimeiroContato,
} from "@/lib/bot-motor";
import type { DadosFluxos } from "@/lib/bot-fluxos";
import {
  avancar,
  
  fluxoInicial,
  fluxoPorId,
  iniciar as iniciarFluxo,
  processarFluxo,
  type EstadoFluxo,
  type SaidaFluxo,
} from "@/lib/bot-fluxos-motor";

interface ContextoBot {
  nome?: string;
  tipoServico?: TipoServico;
  formato?: FormatoPapel;
  materialId?: string;
  copiasAdicionais?: number;
  frenteVerso?: boolean;
  acabamentos?: string[];
  observacao?: string;
  pendenteTipo?: "opcao" | "resposta" | null;
  pendenteId?: string | null;
  /** Estado do fluxo configurável em execução. */
  fluxo?: EstadoFluxo | null;
  /** Resposta automática aguardando confirmação do cliente (triagem). */
  triagem?: string | null;
  /** Regra de primeiro contato aguardando confirmação SIM/NÃO. */
  regra?: string | null;
  /** Fluxo iniciado automaticamente pelo tempo de fallback (nada reconhecido). */
  fluxoFallback?: boolean | null;
  /** Regras de primeiro contato que já enviaram a mensagem neste atendimento. */
  regrasEnviadas?: string[] | null;
  /** Compatibilidade com atendimentos gravados antes da lista acima. */
  regraEnviada?: string | null;
  /** Última regra de primeiro contato acionada (não pode repetir em sequência). */
  ultimaRegra?: string | null;
  /** Momento em que a última regra de primeiro contato enviou a mensagem. */
  ultimaRegraEm?: string | null;
  /** Janela em que uma regra diferente ainda pode ser acionada. */
  janelaRegra?: boolean | null;
  /** Última mensagem de entrada já processada pelo bot (evita respostas repetidas). */
  ultimaProcessada?: string | null;

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
  saudacao_em?: string | null;
}

interface ConfigBot {
  bot_ativo: boolean;
  permitir_orcamento_automatico: boolean;
  exigir_revisao_humana: boolean;
  permitir_link: boolean;
  msg_inicial: string;
  msg_boas_vindas: string;
  msg_transferencia: string;
  msg_transferencia_ativo: boolean;
  msg_orcamento_gerado: string;
  msg_revisao: string;
  msg_orcamento_confirmado: string;
}

export interface EntradaBot {
  tipo: string;
  texto: string;
  mensagemId?: string;
}

interface MensagemEntrada {
  id: string;
  tipo: string | null;
  texto: string | null;
  arquivo_nome: string | null;
  payload: unknown;
}

/**
 * Documentos sem legenda devem ser tratados como arquivo puro. Também cobre
 * mensagens antigas gravadas quando o nome do PDF era salvo como texto.
 */
function entradaDaMensagem(mensagem: MensagemEntrada): EntradaBot {
  let texto = (mensagem.texto ?? "").trim();

  if (mensagem.tipo === "documento") {
    const payload = mensagem.payload as { document?: { caption?: unknown; fileName?: unknown } } | null;
    const legenda = typeof payload?.document?.caption === "string" ? payload.document.caption.trim() : "";
    const nomePayload = typeof payload?.document?.fileName === "string" ? payload.document.fileName.trim() : "";
    const nome = (mensagem.arquivo_nome ?? nomePayload).trim();

    if (!legenda || (nome && texto.localeCompare(nome, undefined, { sensitivity: "accent" }) === 0)) {
      texto = legenda;
    }
  }

  return {
    mensagemId: mensagem.id,
    tipo: mensagem.tipo ?? "texto",
    texto,
  };
}

const TIPOS: { valor: TipoServico; rotulo: string }[] = [
  { valor: "simples", rotulo: "Impressão Simples" },
  { valor: "especial", rotulo: "Impressão Especial" },
];

/**
 * Resolve o endereço público temporário do arquivo da etapa. Aceita URL
 * completa (colada pelo usuário) ou caminho no bucket privado bot-midia.
 */
async function urlDaMidia(url: string): Promise<string | null> {
  if (/^https?:\/\//i.test(url)) return url;
  const { data } = await supabaseAdmin.storage.from("bot-midia").createSignedUrl(url, 60 * 60);
  return data?.signedUrl ?? null;
}

/** Endpoint e corpo da Z-API conforme o tipo de arquivo. */
function envioDeMidia(
  telefone: string,
  tipo: string,
  url: string,
  legenda: string,
  nome: string | null | undefined,
): { caminho: string; corpo: Record<string, unknown> } | null {
  switch (tipo) {
    case "imagem":
      return { caminho: "send-image", corpo: { phone: telefone, image: url, caption: legenda } };
    case "audio":
      return { caminho: "send-audio", corpo: { phone: telefone, audio: url } };
    case "video":
      return { caminho: "send-video", corpo: { phone: telefone, video: url, caption: legenda } };
    case "documento": {
      const arquivo = nome || "documento.pdf";
      const extensao = (arquivo.split(".").pop() || "pdf").toLowerCase();
      return {
        caminho: `send-document/${extensao}`,
        corpo: { phone: telefone, document: url, fileName: arquivo, caption: legenda },
      };
    }
    default:
      return null;
  }
}

/** Tentativas de envio antes de desistir da mensagem. */
const TENTATIVAS_ENVIO = 3;

/**
 * Envia a mensagem pelo WhatsApp e registra na conversa. Confere o retorno da
 * operadora e tenta de novo quando o envio não é confirmado; devolve true
 * somente quando a mensagem realmente saiu.
 */
async function responder(
  conversa: ConversaBot,
  texto: string,
  botoes?: string[],
  midia?: MidiaBot,
): Promise<boolean> {
  // Texto simples sempre: listas de botões não são entregues de forma confiável.
  const cabecalho = "_🤖 mensagem do bot_";
  const complemento = botoes && botoes.length > 0 ? `\n\n_Responda: ${botoes.join(" ou ")}_` : "";
  const mensagem = texto.trim() ? `${cabecalho}\n\n${texto}${complemento}` : cabecalho;

  let envio: { caminho: string; corpo: Record<string, unknown> } | null = null;
  if (midia?.url) {
    const link = await urlDaMidia(midia.url);
    if (link) envio = envioDeMidia(conversa.telefone, midia.tipo, link, mensagem, midia.nome);
    // O áudio não aceita legenda: o texto vai em uma mensagem antes.
    if (envio && midia.tipo === "audio" && mensagem.trim()) {
      await responder(conversa, texto, botoes);
    }
  }
  if (!envio) envio = { caminho: "send-text", corpo: { phone: conversa.telefone, message: mensagem } };

  // Mostra "digitando..." no WhatsApp do cliente antes de enviar, com duração
  // proporcional ao tamanho da mensagem (1,5s a 4s).
  const digitandoMs = Math.min(4000, 1500 + mensagem.length * 20);
  await enviarPresencaDigitando(conversa.telefone, digitandoMs);
  await new Promise((x) => setTimeout(x, digitandoMs));

  let entregue = false;
  let idMensagem: unknown = null;
  let erro: string | null = null;

  for (let tentativa = 1; tentativa <= TENTATIVAS_ENVIO && !entregue; tentativa += 1) {
    const r = await chamarZapi(envio.caminho, { metodo: "POST", corpo: envio.corpo });
    const dados = (r.dados ?? {}) as { messageId?: unknown; zaapId?: unknown; error?: unknown };
    idMensagem = dados.messageId ?? dados.zaapId ?? null;
    entregue = r.ok && Boolean(idMensagem);
    erro = entregue ? null : (r.erro ?? (dados.error ? String(dados.error) : "A operadora não confirmou o envio."));
    // Espera curta antes de repetir (falha momentânea de rede ou da operadora).
    if (!entregue && tentativa < TENTATIVAS_ENVIO) await new Promise((x) => setTimeout(x, 1500));
  }

  await supabaseAdmin.from("whatsapp_mensagens").insert({
    conversa_id: conversa.id,
    direcao: "saida",
    tipo: envio.caminho === "send-text" ? "texto" : (midia?.tipo ?? "texto"),
    texto,
    ...(midia?.nome ? { arquivo_nome: midia.nome } : {}),
    autor: "Bot",
    whatsapp_message_id: idMensagem ? String(idMensagem) : null,
    status: entregue ? "enviada" : "erro",
    erro,
  });

  if (!entregue) {
    await supabaseAdmin.from("whatsapp_auditoria").insert({
      conversa_id: conversa.id,
      usuario_nome: "Bot",
      acao: "bot_falha_envio",
      detalhe: `${TENTATIVAS_ENVIO} tentativas sem confirmação: ${erro ?? "erro desconhecido"}`,
    });
    return false;
  }

  await supabaseAdmin
    .from("whatsapp_conversas")
    .update({ ultima_mensagem: texto.slice(0, 300), ultima_mensagem_em: new Date().toISOString() })
    .eq("id", conversa.id);
  return true;
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
  saudacao_em: string | null;
  data_finalizacao: string | null;
  inatividade_avisada: boolean;
  ultima_mensagem: string;
  ultima_mensagem_em: string;
  finalizacao_fluxo_em: string | null;
  nao_lidas: number;
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
async function transferir(
  conversa: ConversaBot,
  config: ConfigBot,
  motivo: string,
  mensagem?: string,
  silencioso = false,
) {
  let aviso = silencioso
    ? ""
    : (mensagem ?? (config.msg_transferencia_ativo !== false ? config.msg_transferencia : ""));

  // Fora do horário de funcionamento, a transferência usa a mensagem própria
  // configurada na aba Horários — inclusive nas transferências silenciosas.
  const dados = await carregarDadosBot();
  const agora = new Date();
  if (
    dados &&
    !dentroDoHorario(dados, agora) &&
    dados.config.msg_transferencia_fora_horario_ativo &&
    dados.config.msg_transferencia_fora_horario.trim()
  ) {
    aviso = aplicarVariaveis(dados.config.msg_transferencia_fora_horario, {
      nome: conversa.nome_contato ?? "",
      telefone: conversa.telefone,
      agora,
    });
  }

  if (aviso.trim()) await responder(conversa, aviso);
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

// ---------- Fluxos configuráveis ----------

/** Executa a ação de sistema pedida pela etapa. Devolve true quando o fluxo continua. */
async function executarAcaoFluxo(
  conversa: ConversaBot,
  config: ConfigBot,
  ctx: ContextoBot,
  acao: string,
): Promise<boolean> {
  switch (acao) {
    case "iniciar_orcamento":
    case "receber_arquivo":
    case "analisar_arquivos":
    case "contar_paginas":
    case "enviar_orcamento":
      await executarAcaoMenu(conversa, config, ctx, "orcamento");
      return false;

    case "consultar_pedido":
      await acaoConsultarPedido(conversa);
      return true;

    case "iniciar_curriculo":
    case "gerar_link":
      await acaoCurriculo(conversa);
      return true;

    case "transferir_atendente":
      await transferir(conversa, config, "fluxo do bot encaminhou para atendimento");
      return false;

    case "transferir_silencioso":
      await transferir(conversa, config, "fluxo do bot encaminhou para atendimento", undefined, true);
      return false;

    case "criar_pendente":
      await salvar(conversa, {
        status: "pendente",
        etapa: "aguardando_atendente",
        motivo_pendencia: "fluxo do bot",
      });
      await auditar(conversa.id, "bot_criou_pendencia");
      return false;

    default:
      return true;
  }
}

/** Envia as mensagens do fluxo, grava o estado e executa as ações de sistema. */
async function entregarFluxo(
  conversa: ConversaBot,
  config: ConfigBot,
  ctx: ContextoBot,
  dados: DadosFluxos,
  inicial: SaidaFluxo,
  vars: { nome: string; telefone: string; agora: Date },
) {
  let atual = inicial;

  for (let volta = 0; volta < 6; volta += 1) {
    // Fora do horário, uma etapa que termina em transferência não envia o próprio
    // texto: o cliente recebe somente a mensagem de fora do horário configurada.
    let pularMensagens = false;
    const vaiTransferir =
      atual.transferir ||
      atual.acao === "transferir_atendente" ||
      atual.acao === "transferir_silencioso";
    if (vaiTransferir) {
      const cfgHorario = await carregarDadosBot();
      pularMensagens = Boolean(
        cfgHorario &&
          !dentroDoHorario(cfgHorario, vars.agora) &&
          cfgHorario.config.msg_transferencia_fora_horario_ativo &&
          cfgHorario.config.msg_transferencia_fora_horario.trim(),
      );
    }

    for (const m of pularMensagens ? [] : atual.mensagens) {
      const enviou = await responder(conversa, m.texto, m.botoes, m.midia);
      // Envio não confirmado: mantém o estado anterior da conversa para que a
      // próxima mensagem do cliente refaça este passo, em vez de avançar sem
      // que ele tenha recebido nada.
      if (!enviou) return;
      // Espera configurada na etapa antes de seguir automaticamente (teto de 60s).
      const espera = Math.min(60, Math.max(0, m.espera ?? 0));
      if (espera > 0) {
        await enviarPresencaDigitando(conversa.telefone, espera * 1000);
        await new Promise((r) => setTimeout(r, espera * 1000));
      }
    }


    if (atual.finalizar) {
      if (!atual.silencioso) {
        const cfg = await carregarDadosBot();
        const despedida = cfg?.config.msg_finalizacao_ativo ? cfg.config.msg_finalizacao.trim() : "";
        if (despedida) await responder(conversa, aplicarVariaveis(despedida, vars));
      }
      await salvarContexto(conversa, { ...ctx, fluxo: null, fluxoFallback: null }, "finalizado");
      await salvar(conversa, {
        status: "finalizado",
        data_finalizacao: vars.agora.toISOString(),
        nao_lidas: 0,
      });
      await auditar(conversa.id, "bot_finalizou", "fluxo finalizado");
      return;
    }

    if (atual.estado) {
      await salvarContexto(conversa, { ...ctx, fluxo: atual.estado }, "fluxo");
    } else if (!atual.transferir && !atual.pendente) {
      await salvarContexto(conversa, { ...ctx, fluxo: null }, "inicio");
    }

    if (!atual.acao && !atual.transferir && !atual.pendente) return;

    const acao =
      atual.acao ??
      (atual.transferir
        ? atual.silencioso
          ? "transferir_silencioso"
          : "transferir_atendente"
        : "criar_pendente");
    const continuar = await executarAcaoFluxo(conversa, config, ctx, acao);
    if (!continuar || !atual.etapaAcao || !atual.estado) return;

    atual = avancar(dados, atual.etapaAcao, atual.estado, vars);
  }
}

// ---------- Triagem do primeiro contato ----------

type Vars = { nome: string; telefone: string; agora: Date };

/** Texto da resposta automática conforme seja o 1º contato do dia ou um retorno. */
function textoResposta(resposta: BotResposta, primeiraDoDia: boolean) {
  const retorno = (resposta.resposta_retorno_dia ?? "").trim();
  return !primeiraDoDia && retorno ? retorno : resposta.resposta;
}

/** Imagem opcional configurada na resposta automática. */
function midiaResposta(resposta: BotResposta): MidiaBot | undefined {
  const tipo = resposta.tipo_midia ?? "texto";
  if (tipo === "texto" || !resposta.midia_url) return undefined;
  return { tipo: "imagem", url: resposta.midia_url, nome: resposta.midia_nome ?? null };
}

/** Frase de confirmação da resposta automática (cada resposta pode ter a sua). */
export const PERGUNTA_CONFIRMACAO_PADRAO = "Você quer falar sobre *{titulo}*?";

function perguntaConfirmacao(resposta: BotResposta) {
  const texto = (resposta.pergunta_confirmacao ?? "").trim() || PERGUNTA_CONFIRMACAO_PADRAO;
  return texto.replace(/\{titulo\}/g, resposta.titulo);
}

/** Executa a ação configurada para o SIM ou o NÃO de uma resposta automática. */
async function executarAcaoResposta(
  conversa: ConversaBot,
  config: ConfigBot,
  ctx: ContextoBot,
  cfg: BotDados,
  fluxos: DadosFluxos,
  acao: string,
  destinoFluxoId: string | null,
  destinoRespostaId: string | null,
  primeiraDoDia: boolean,
  vars: Vars,
  profundidade = 0,
): Promise<void> {
  if (profundidade > 3) return;

  switch (acao) {
    case "iniciar_fluxo":
    case "fluxo_inicial": {
      const alvo =
        acao === "iniciar_fluxo" && destinoFluxoId
          ? fluxos.fluxos.find((f) => f.id === destinoFluxoId && f.ativo)
          : fluxoInicial(fluxos);
      if (!alvo) return;
      const saida = iniciarFluxo(fluxos, alvo.id, {}, vars, 0);
      await entregarFluxo(conversa, config, { ...ctx, triagem: null, regra: null }, fluxos, saida, vars);
      return;
    }

    case "resposta": {
      const outra = cfg.respostas.find((r) => r.id === destinoRespostaId && r.ativo);
      if (!outra) return;
      const enviou = await responder(
        conversa,
        aplicarVariaveis(textoResposta(outra, primeiraDoDia), vars),
        undefined,
        midiaResposta(outra),
      );
      if (!enviou) return;
      await executarAcaoResposta(
        conversa,
        config,
        ctx,
        cfg,
        fluxos,
        outra.acao_sim,
        outra.destino_sim_fluxo_id,
        outra.destino_sim_resposta_id,
        primeiraDoDia,
        vars,
        profundidade + 1,
      );
      return;
    }

    case "atendente":
    case "transferir_silencioso":
      await transferir(
        conversa,
        config,
        "resposta automática encaminhou para atendimento",
        undefined,
        acao === "transferir_silencioso",
      );
      return;

    case "finalizar":
    case "finalizar_silencioso": {
      const despedida =
        acao !== "finalizar_silencioso" && cfg.config.msg_finalizacao_ativo
          ? cfg.config.msg_finalizacao.trim()
          : "";
      if (despedida) await responder(conversa, aplicarVariaveis(despedida, vars));
      await salvarContexto(conversa, { ...ctx, fluxo: null, triagem: null }, "finalizado");
      await salvar(conversa, { status: "finalizado", data_finalizacao: vars.agora.toISOString(), nao_lidas: 0 });
      await auditar(conversa.id, "bot_finalizou", "resposta automática finalizou o atendimento");
      return;
    }

    default:
      // "aguardar": o bot fica em silêncio esperando a próxima mensagem.
      await salvarContexto(conversa, { ...ctx, fluxo: null, triagem: null }, "inicio");
  }
}

/** A regra deixa a janela aberta para outra regra diferente ser acionada? */
function janelaAberta(acao: string) {
  return acao === "aguardar" || acao === "resposta";
}

/** Lista de regras que já enviaram mensagem neste atendimento. */
function regrasEnviadas(ctx: ContextoBot): string[] {
  const lista = ctx.regrasEnviadas ?? (ctx.regraEnviada ? [ctx.regraEnviada] : []);
  return Array.isArray(lista) ? lista : [];
}

/** Executa a ação configurada em uma regra de primeiro contato. */
async function executarAcaoRegra(
  conversa: ConversaBot,
  config: ConfigBot,
  ctx: ContextoBot,
  cfg: BotDados,
  fluxos: DadosFluxos,
  regra: RegraPrimeiroContato,
  primeiraDoDia: boolean,
  vars: Vars,
) {
  const espera = Math.min(60, Math.max(0, Number(regra.delay_segundos ?? 0)));
  if (espera > 0) {
    await enviarPresencaDigitando(conversa.telefone, espera * 1000);
    await new Promise((r) => setTimeout(r, espera * 1000));
  }

  const base: ContextoBot = {
    ...ctx,
    ultimaRegra: regra.id,
    janelaRegra: janelaAberta(regra.acao),
  };

  if (regra.acao === "aguardar") {
    await salvarContexto(
      conversa,
      { ...base, fluxo: null, fluxoFallback: null, triagem: null, regra: null },
      "inicio",
    );
    return;
  }

  await executarAcaoResposta(
    conversa,
    config,
    { ...base, triagem: null, regra: null },
    cfg,
    fluxos,
    regra.acao,
    regra.destino_fluxo_id,
    regra.destino_resposta_id,
    primeiraDoDia,
    vars,
  );
}

/**
 * Analisa o primeiro contato: primeiro as regras configuradas (saudação,
 * arquivos, arquivos + palavras-chave...), depois as respostas automáticas.
 */
async function triagem(
  conversa: ConversaBot,
  config: ConfigBot,
  ctx: ContextoBot,
  fluxos: DadosFluxos,
  entrada: EntradaBot,
  primeiraDoDia: boolean,
  vars: Vars,
) {
  const cfg = await carregarDadosBot();
  if (!cfg) return;

  // A mensagem global "Fora do horário" foi desativada: o primeiro contato
  // responde apenas pela regra configurada.
  await salvar(conversa, { saudacao_em: vars.agora.toISOString() });

  const texto = (entrada.texto ?? "").trim();
  const ehArquivo = entrada.tipo === "documento" || entrada.tipo === "imagem";

  // 1) Regras de primeiro contato configuradas na aba "Primeiro contato".
  // Dentro da janela de sequência, a última regra acionada não repete.
  const ignorar = ctx.janelaRegra ? (ctx.ultimaRegra ?? null) : null;
  const regra = escolherRegra(cfg.regras ?? [], { texto, ehArquivo }, ignorar);
  if (regra) {
    const mensagem = (regra.mensagem ?? "").trim();
    const confirmar = regra.acao === "confirmar_fluxo";
    const modo = regra.enviar_mensagem ?? "sempre";
    const enviadas = regrasEnviadas(ctx);
    const esperaMsg = Math.min(300, Math.max(0, Number(regra.delay_mensagem_segundos ?? 0)));
    const esperaAcao = Math.min(60, Math.max(0, Number(regra.delay_segundos ?? 0)));

    // Janela anti-repetição: vários arquivos do mesmo envio combinam com a
    // mesma regra em callbacks diferentes. Depois de responder uma vez, a
    // regra fica em silêncio pela duração das esperas + margem de agrupamento.
    const ultimaEm = ctx.ultimaRegra === regra.id ? Date.parse(ctx.ultimaRegraEm ?? "") : NaN;
    const janelaLote = (esperaMsg + esperaAcao) * 1000 + 45_000;
    const repetindoLote = Number.isFinite(ultimaEm) && Date.now() - ultimaEm < janelaLote;
    if (repetindoLote) return;

    // "Uma vez por atendimento": a regra só fala na primeira vez que combinar.
    const jaEnviada = modo === "uma_vez_atendimento" && enviadas.includes(regra.id);
    const podeEnviar = modo !== "primeira_do_dia" || primeiraDoDia || confirmar;
    let enviada = jaEnviada;

    if (mensagem && !jaEnviada && podeEnviar) {
      // Espera configurada na regra antes de enviar a saudação. Marca a regra
      // antes de esperar para que os arquivos que chegarem durante a espera
      // entrem no mesmo atendimento em vez de gerarem outra resposta.
      if (esperaMsg > 0) {
        await salvarContexto(
          conversa,
          { ...ctx, ultimaRegra: regra.id, ultimaRegraEm: new Date().toISOString() },
          conversa.etapa,
        );
        await enviarPresencaDigitando(conversa.telefone, esperaMsg * 1000);
        await new Promise((r) => setTimeout(r, esperaMsg * 1000));
      }
      enviada = await responder(
        conversa,
        aplicarVariaveis(mensagem, vars),
        confirmar ? ["SIM", "NÃO"] : undefined,
      );
      if (!enviada) return;
    }

    const ctxRegra: ContextoBot = {
      ...ctx,
      regraEnviada: null,
      ultimaRegra: regra.id,
      ultimaRegraEm: new Date().toISOString(),
      regrasEnviadas: enviada && !enviadas.includes(regra.id) ? [...enviadas, regra.id] : enviadas,
    };

    // Confirma a entrada como respondida assim que a mensagem sai, antes da
    // espera da ação. Se a execução em segundo plano for interrompida durante
    // essa espera, a fila não reprocessa a mesma mensagem nem reenvia a resposta.
    if (enviada) {
      await salvarContexto(conversa, ctxRegra, conversa.etapa);
      await confirmarLoteProcessado(conversa.id, "");
    }




    if (confirmar) {
      await salvarContexto(
        conversa,
        {
          ...ctxRegra,
          fluxo: null,
          fluxoFallback: null,
          triagem: null,
          regra: regra.id,
          ultimaRegra: regra.id,
          janelaRegra: true,
        },
        "triagem",
      );
      return;
    }

    await executarAcaoRegra(conversa, config, ctxRegra, cfg, fluxos, regra, primeiraDoDia, vars);
    return;
  }

  // 2) Texto → procura uma resposta automática e confirma com o cliente.
  const encontrada = texto ? reconhecerResposta(cfg, texto) : null;
  if (encontrada) {
    const enviou = await responder(
      conversa,
      aplicarVariaveis(perguntaConfirmacao(encontrada), vars),
      ["SIM", "NÃO"],
      midiaResposta(encontrada),
    );
    if (!enviou) return;
    await salvarContexto(
      conversa,
      { ...ctx, fluxo: null, fluxoFallback: null, regra: null, triagem: encontrada.id },
      "triagem",
    );
    return;
  }

  // 4) Nada reconhecido: aguarda a próxima mensagem do cliente.
  await salvarContexto(conversa, { ...ctx, fluxo: null, fluxoFallback: null, triagem: null, regra: null }, "inicio");
}

/** Trata a confirmação (SIM/NÃO) da regra ou da resposta automática sugerida. */
async function resolverTriagem(
  conversa: ConversaBot,
  config: ConfigBot,
  ctx: ContextoBot,
  fluxos: DadosFluxos,
  entrada: EntradaBot,
  primeiraDoDia: boolean,
  vars: Vars,
) {
  const cfg = await carregarDadosBot();

  // Confirmação de uma regra de primeiro contato.
  if (cfg && ctx.regra) {
    const regra = (cfg.regras ?? []).find((r) => r.id === ctx.regra);
    const escolha = simOuNao(entrada.texto ?? "");
    if (!regra || escolha === null) {
      await triagem(conversa, config, { ...ctx, regra: null }, fluxos, entrada, primeiraDoDia, vars);
      return;
    }
    if (!escolha) {
      await salvarContexto(conversa, { ...ctx, fluxo: null, triagem: null, regra: null }, "inicio");
      return;
    }
    await executarAcaoRegra(
      conversa,
      config,
      { ...ctx, regra: null },
      cfg,
      fluxos,
      { ...regra, acao: "iniciar_fluxo" },
      primeiraDoDia,
      vars,
    );
    return;
  }

  const resposta = cfg?.respostas.find((r) => r.id === ctx.triagem);
  if (!cfg || !resposta) {
    await triagem(conversa, config, ctx, fluxos, entrada, primeiraDoDia, vars);
    return;
  }

  const escolha = simOuNao(entrada.texto ?? "");
  if (escolha === null) {
    // Não confirmou nem negou: trata como uma nova mensagem de triagem.
    await triagem(conversa, config, { ...ctx, triagem: null }, fluxos, entrada, primeiraDoDia, vars);
    return;
  }

  if (escolha) await responder(conversa, aplicarVariaveis(textoResposta(resposta, primeiraDoDia), vars));

  const espera = Math.min(60, Math.max(0, Number(resposta.delay_acao_segundos ?? 0)));
  if (espera > 0) {
    await enviarPresencaDigitando(conversa.telefone, espera * 1000);
    await new Promise((r) => setTimeout(r, espera * 1000));
  }

  await salvarContexto(conversa, { ...ctx, triagem: null }, "inicio");

  await executarAcaoResposta(
    conversa,
    config,
    { ...ctx, triagem: null },
    cfg,
    fluxos,
    escolha ? resposta.acao_sim : resposta.acao_nao,
    escolha ? resposta.destino_sim_fluxo_id : resposta.destino_nao_fluxo_id,
    escolha ? resposta.destino_sim_resposta_id : resposta.destino_nao_resposta_id,
    primeiraDoDia,
    vars,
  );
}

/** Roda o fluxo configurado para a conversa (início ou continuação). */
async function rodarFluxo(
  conversa: ConversaBot,
  config: ConfigBot,
  ctx: ContextoBot,
  dados: DadosFluxos,
  _raizId: string,
  entrada: EntradaBot,
  agora: Date,
) {
  const vars: Vars = { nome: conversa.nome_contato ?? "", telefone: conversa.telefone, agora };
  const estado = conversa.etapa === "fluxo" ? (ctx.fluxo ?? null) : null;
  const primeiraDoDia = !mesmoDia(conversa.saudacao_em, agora);
  // Atendimento novo (conversa foi finalizada): as regras de primeiro contato
  // podem enviar a mensagem de novo.
  if (conversa.etapa === "finalizado") {
    ctx.regraEnviada = null;
    ctx.regrasEnviadas = [];
    ctx.ultimaRegra = null;
    ctx.janelaRegra = null;
  }

  // Janela de sequência: logo depois de uma regra de primeiro contato, uma
  // mensagem seguinte (por exemplo um arquivo) pode acionar uma regra
  // diferente, em vez de cair na confirmação pendente ou na etapa do fluxo.
  if (ctx.janelaRegra) {
    const texto = (entrada.texto ?? "").trim();
    const ehArquivo = entrada.tipo === "documento" || entrada.tipo === "imagem";
    const respondeuSimNao = conversa.etapa === "triagem" && simOuNao(texto) !== null;
    if (!respondeuSimNao) {
      const cfg = await carregarDadosBot();
      const outra = cfg ? escolherRegra(cfg.regras ?? [], { texto, ehArquivo }, ctx.ultimaRegra ?? null) : null;
      if (outra) {
        await triagem(
          conversa,
          config,
          { ...ctx, fluxo: null, fluxoFallback: null, triagem: null, regra: null },
          dados,
          entrada,
          primeiraDoDia,
          vars,
        );
        return;
      }
    }
  }

  if (conversa.etapa === "triagem") {
    await resolverTriagem(conversa, config, ctx, dados, entrada, primeiraDoDia, vars);
    return;
  }

  if (!estado) {
    await triagem(conversa, config, ctx, dados, entrada, primeiraDoDia, vars);
    return;
  }

  // Fluxo iniciado automaticamente pelo tempo de fallback: uma palavra-chave
  // reconhecida interrompe esse fluxo e volta para a triagem. Fluxos escolhidos
  // pelo cliente nunca são interrompidos.
  const raizAtual = fluxoInicial(dados);
  const aindaNoFluxoInicial = Boolean(raizAtual && estado.fluxoId === raizAtual.id);
  if (ctx.fluxoFallback && aindaNoFluxoInicial) {
    const cfg = await carregarDadosBot();
    const texto = (entrada.texto ?? "").trim();
    if (cfg && texto && reconhecerResposta(cfg, texto)) {
      await triagem(
        conversa,
        config,
        { ...ctx, fluxo: null, fluxoFallback: null },
        dados,
        entrada,
        primeiraDoDia,
        vars,
      );
      return;
    }
  }

  const saida = processarFluxo(
    dados,
    estado,
    { texto: entrada.texto ?? "", tipo: entrada.tipo, nome: vars.nome, telefone: vars.telefone },
    agora,
  );
  await entregarFluxo(conversa, config, ctx, dados, saida, vars);
}

// ---------- Máquina de estados ----------

const LOCK_EXPIRA_MS = 60_000;

/** Garante que só uma mensagem por conversa seja processada de cada vez. */
async function tentarTravar(conversaId: string): Promise<boolean> {
  const limite = new Date(Date.now() - LOCK_EXPIRA_MS).toISOString();
  const { data } = await supabaseAdmin
    .from("whatsapp_conversas")
    .update({ bot_lock_em: new Date().toISOString() } as never)
    .eq("id", conversaId)
    .or(`bot_lock_em.is.null,bot_lock_em.lt.${limite}`)
    .select("id");
  return Boolean(data && data.length > 0);
}

async function destravar(conversaId: string): Promise<void> {
  await supabaseAdmin
    .from("whatsapp_conversas")
    .update({ bot_lock_em: null } as never)
    .eq("id", conversaId);
}

/**
 * Renova a trava a cada 15s enquanto o processamento estiver em andamento.
 * Sem isso, etapas com esperas longas (digitação, avanço automático) deixam a
 * trava expirar no meio do envio e uma segunda execução da fila reprocessa a
 * mesma mensagem — era o que duplicava o link do currículo.
 */
function manterTravaViva(conversaId: string): () => void {
  const timer = setInterval(() => {
    void supabaseAdmin
      .from("whatsapp_conversas")
      .update({ bot_lock_em: new Date().toISOString() } as never)
      .eq("id", conversaId);
  }, 15_000);
  return () => clearInterval(timer);
}

/**
 * Marca como processada a entrada mais recente da conversa (ou a informada),
 * confirmando o lote inteiro de arquivos enviados juntos.
 */
async function confirmarLoteProcessado(conversaId: string, minimo: string): Promise<void> {
  const { data: ultima } = await supabaseAdmin
    .from("whatsapp_mensagens")
    .select("id")
    .eq("conversa_id", conversaId)
    .eq("direcao", "entrada")
    .order("data_hora", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: atual } = await supabaseAdmin
    .from("whatsapp_conversas")
    .select("contexto")
    .eq("id", conversaId)
    .maybeSingle();
  const ctxAtual = ((atual?.contexto ?? {}) as ContextoBot) || {};

  await supabaseAdmin
    .from("whatsapp_conversas")
    .update({ contexto: { ...ctxAtual, ultimaProcessada: ultima?.id ?? minimo } as never })
    .eq("id", conversaId);
}



export async function processarBot(conversaId: string, entrada: EntradaBot): Promise<void> {
  // Dá tempo para callbacks do mesmo envio chegarem juntos (vários arquivos).
  if (entrada.mensagemId) {
    await new Promise((r) => setTimeout(r, 1_500));
  }

  let travou = false;
  for (let tentativa = 0; tentativa < 20 && !travou; tentativa += 1) {
    travou = await tentarTravar(conversaId);
    if (!travou) await new Promise((r) => setTimeout(r, 500));
  }
  if (!travou) return;

  const pararBatimento = manterTravaViva(conversaId);
  try {
    let alvo = entrada;

    if (entrada.mensagemId) {
      // Já com a trava: responde sempre a mensagem mais recente do grupo. Se
      // ela já foi respondida por outro callback, este apenas encerra.
      const { data: ultima } = await supabaseAdmin
        .from("whatsapp_mensagens")
        .select("id, tipo, texto, arquivo_nome, payload")
        .eq("conversa_id", conversaId)
        .eq("direcao", "entrada")
        .order("data_hora", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ultima?.id) {
        const { data: atual } = await supabaseAdmin
          .from("whatsapp_conversas")
          .select("contexto")
          .eq("id", conversaId)
          .maybeSingle();

        const ctxAtual = ((atual?.contexto ?? {}) as ContextoBot) || {};
        if (ctxAtual.ultimaProcessada === ultima.id) return;

        alvo = entradaDaMensagem(ultima as MensagemEntrada);

      }
    }

    await processarBotInterno(conversaId, alvo);

    // Só confirma depois que todo o tratamento terminou, marcando a última
    // entrada existente agora: os arquivos que chegaram durante a espera fazem
    // parte do mesmo lote e não devem gerar uma nova resposta.
    if (alvo.mensagemId) {
      await confirmarLoteProcessado(conversaId, alvo.mensagemId);
    }

  } catch (e) {
    await auditar(
      conversaId,
      "bot_erro",
      e instanceof Error ? e.message : "Atendimento automático interrompido",
    );
  } finally {

    pararBatimento();
    await destravar(conversaId);
  }
}

/**
 * Copia para o armazenamento privado as mídias recebidas que ainda não foram
 * guardadas. Fica fora do webhook para não atrasar a resposta ao cliente.
 */
async function guardarMidiasPendentes(): Promise<void> {
  const { data: arquivos } = await supabaseAdmin
    .from("whatsapp_arquivos")
    .select("id, conversa_id, mensagem_id, nome, mime_type, url, storage_path")
    .is("storage_path", null)
    .not("url", "is", null)
    .order("created_at", { ascending: true })
    .limit(5);

  for (const arq of arquivos ?? []) {
    if (!arq.url) continue;
    try {
      const resposta = await fetch(arq.url);
      if (!resposta.ok) continue;
      const bytes = new Uint8Array(await resposta.arrayBuffer());
      const caminho = `${arq.conversa_id}/${Date.now()}-${(arq.nome ?? "arquivo").replace(/[^\w.-]+/g, "_")}`;
      const { error: erroUpload } = await supabaseAdmin.storage
        .from("whatsapp")
        .upload(caminho, bytes, { contentType: arq.mime_type ?? "application/octet-stream", upsert: true });
      if (erroUpload) continue;

      await supabaseAdmin.from("whatsapp_arquivos").update({ storage_path: caminho }).eq("id", arq.id);
      if (arq.mensagem_id) {
        await supabaseAdmin
          .from("whatsapp_mensagens")
          .update({ arquivo_path: caminho })
          .eq("id", arq.mensagem_id);
      }
    } catch {
      /* falha no download não invalida a mensagem nem a resposta */
    }
  }
}

/**
 * Processa as conversas marcadas como pendentes pelo webhook. Roda fora da
 * requisição do provedor, então pode respeitar as esperas configuradas sem
 * risco de a execução ser interrompida no meio.
 */
export async function drenarFilaBot(): Promise<{ processadas: number }> {
  let processadas = 0;

  for (let passada = 0; passada < 3; passada += 1) {
    // Dá tempo para callbacks do mesmo envio chegarem juntos (vários arquivos).
    await new Promise((r) => setTimeout(r, 1_500));

    const { data: pendentes } = await supabaseAdmin
      .from("whatsapp_conversas")
      .select("id, bot_pendente_em")
      .eq("bot_pendente", true)
      .order("bot_pendente_em", { ascending: true })
      .limit(5);

    if (!pendentes || pendentes.length === 0) break;

    for (const conversa of pendentes) {
      const travou = await tentarTravar(conversa.id);
      if (!travou) continue;

      const pararBatimento = manterTravaViva(conversa.id);
      try {
        const { data: ultima } = await supabaseAdmin
          .from("whatsapp_mensagens")
          .select("id, tipo, texto, arquivo_nome, payload")
          .eq("conversa_id", conversa.id)
          .eq("direcao", "entrada")
          .order("data_hora", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: atual } = await supabaseAdmin
          .from("whatsapp_conversas")
          .select("contexto")
          .eq("id", conversa.id)
          .maybeSingle();
        const ctxAtual = ((atual?.contexto ?? {}) as ContextoBot) || {};

        if (ultima?.id && ctxAtual.ultimaProcessada !== ultima.id) {
          await processarBotInterno(conversa.id, entradaDaMensagem(ultima as MensagemEntrada));
          await confirmarLoteProcessado(conversa.id, ultima.id);
          processadas += 1;
        }


        // Só desmarca se nenhuma mensagem nova chegou durante o processamento;
        // caso contrário a conversa continua na fila para a próxima passada.
        await supabaseAdmin
          .from("whatsapp_conversas")
          .update({ bot_pendente: false } as never)
          .eq("id", conversa.id)
          .eq("bot_pendente_em", conversa.bot_pendente_em as never);
      } catch (e) {
        await supabaseAdmin.from("whatsapp_auditoria").insert({
          conversa_id: conversa.id,
          usuario_nome: "Bot",
          acao: "bot_erro",
          detalhe: e instanceof Error ? e.message : "Falha no atendimento automático",
        });
        await supabaseAdmin
          .from("whatsapp_conversas")
          .update({ bot_pendente: false } as never)
          .eq("id", conversa.id);
      } finally {
        pararBatimento();
        await destravar(conversa.id);
      }
    }
  }

  await guardarMidiasPendentes();
  return { processadas };
}



async function processarBotInterno(conversaId: string, entrada: EntradaBot): Promise<void> {
  const config = await lerConfig();
  if (!config?.bot_ativo) return;


  const { data } = await supabaseAdmin
    .from("whatsapp_conversas")
    .select("id, telefone, nome_contato, cliente_id, status, etapa, contexto, pedido_id, saudacao_em")
    .eq("id", conversaId)
    .maybeSingle();

  const conversa = (data ?? null) as ConversaBot | null;
  if (!conversa) return;

  // O bot só atua no modo automático ou durante o fluxo de finalização.
  if (conversa.status !== "automatico" && conversa.status !== "aguardando_finalizacao") return;

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

  // Fluxos configuráveis (aba Fluxos): assumem quando existe um fluxo inicial ativo.
  if (
    conversa.etapa === "fluxo" ||
    conversa.etapa === "triagem" ||
    ETAPAS_MENU.has(conversa.etapa) ||
    conversa.etapa === "finalizado"
  ) {
    const fluxos = await carregarFluxos();
    const raiz = fluxoInicial(fluxos);
    if (raiz) {
      await rodarFluxo(conversa, config, ctx, fluxos, raiz.id, entrada, agora);
      return;
    }
  }

  // Etapas de saudação, menu, palavras-chave e respostas automáticas.
  if (ETAPAS_MENU.has(conversa.etapa) || conversa.etapa === "finalizado") {
    const dados = await carregarDadosBot();
    if (!dados) return;

    const primeiraDoDia = !mesmoDia(conversa.saudacao_em, agora);
    const etapaAtual = conversa.etapa === "finalizado" ? "inicio" : conversa.etapa;

    // A mensagem global "Fora do horário" foi desativada e não é mais enviada.

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
      await salvar(conversa, { status: "finalizado", data_finalizacao: agora.toISOString(), nao_lidas: 0 });
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

// ---------- Inatividade ----------

/** Mensagem configurada para o status de destino da 2ª inatividade. */
function msgDoStatus(cfg: BotDados["config"], status: string) {
  const mapa: Record<string, string> = {
    pendente: cfg.msg_inatividade_pendente,
    aguardando: cfg.msg_inatividade_aguardando,
    em_atendimento: cfg.msg_inatividade_em_atendimento,
    finalizado: cfg.msg_inatividade_finalizado,
  };
  return (mapa[status] ?? "").trim();
}

/**
 * Controla a inatividade em duas etapas: a 1ª envia um aviso e a 2ª move a
 * conversa para o status escolhido. Só vale para conversas no modo automático
 * em que o bot está aguardando a resposta do cliente.
 */
/**
 * Coloca a conversa em "Aguardando Finalização" e inicia o fluxo de
 * finalização configurado (aba Fluxos). Sem fluxo configurado, apenas
 * troca o status.
 */
export async function iniciarFinalizacao(conversaId: string): Promise<{ ok: boolean; fluxo: boolean }> {
  const { data } = await supabaseAdmin
    .from("whatsapp_conversas")
    .select("id, telefone, nome_contato, cliente_id, status, etapa, contexto, pedido_id, saudacao_em")
    .eq("id", conversaId)
    .maybeSingle();

  const conversa = (data ?? null) as ConversaBot | null;
  if (!conversa) return { ok: false, fluxo: false };

  const dadosBot = await carregarDadosBot();
  const fluxoId = dadosBot?.config.fluxo_finalizacao_id ?? null;
  const espera = Math.max(0, Number(dadosBot?.config.finalizacao_delay_minutos ?? 0));

  await supabaseAdmin
    .from("whatsapp_conversas")
    .update({
      status: "aguardando_finalizacao",
      inatividade_avisada: false,
      finalizacao_fluxo_em: fluxoId && espera > 0 ? new Date().toISOString() : null,
    })
    .eq("id", conversa.id);
  conversa.status = "aguardando_finalizacao";

  const config = await lerConfig();
  if (!fluxoId || !config) return { ok: true, fluxo: false };
  if (espera > 0) return { ok: true, fluxo: false };

  const fluxos = await carregarFluxos();
  if (!fluxoPorId(fluxos, fluxoId)) return { ok: true, fluxo: false };

  const agora = new Date();
  const ctx: ContextoBot = (conversa.contexto ?? {}) as ContextoBot;
  const vars = { nome: conversa.nome_contato ?? "", telefone: conversa.telefone, agora };
  const saida = iniciarFluxo(fluxos, fluxoId, { respostas: ctx.fluxo?.respostas ?? {} }, vars);
  await entregarFluxo(conversa, config, { ...ctx, fluxoFallback: null }, fluxos, saida, vars);
  return { ok: true, fluxo: true };
}

export async function verificarInatividade(): Promise<{ avisadas: number; finalizadas: number }> {
  const config = await lerConfig();
  if (!config?.bot_ativo) return { avisadas: 0, finalizadas: 0 };

  const dados = await carregarDadosBot();
  if (!dados) return { avisadas: 0, finalizadas: 0 };

  const min1 = Math.max(1, Number(dados.config.inatividade1_minutos ?? 5));
  const min2 = Math.max(min1, Number(dados.config.inatividade2_minutos ?? min1 * 2));
  const destino = dados.config.inatividade_status || "finalizado";
  const agora = new Date();
  const limite = new Date(agora.getTime() - min1 * 60_000).toISOString();

  const CAMPOS =
    "id, telefone, nome_contato, cliente_id, status, etapa, contexto, pedido_id, saudacao_em, inatividade_avisada, ultima_mensagem_em, finalizacao_em";

  // Nada reconhecido: depois do tempo configurado, o bot inicia o fluxo inicial.
  const minFallback = Math.max(0, Number(dados.config.fallback_inicial_minutos ?? 0));
  if (minFallback > 0) {
    const limiteFallback = new Date(agora.getTime() - minFallback * 60_000).toISOString();
    const { data: paradas } = await supabaseAdmin
      .from("whatsapp_conversas")
      .select(CAMPOS)
      .eq("status", "automatico")
      .eq("etapa", "inicio")
      .lt("ultima_mensagem_em", limiteFallback)
      .limit(50);

    const fluxos = await carregarFluxos();
    const escolhido = dados.config.fallback_fluxo_id
      ? fluxos.fluxos.find((f) => f.id === dados.config.fallback_fluxo_id && f.ativo)
      : null;
    const raiz = escolhido ?? fluxoInicial(fluxos);

    if (raiz) {
      for (const linha of paradas ?? []) {
        const conversa = linha as unknown as ConversaBot;
        const ctx: ContextoBot = (conversa.contexto ?? {}) as ContextoBot;
        // Fluxo em andamento ou confirmação SIM/NÃO pendente seguem a inatividade normal.
        // Fluxo em andamento, confirmação pendente ou fallback já disparado
        // neste atendimento: não reinicia o fluxo inicial de novo.
        if (ctx.fluxo || ctx.triagem || ctx.regra || ctx.fluxoFallback) continue;

        const vars = { nome: conversa.nome_contato ?? "", telefone: conversa.telefone, agora };
        const saida = iniciarFluxo(fluxos, raiz.id, {}, vars, 0);
        await entregarFluxo(conversa, config, { ...ctx, triagem: null, fluxoFallback: true }, fluxos, saida, vars);
        await salvar(conversa, { saudacao_em: agora.toISOString(), inatividade_avisada: false });
        await auditar(conversa.id, "bot_fluxo_inicial", `${minFallback} min sem reconhecimento`);
      }
    }
  }

  // Fluxo de finalização com tempo de espera: dispara depois do prazo configurado.
  const minFinal = Math.max(0, Number(dados.config.finalizacao_delay_minutos ?? 0));
  const fluxoFinalId = dados.config.fluxo_finalizacao_id ?? null;
  if (minFinal > 0 && fluxoFinalId) {
    const limiteFinal = new Date(agora.getTime() - minFinal * 60_000).toISOString();
    const { data: aguardando } = await supabaseAdmin
      .from("whatsapp_conversas")
      .select(`${CAMPOS}, finalizacao_fluxo_em`)
      .eq("status", "aguardando_finalizacao")
      .not("finalizacao_fluxo_em", "is", null)
      .lt("finalizacao_fluxo_em", limiteFinal)
      .limit(50);

    const fluxos = await carregarFluxos();
    if (fluxoPorId(fluxos, fluxoFinalId)) {
      for (const linha of aguardando ?? []) {
        const conversa = linha as unknown as ConversaBot;
        await salvar(conversa, { finalizacao_fluxo_em: null });
        const ctx: ContextoBot = (conversa.contexto ?? {}) as ContextoBot;
        const vars = { nome: conversa.nome_contato ?? "", telefone: conversa.telefone, agora };
        const saida = iniciarFluxo(fluxos, fluxoFinalId, { respostas: ctx.fluxo?.respostas ?? {} }, vars);
        await entregarFluxo(conversa, config, { ...ctx, fluxoFallback: null }, fluxos, saida, vars);
        await auditar(conversa.id, "bot_fluxo_finalizacao", `${minFinal} min na aba Aguardando Finalização`);
      }
    }
  }


  const { data } = await supabaseAdmin
    .from("whatsapp_conversas")
    .select(CAMPOS)
    .eq("status", "automatico")
    .lt("ultima_mensagem_em", limite)
    .limit(50);

  let avisadas = 0;
  let finalizadas = 0;

  for (const linha of data ?? []) {
    const conversa = linha as unknown as ConversaBot;
    const vars = { nome: conversa.nome_contato ?? "", telefone: conversa.telefone, agora };
    const parado = agora.getTime() - new Date(linha.ultima_mensagem_em ?? agora).getTime();

    // 1ª inatividade: apenas o aviso.
    if (!linha.inatividade_avisada) {
      const aviso = (dados.config.msg_inatividade1 ?? "").trim();
      if (aviso) await responder(conversa, aplicarVariaveis(aviso, vars));
      await supabaseAdmin.from("whatsapp_conversas").update({ inatividade_avisada: true }).eq("id", conversa.id);
      avisadas += 1;
      continue;
    }

    // 2ª inatividade: só depois do tempo configurado.
    if (parado < min2 * 60_000) continue;

    const texto = msgDoStatus(dados.config, destino);
    if (texto) await responder(conversa, aplicarVariaveis(texto, vars));

    const encerrando = destino === "finalizado";
    await supabaseAdmin
      .from("whatsapp_conversas")
      .update({
        status: destino,
        etapa: encerrando ? "finalizado" : conversa.etapa,
        ...(encerrando
          ? {
              data_finalizacao: agora.toISOString(),
              finalizacao_em: agora.toISOString(),
              motivo_finalizacao: "inatividade do cliente",
              nao_lidas: 0,
            }
          : { motivo_pendencia: "inatividade do cliente" }),
      })
      .eq("id", conversa.id);

    await auditar(conversa.id, "bot_inatividade", `${min2} min sem resposta — status ${destino}`);
    finalizadas += 1;
  }

  return { avisadas, finalizadas };
}

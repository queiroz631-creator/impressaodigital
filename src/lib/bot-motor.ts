/**
 * Motor do atendimento automático: saudação, menu, palavras-chave e
 * respostas automáticas. Módulo puro (sem acesso ao banco nem à Z-API),
 * para poder rodar tanto no WhatsApp quanto no simulador da tela de
 * configuração.
 *
 * Nenhum valor financeiro é decidido aqui: o cálculo continua em
 * src/lib/calc.ts, acionado pelo fluxo de orçamento em bot.server.ts.
 */

import { chave, escolherOpcao, simOuNao } from "@/lib/bot-parse";

export type AcaoBot = "orcamento" | "consultar_pedido" | "curriculo" | "atendente" | "mensagem";

export interface BotHorario {
  dia_semana: number;
  fechado: boolean;
  abre: string;
  fecha: string;
}

export interface BotOpcao {
  id: string;
  nome: string;
  acao: string;
  mensagem: string;
  ordem: number;
  ativo: boolean;
  permitir_palavra_chave: boolean;
  palavras: string[];
}

export interface BotResposta {
  id: string;
  titulo: string;
  resposta: string;
  /** Texto usado quando o cliente já falou hoje (vazio = usa o principal). */
  resposta_retorno_dia: string;
  ordem: number;
  ativo: boolean;
  palavras: string[];
  acao_sim: string;
  destino_sim_fluxo_id: string | null;
  destino_sim_resposta_id: string | null;
  acao_nao: string;
  destino_nao_fluxo_id: string | null;
  destino_nao_resposta_id: string | null;
}

export interface BotConfig {
  bot_ativo: boolean;
  bot_24h: boolean;
  usar_ia: boolean;
  inatividade1_minutos: number;
  inatividade2_minutos: number;
  inatividade_status: string;
  msg_inatividade1: string;
  msg_inatividade_pendente: string;
  msg_inatividade_aguardando: string;
  msg_inatividade_em_atendimento: string;
  msg_inatividade_finalizado: string;
  permitir_orcamento_automatico: boolean;
  enviar_msg_finalizacao: boolean;
  finalizacao_uma_vez_dia: boolean;
  msg_fora_horario: string;
  msg_fora_horario_ativo: boolean;
  msg_transferencia: string;
  msg_transferencia_ativo: boolean;
  msg_finalizacao: string;
  msg_finalizacao_ativo: boolean;
}

export interface BotDados {
  config: BotConfig;
  horarios: BotHorario[];
  opcoes: BotOpcao[];
  respostas: BotResposta[];
}

export interface MensagemBot {
  texto: string;
  botoes?: string[];
}

/** Etapas controladas pelo motor (as demais pertencem ao fluxo de orçamento). */
export const ETAPAS_MENU = new Set([
  "inicio",
  "saudacao",
  "menu",
  "confirmar_intencao",
  "confirmar_arquivo",
  "pos_resposta",
]);

export interface EstadoBot {
  etapa: string;
  /** Opção/resposta aguardando confirmação por palavra-chave. */
  pendenteTipo?: "opcao" | "resposta" | null;
  pendenteId?: string | null;
}

export interface EntradaMotor {
  texto: string;
  tipo: string;
  nome: string;
  telefone: string;
  /** true quando é o primeiro contato do dia. */
  primeiraDoDia: boolean;
}

export interface SaidaMotor {
  mensagens: MensagemBot[];
  estado: EstadoBot;
  /** Ação a ser executada por quem chamou o motor. */
  acao?: AcaoBot;
  opcaoId?: string;
  /** Encaminhar para a fila humana. */
  transferir?: boolean;
}

export interface Interpretes {
  opcao?: (pergunta: string, resposta: string, opcoes: string[]) => Promise<number | null>;
  simNao?: (pergunta: string, resposta: string) => Promise<boolean | null>;
}

// ---------- utilidades ----------

export function saudacaoDoDia(agora: Date) {
  const h = Number(
    agora.toLocaleString("pt-BR", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }),
  );
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function partesLocais(agora: Date) {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(agora);
  const pega = (t: string) => fmt.find((p) => p.type === t)?.value ?? "";
  const dias: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sáb: 6, sab: 6 };
  const dia = dias[chave(pega("weekday")).replace(/\.$/, "")] ?? agora.getDay();
  return { dia, minutos: Number(pega("hour")) * 60 + Number(pega("minute")) };
}

function paraMinutos(hora: string) {
  const [h, m] = String(hora ?? "").split(":");
  return Number(h ?? 0) * 60 + Number(m ?? 0);
}

/** Verifica se o momento está dentro do horário de atendimento configurado. */
export function dentroDoHorario(dados: BotDados, agora: Date): boolean {
  if (dados.config.bot_24h) return true;
  const { dia, minutos } = partesLocais(agora);
  const h = dados.horarios.find((x) => x.dia_semana === dia);
  if (!h || h.fechado) return false;
  const abre = paraMinutos(h.abre);
  const fecha = paraMinutos(h.fecha);
  return minutos >= abre && minutos <= fecha;
}

/** Substitui as variáveis disponíveis nas mensagens configuráveis. */
export function aplicarVariaveis(texto: string, dados: { nome: string; telefone: string; agora: Date }) {
  return String(texto ?? "")
    .replace(/\{nome\}/g, dados.nome || "tudo bem")
    .replace(/\{telefone\}/g, dados.telefone || "")
    .replace(/\{saudacao\}/g, saudacaoDoDia(dados.agora));
}

// ---------- reconhecimento de palavras-chave ----------

function tokens(texto: string) {
  return chave(texto)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/** Pontuação de 0 a 1 entre a mensagem do cliente e uma palavra/frase. */
export function pontuar(mensagem: string, palavra: string): number {
  const m = chave(mensagem).replace(/[^\p{L}\p{N}\s]/gu, " ");
  const p = chave(palavra).replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
  if (!m || !p) return 0;
  if (m.includes(p)) return 1;

  const tp = tokens(p);
  const tm = new Set(tokens(m));
  if (tp.length === 0) return 0;

  const acertos = tp.filter((t) => tm.has(t) || [...tm].some((x) => x.startsWith(t) || t.startsWith(x))).length;
  return acertos / tp.length;
}

export function melhorPalavra(mensagem: string, palavras: string[]): number {
  return palavras.reduce((maior, p) => Math.max(maior, pontuar(mensagem, p)), 0);
}

const LIMITE = 0.75;

export function reconhecerResposta(dados: BotDados, texto: string): BotResposta | null {
  let melhor: { r: BotResposta; nota: number } | null = null;
  for (const r of dados.respostas.filter((x) => x.ativo)) {
    const nota = melhorPalavra(texto, [r.titulo, ...r.palavras]);
    if (nota >= LIMITE && (!melhor || nota > melhor.nota)) melhor = { r, nota };
  }
  return melhor?.r ?? null;
}

export function reconhecerOpcao(dados: BotDados, texto: string): BotOpcao | null {
  let melhor: { o: BotOpcao; nota: number } | null = null;
  for (const o of dados.opcoes.filter((x) => x.ativo && x.permitir_palavra_chave)) {
    const nota = melhorPalavra(texto, [o.nome, ...o.palavras]);
    if (nota >= LIMITE && (!melhor || nota > melhor.nota)) melhor = { o, nota };
  }
  return melhor?.o ?? null;
}

// ---------- textos ----------

export function opcoesAtivas(dados: BotDados) {
  return dados.opcoes.filter((o) => o.ativo).sort((a, b) => a.ordem - b.ordem);
}

const NUMEROS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];

export function textoMenu(dados: BotDados) {
  const lista = opcoesAtivas(dados)
    .map((o, i) => `${NUMEROS[i] ?? `${i + 1}.`} ${o.nome}`)
    .join("\n\n");
  return `${dados.config.msg_menu}\n\n${lista}`;
}

const SIM_NAO = ["SIM", "NÃO"];

function menu(dados: BotDados): MensagemBot {
  return { texto: textoMenu(dados) };
}

// ---------- motor ----------

async function decidirSimNao(
  texto: string,
  pergunta: string,
  dados: BotDados,
  ia: Interpretes,
): Promise<boolean | null> {
  const direto = simOuNao(texto);
  if (direto !== null) return direto;
  if (dados.config.usar_ia && ia.simNao) return ia.simNao(pergunta, texto);
  return null;
}

function acaoDaOpcao(opcao: BotOpcao): AcaoBot {
  const a = opcao.acao as AcaoBot;
  return (["orcamento", "consultar_pedido", "curriculo", "atendente", "mensagem"] as AcaoBot[]).includes(a)
    ? a
    : "mensagem";
}

function executar(dados: BotDados, opcao: BotOpcao, entrada: EntradaMotor, agora: Date): SaidaMotor {
  const acao = acaoDaOpcao(opcao);
  const mensagens: MensagemBot[] = [];
  const texto = aplicarVariaveis(opcao.mensagem, { nome: entrada.nome, telefone: entrada.telefone, agora });
  if (texto.trim()) mensagens.push({ texto });

  if (acao === "mensagem") {
    mensagens.push({ texto: "Posso ajudar em algo mais?", botoes: SIM_NAO });
    return { mensagens, estado: { etapa: "pos_resposta" }, acao, opcaoId: opcao.id };
  }

  return { mensagens, estado: { etapa: "menu" }, acao, opcaoId: opcao.id, transferir: acao === "atendente" };
}

/**
 * Processa uma mensagem do cliente nas etapas de menu.
 * Quem chama executa a ação devolvida (orçamento, pedido, currículo, humano).
 */
export async function processarMenu(
  dados: BotDados,
  estado: EstadoBot,
  entrada: EntradaMotor,
  ia: Interpretes = {},
  agora: Date = new Date(),
): Promise<SaidaMotor> {
  const vars = { nome: entrada.nome, telefone: entrada.telefone, agora };
  const texto = (entrada.texto ?? "").trim();
  const ehArquivo = entrada.tipo === "documento" || entrada.tipo === "imagem";

  // Primeiro contato do dia / retorno no mesmo dia.
  if (estado.etapa === "inicio") {
    const modelo = entrada.primeiraDoDia ? dados.config.msg_boas_vindas : dados.config.msg_retorno_dia;
    const mensagens: MensagemBot[] = [{ texto: aplicarVariaveis(modelo, vars), botoes: SIM_NAO }];

    if (ehArquivo) {
      mensagens.push({ texto: "Vi que você enviou um arquivo. É para fazer um orçamento?", botoes: SIM_NAO });
      return { mensagens, estado: { etapa: "confirmar_arquivo" } };
    }

    return { mensagens, estado: { etapa: "saudacao" } };
  }

  // Cliente enviou arquivo em qualquer etapa de menu.
  if (ehArquivo && estado.etapa !== "confirmar_arquivo") {
    return {
      mensagens: [{ texto: "Vi que você enviou um arquivo. É para fazer um orçamento?", botoes: SIM_NAO }],
      estado: { etapa: "confirmar_arquivo" },
    };
  }

  if (estado.etapa === "confirmar_arquivo") {
    const r = await decidirSimNao(texto, "É para fazer um orçamento?", dados, ia);
    if (r === true) {
      const opcao = opcoesAtivas(dados).find((o) => o.acao === "orcamento");
      if (opcao) return executar(dados, opcao, entrada, agora);
      return { mensagens: [menu(dados)], estado: { etapa: "menu" } };
    }
    if (r === false) return { mensagens: [menu(dados)], estado: { etapa: "menu" } };
    return { mensagens: [], estado: { etapa: "confirmar_arquivo" } };
  }

  if (estado.etapa === "saudacao" || estado.etapa === "pos_resposta") {
    const pergunta =
      estado.etapa === "saudacao" ? "Posso te mandar o menu de atendimento?" : "Posso ajudar em algo mais?";
    const r = await decidirSimNao(texto, pergunta, dados, ia);
    if (r === true) return { mensagens: [menu(dados)], estado: { etapa: "menu" } };
    if (r === false && estado.etapa === "pos_resposta") {
      return {
        mensagens: [{ texto: aplicarVariaveis(dados.config.msg_finalizacao, vars) }],
        estado: { etapa: "finalizado" },
      };
    }
    // Não respondeu sim/não: tenta identificar a intenção no próprio texto.
  }

  if (estado.etapa === "confirmar_intencao") {
    const r = await decidirSimNao(texto, "É isso que você procura?", dados, ia);
    if (r === true) {
      if (estado.pendenteTipo === "resposta") {
        const resposta = dados.respostas.find((x) => x.id === estado.pendenteId);
        if (resposta) {
          return {
            mensagens: [
              { texto: aplicarVariaveis(resposta.resposta, vars) },
              { texto: "Posso ajudar em algo mais?", botoes: SIM_NAO },
            ],
            estado: { etapa: "pos_resposta" },
          };
        }
      } else {
        const opcao = dados.opcoes.find((x) => x.id === estado.pendenteId);
        if (opcao) return executar(dados, opcao, entrada, agora);
      }
      return { mensagens: [menu(dados)], estado: { etapa: "menu" } };
    }
    if (r === false) {
      // Ignora e aguarda a próxima mensagem para tentar identificar de novo.
      return { mensagens: [], estado: { etapa: "menu" } };
    }
  }

  // Escolha direta pelo número ou nome da opção no menu.
  const ativas = opcoesAtivas(dados);
  if (estado.etapa === "menu" || estado.etapa === "saudacao" || estado.etapa === "pos_resposta") {
    const nomes = ativas.map((o) => o.nome);
    const indice = escolherOpcao(texto, nomes);
    if (indice !== null && ativas[indice]) return executar(dados, ativas[indice], entrada, agora);
  }

  // Prioridade: respostas automáticas → opções do menu.
  const resposta = reconhecerResposta(dados, texto);
  if (resposta) {
    return {
      mensagens: [
        { texto: aplicarVariaveis(resposta.resposta, vars) },
        { texto: "Posso ajudar em algo mais?", botoes: SIM_NAO },
      ],
      estado: { etapa: "pos_resposta" },
    };
  }

  const porPalavra = reconhecerOpcao(dados, texto);
  if (porPalavra) {
    return {
      mensagens: [{ texto: `Você gostaria de: *${porPalavra.nome}*?`, botoes: SIM_NAO }],
      estado: { etapa: "confirmar_intencao", pendenteTipo: "opcao", pendenteId: porPalavra.id },
    };
  }

  // IA como último recurso para identificar a intenção.
  if (dados.config.usar_ia && ia.opcao && texto) {
    const nomes = ativas.map((o) => o.nome);
    const i = await ia.opcao("O que o cliente deseja?", texto, nomes);
    if (i !== null && ativas[i]) {
      const escolhida = ativas[i];
      return {
        mensagens: [{ texto: `Você gostaria de: *${escolhida.nome}*?`, botoes: SIM_NAO }],
        estado: { etapa: "confirmar_intencao", pendenteTipo: "opcao", pendenteId: escolhida.id },
      };
    }
  }

  // Não identificou: ignora e aguarda a próxima mensagem do cliente.
  return { mensagens: [], estado: { etapa: estado.etapa === "inicio" ? "menu" : estado.etapa } };
}

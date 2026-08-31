/**
 * Motor dos Fluxos do Bot. Módulo puro: recebe os fluxos já carregados e o
 * estado da conversa e devolve as mensagens, o próximo estado e a ação de
 * sistema a ser executada por quem chamou (WhatsApp ou simulador).
 *
 * Nenhum cálculo financeiro acontece aqui: as ações de orçamento continuam
 * sendo executadas pelos módulos existentes (calculadora, currículo, pedidos).
 */

import { chave, escolherOpcao, primeiroNumero, simOuNao } from "@/lib/bot-parse";
import { aplicarVariaveis, type MensagemBot } from "@/lib/bot-motor";
import { ACOES_SISTEMA, type DadosFluxos, type FluxoEtapa, type FluxoOpcao } from "@/lib/bot-fluxos";

export interface EstadoFluxo {
  fluxoId: string;
  etapaId: string;
  /** true quando o bot está aguardando a resposta do cliente nesta etapa. */
  aguardando: boolean;
  respostas: Record<string, string>;
}

export interface EntradaFluxo {
  texto: string;
  tipo: string;
  nome: string;
  telefone: string;
}

export interface SaidaFluxo {
  mensagens: MensagemBot[];
  /** null quando o fluxo terminou. */
  estado: EstadoFluxo | null;
  /** Ação de sistema a executar (iniciar orçamento, consultar pedido, ...). */
  acao?: string;
  etapaAcao?: FluxoEtapa;
  transferir?: boolean;
  pendente?: boolean;
  finalizar?: boolean;
  /** true quando a mensagem não foi entendida na etapa atual. */
  naoEntendi?: boolean;
}

const LIMITE_ENCADEAMENTO = 12;

/**
 * Junta as mensagens de texto do mesmo turno em um único envio, preservando os
 * botões da última mensagem. Usado quando o fluxo está com "mensagem única".
 */
function unirMensagens(mensagens: MensagemBot[]): MensagemBot[] {
  // Mensagens com arquivo vão em envio próprio (com a legenda junto).
  if (mensagens.some((m) => m.midia)) return mensagens;
  const textos = mensagens.map((m) => (m.texto ?? "").trim()).filter(Boolean);
  if (textos.length <= 1) return mensagens;
  const botoes = [...mensagens].reverse().find((m) => (m.botoes ?? []).length > 0)?.botoes;
  const espera = mensagens.reduce((s, m) => s + (m.espera ?? 0), 0);
  return [{ texto: textos.join("\n\n"), ...(botoes ? { botoes } : {}), ...(espera ? { espera } : {}) }];
}

/** Aplica a mensagem única quando o fluxo de origem estiver configurado assim. */
function unirSaida(dados: DadosFluxos, saida: SaidaFluxo, fluxoId: string | null | undefined): SaidaFluxo {
  const fluxo = fluxoPorId(dados, fluxoId);
  if (!fluxo || fluxo.mensagem_unica === false) return saida;
  return { ...saida, mensagens: unirMensagens(saida.mensagens) };
}

export function fluxoInicial(dados: DadosFluxos) {
  return dados.fluxos.find((f) => f.inicial && f.ativo) ?? null;
}


export function fluxoPorId(dados: DadosFluxos, id: string | null | undefined) {
  return dados.fluxos.find((f) => f.id === id) ?? null;
}

export function etapasDoFluxo(dados: DadosFluxos, fluxoId: string) {
  return dados.etapas
    .filter((e) => e.fluxo_id === fluxoId && e.ativo)
    .sort((a, b) => a.ordem - b.ordem);
}

export function opcoesDaEtapa(dados: DadosFluxos, etapaId: string) {
  return dados.opcoes
    .filter((o) => o.etapa_id === etapaId && o.ativo)
    .sort((a, b) => a.ordem - b.ordem);
}

function proximaEtapa(dados: DadosFluxos, etapa: FluxoEtapa): FluxoEtapa | null {
  if (etapa.proxima_etapa_id) {
    const alvo = dados.etapas.find((e) => e.id === etapa.proxima_etapa_id && e.ativo);
    if (alvo) return alvo;
  }
  const lista = etapasDoFluxo(dados, etapa.fluxo_id);
  const i = lista.findIndex((e) => e.id === etapa.id);
  return i >= 0 ? (lista[i + 1] ?? null) : null;
}

const NUMEROS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];

function midiaDaEtapa(etapa: FluxoEtapa) {
  const tipo = etapa.tipo_mensagem ?? "texto";
  if (tipo === "texto" || !etapa.midia_url) return undefined;
  return { tipo, url: etapa.midia_url, nome: etapa.midia_nome ?? null };
}

function mensagemDaEtapa(
  dados: DadosFluxos,
  etapa: FluxoEtapa,
  vars: { nome: string; telefone: string; agora: Date },
): MensagemBot | null {
  const opcoes = opcoesDaEtapa(dados, etapa.id);
  const midia = midiaDaEtapa(etapa);
  const espera = etapa.modo_avanco === "automatico" ? Math.min(60, Math.max(0, etapa.espera_segundos ?? 0)) : 0;
  const extras = { ...(midia ? { midia } : {}), ...(espera ? { espera } : {}) };
  let texto = aplicarVariaveis(etapa.mensagem ?? "", vars).trim();

  if (opcoes.length > 0) {
    const lista = opcoes.map((o, i) => `${NUMEROS[i] ?? `${i + 1}.`} ${o.titulo}`).join("\n");
    texto = texto ? `${texto}\n\n${lista}` : lista;
    return { texto, botoes: opcoes.slice(0, 3).map((o) => o.titulo), ...extras };
  }

  if (etapa.tipo_resposta === "sim_nao" || etapa.tipo_resposta === "confirmacao") {
    return texto ? { texto, botoes: ["SIM", "NÃO"], ...extras } : null;
  }

  if (!texto && !midia) return null;
  return { texto, ...extras };
}

/** Espera resposta do cliente nesta etapa? */
function aguardaResposta(dados: DadosFluxos, etapa: FluxoEtapa) {
  const modo = etapa.modo_avanco;
  if (modo === "automatico") return false;
  if (modo === "opcao") return opcoesDaEtapa(dados, etapa.id).length > 0;
  if (modo === "resposta") return true;
  // Compatibilidade com etapas antigas, sem modo definido.
  if (opcoesDaEtapa(dados, etapa.id).length > 0) return true;
  if (etapa.acao === "aguardar_resposta") return true;
  return etapa.tipo_resposta !== "nenhuma";
}

/** Valida a resposta do cliente conforme o tipo esperado. Devolve o valor ou null. */
export function validarResposta(tipo: string, entrada: EntradaFluxo): string | null {
  const texto = (entrada.texto ?? "").trim();
  const ehArquivo = entrada.tipo === "documento" || entrada.tipo === "imagem";

  switch (tipo) {
    case "nenhuma":
      return texto;
    case "arquivo":
      return ehArquivo ? entrada.texto || "arquivo" : null;
    case "numero": {
      const n = primeiroNumero(texto);
      return n === null ? null : String(n);
    }
    case "cpf": {
      const digitos = texto.replace(/\D/g, "");
      return digitos.length === 11 ? digitos : null;
    }
    case "telefone": {
      const digitos = texto.replace(/\D/g, "");
      return digitos.length >= 10 ? digitos : null;
    }
    case "nome":
      return texto.length >= 2 ? texto : null;
    case "sim_nao":
    case "confirmacao": {
      const r = simOuNao(texto);
      return r === null ? null : r ? "sim" : "nao";
    }
    default:
      return texto ? texto : null;
  }
}

/** Executa a etapa: monta as mensagens e decide o próximo passo. */
function executar(
  dados: DadosFluxos,
  etapa: FluxoEtapa,
  estado: EstadoFluxo,
  vars: { nome: string; telefone: string; agora: Date },
  profundidade = 0,
  primeiraDoDia = true,
): SaidaFluxo {
  const mensagens: MensagemBot[] = [];
  const msg = mensagemDaEtapa(dados, etapa, vars, primeiraDoDia);
  if (msg) mensagens.push(msg);

  const base: EstadoFluxo = { ...estado, fluxoId: etapa.fluxo_id, etapaId: etapa.id, aguardando: false };

  if (aguardaResposta(dados, etapa) && !ACOES_SISTEMA.has(etapa.acao)) {
    return { mensagens, estado: { ...base, aguardando: true } };
  }

  const saida = aplicarAcaoEtapa(dados, etapa, base, vars, profundidade);
  return { ...saida, mensagens: [...mensagens, ...saida.mensagens] };
}

/** Aplica a ação configurada na etapa (depois de já ter respondido o cliente). */
function aplicarAcaoEtapa(
  dados: DadosFluxos,
  etapa: FluxoEtapa,
  estado: EstadoFluxo,
  vars: { nome: string; telefone: string; agora: Date },
  profundidade = 0,
): SaidaFluxo {
  const seguir = () => avancar(dados, etapa, estado, vars, profundidade);

  switch (etapa.acao) {
    case "transferir_atendente":
      return { mensagens: [], estado: null, transferir: true, acao: etapa.acao, etapaAcao: etapa };
    case "criar_pendente":
      return { mensagens: [], estado: null, pendente: true, acao: etapa.acao, etapaAcao: etapa };
    case "finalizar":
      return { mensagens: [], estado: null, finalizar: true };
    case "voltar_inicio_fluxo": {
      const primeira = etapasDoFluxo(dados, etapa.fluxo_id)[0];
      if (!primeira || profundidade >= LIMITE_ENCADEAMENTO) return { mensagens: [], estado: null };
      return executar(dados, primeira, estado, vars, profundidade + 1);
    }
    case "iniciar_fluxo": {
      const destino = fluxoPorId(dados, etapa.destino_fluxo_id);
      if (!destino?.ativo || profundidade >= LIMITE_ENCADEAMENTO) return seguir();
      return iniciar(dados, destino.id, estado, vars, profundidade + 1);
    }
    default:
      break;
  }

  if (ACOES_SISTEMA.has(etapa.acao)) {
    // Quem chamou executa a ação nos módulos existentes.
    return { mensagens: [], estado, acao: etapa.acao, etapaAcao: etapa };
  }

  return seguir();
}

/** Avança para a etapa seguinte (usado também após uma ação de sistema). */
export function avancar(
  dados: DadosFluxos,
  etapa: FluxoEtapa,
  estado: EstadoFluxo,
  vars: { nome: string; telefone: string; agora: Date },
  profundidade = 0,
): SaidaFluxo {
  const proxima = proximaEtapa(dados, etapa);
  if (!proxima || profundidade >= LIMITE_ENCADEAMENTO) return { mensagens: [], estado: null };
  return unirSaida(dados, executar(dados, proxima, estado, vars, profundidade + 1), proxima.fluxo_id);
}


/**
 * Inicia um fluxo pelo id. O texto de abertura é o da primeira etapa (a
 * mensagem inicial do fluxo deixou de existir como campo separado).
 */
export function iniciar(
  dados: DadosFluxos,
  fluxoId: string,
  estado: Partial<EstadoFluxo>,
  vars: { nome: string; telefone: string; agora: Date },
  profundidade = 0,
  primeiraDoDia = true,
): SaidaFluxo {
  const fluxo = fluxoPorId(dados, fluxoId);
  if (!fluxo) return { mensagens: [], estado: null };

  const primeira = etapasDoFluxo(dados, fluxo.id)[0];
  const respostas = estado.respostas ?? {};
  if (!primeira) return { mensagens: [], estado: null };

  const saida = executar(
    dados,
    primeira,
    { fluxoId: fluxo.id, etapaId: primeira.id, aguardando: false, respostas },
    vars,
    profundidade + 1,
    primeiraDoDia,
  );
  return unirSaida(dados, saida, fluxo.id);
}


/** Fluxo marcado para receber os clientes que enviam apenas arquivos. */
export function fluxoDeArquivos(dados: DadosFluxos) {
  return dados.fluxos.find((f) => f.fluxo_arquivos && f.ativo) ?? null;
}

/** Processa a resposta do cliente na etapa em que a conversa parou. */
export function processarFluxo(
  dados: DadosFluxos,
  estado: EstadoFluxo,
  entrada: EntradaFluxo,
  agora: Date = new Date(),
): SaidaFluxo {
  const vars = { nome: entrada.nome, telefone: entrada.telefone, agora };
  const etapa = dados.etapas.find((e) => e.id === estado.etapaId);
  if (!etapa) {
    const inicialFluxo = fluxoInicial(dados);
    return inicialFluxo ? iniciar(dados, inicialFluxo.id, estado, vars) : { mensagens: [], estado: null };
  }

  const opcoes = opcoesDaEtapa(dados, etapa.id);

  if (opcoes.length > 0) {
    const escolha = escolherOpcaoDaEtapa(entrada.texto, opcoes);
    if (!escolha) return { mensagens: [], estado, naoEntendi: true };
    return unirSaida(dados, aplicarOpcao(dados, etapa, escolha, estado, vars), etapa.fluxo_id);
  }

  const valor = validarResposta(etapa.tipo_resposta, entrada);
  if (valor === null) return { mensagens: [], estado, naoEntendi: true };

  const respostas = { ...estado.respostas, [etapa.nome]: valor };
  return unirSaida(
    dados,
    aplicarAcaoEtapa(dados, etapa, { ...estado, respostas, aguardando: false }, vars),
    etapa.fluxo_id,
  );
}


function escolherOpcaoDaEtapa(texto: string, opcoes: FluxoOpcao[]): FluxoOpcao | null {
  const alvo = chave(texto);
  if (!alvo) return null;
  const direto = opcoes.find((o) => chave(o.valor) === alvo || chave(o.titulo) === alvo);
  if (direto) return direto;
  const i = escolherOpcao(texto, opcoes.map((o) => o.titulo));
  return i === null ? null : (opcoes[i] ?? null);
}

function aplicarOpcao(
  dados: DadosFluxos,
  etapa: FluxoEtapa,
  opcao: FluxoOpcao,
  estado: EstadoFluxo,
  vars: { nome: string; telefone: string; agora: Date },
): SaidaFluxo {
  const respostas = { ...estado.respostas, [etapa.nome]: opcao.valor || opcao.titulo };
  const novo: EstadoFluxo = { ...estado, respostas, aguardando: false };

  switch (opcao.acao) {
    case "transferir_atendente":
      return { mensagens: [], estado: null, transferir: true, acao: "transferir_atendente", etapaAcao: etapa };
    case "finalizar":
      return { mensagens: [], estado: null, finalizar: true };
    case "iniciar_fluxo": {
      const destino = fluxoPorId(dados, opcao.destino_fluxo_id);
      if (!destino?.ativo) return avancar(dados, etapa, novo, vars);
      return iniciar(dados, destino.id, novo, vars);
    }
    case "ir_para_etapa": {
      const alvo = dados.etapas.find((e) => e.id === opcao.destino_etapa_id && e.ativo);
      if (!alvo) return avancar(dados, etapa, novo, vars);
      return executar(dados, alvo, novo, vars, 1);
    }
    case "voltar_inicio_fluxo": {
      const primeira = etapasDoFluxo(dados, etapa.fluxo_id)[0];
      if (!primeira) return { mensagens: [], estado: null };
      return executar(dados, primeira, novo, vars, 1);
    }
    default:
      return avancar(dados, etapa, novo, vars);
  }
}

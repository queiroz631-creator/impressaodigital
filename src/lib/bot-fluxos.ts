/**
 * Tipos e catálogos dos Fluxos do Bot. Módulo puro (usado pela tela de
 * configuração e pelo motor de fluxos).
 */

export interface Fluxo {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  mensagem_inicial: string;
  ativo: boolean;
  ordem: number;
  /** Envia o texto do fluxo, da etapa e as opções em uma única mensagem. */
  mensagem_unica: boolean;
}


export interface FluxoEtapa {
  id: string;
  fluxo_id: string;
  nome: string;
  ordem: number;
  mensagem: string;
  tipo_resposta: string;
  acao: string;
  configuracao: Record<string, unknown>;
  proxima_etapa_id: string | null;
  destino_fluxo_id: string | null;
  ativo: boolean;
  /** texto | imagem | audio | video | documento */
  tipo_mensagem: string;
  /** Caminho no armazenamento (bucket bot-midia) ou URL completa. */
  midia_url: string | null;
  midia_nome: string | null;
  /** automatico | resposta | opcao */
  modo_avanco: string;
  /** Espera antes de seguir para a próxima etapa (modo automático). */
  espera_segundos: number;
}

/** Tipos de mensagem que uma etapa pode enviar. */
export const TIPOS_MENSAGEM: { valor: string; rotulo: string; aceita: string }[] = [
  { valor: "texto", rotulo: "Texto", aceita: "" },
  { valor: "imagem", rotulo: "Imagem", aceita: "image/*" },
  { valor: "audio", rotulo: "Áudio", aceita: "audio/*" },
  { valor: "video", rotulo: "Vídeo", aceita: "video/*" },
  { valor: "documento", rotulo: "Documento", aceita: ".pdf,.doc,.docx,.xls,.xlsx,.txt" },
];

/** Como a conversa avança depois desta etapa. */
export const MODOS_AVANCO: { valor: string; rotulo: string }[] = [
  { valor: "automatico", rotulo: "Automaticamente (com tempo de espera)" },
  { valor: "resposta", rotulo: "Após qualquer resposta do cliente" },
  { valor: "opcao", rotulo: "Após o cliente escolher uma opção" },
];

export function rotuloTipoMensagem(valor: string) {
  return TIPOS_MENSAGEM.find((t) => t.valor === valor)?.rotulo ?? "Texto";
}

export function rotuloModoAvanco(valor: string) {
  return MODOS_AVANCO.find((m) => m.valor === valor)?.rotulo ?? valor;
}

export interface FluxoOpcao {
  id: string;
  etapa_id: string;
  titulo: string;
  valor: string;
  ordem: number;
  acao: string;
  destino_fluxo_id: string | null;
  destino_etapa_id: string | null;
  configuracao: Record<string, unknown>;
  ativo: boolean;
}

export interface DadosFluxos {
  fluxos: Fluxo[];
  etapas: FluxoEtapa[];
  opcoes: FluxoOpcao[];
}

/** Tipos de resposta esperados do cliente em uma etapa. */
export const TIPOS_RESPOSTA: { valor: string; rotulo: string }[] = [
  { valor: "nenhuma", rotulo: "Nenhuma" },
  { valor: "texto", rotulo: "Texto" },
  { valor: "numero", rotulo: "Número" },
  { valor: "arquivo", rotulo: "Arquivo" },
  { valor: "cpf", rotulo: "CPF" },
  { valor: "nome", rotulo: "Nome" },
  { valor: "telefone", rotulo: "Telefone" },
  { valor: "sim_nao", rotulo: "Sim/Não" },
  { valor: "escolha", rotulo: "Escolha de opção" },
  { valor: "confirmacao", rotulo: "Confirmação" },
];

/** Ações que uma etapa pode executar. */
export const ACOES_ETAPA: { valor: string; rotulo: string }[] = [
  { valor: "enviar_mensagem", rotulo: "Enviar mensagem" },
  { valor: "aguardar_resposta", rotulo: "Aguardar resposta" },
  { valor: "salvar_informacao", rotulo: "Salvar informação" },
  { valor: "receber_arquivo", rotulo: "Receber arquivo" },
  { valor: "analisar_arquivos", rotulo: "Analisar arquivos" },
  { valor: "contar_paginas", rotulo: "Contar páginas" },
  { valor: "iniciar_orcamento", rotulo: "Iniciar orçamento" },
  { valor: "consultar_pedido", rotulo: "Consultar pedido" },
  { valor: "iniciar_curriculo", rotulo: "Iniciar currículo" },
  { valor: "gerar_link", rotulo: "Gerar link" },
  { valor: "enviar_orcamento", rotulo: "Enviar orçamento" },
  { valor: "transferir_atendente", rotulo: "Transferir para atendente" },
  { valor: "transferir_silencioso", rotulo: "Transferir para atendente (sem mensagem)" },
  { valor: "criar_pendente", rotulo: "Criar atendimento pendente" },
  { valor: "iniciar_fluxo", rotulo: "Iniciar outro fluxo" },
  { valor: "voltar_inicio_fluxo", rotulo: "Voltar ao início do fluxo" },
  { valor: "finalizar", rotulo: "Finalizar atendimento" },
  { valor: "finalizar_silencioso", rotulo: "Finalizar atendimento (sem mensagem)" },
];

/** Ações possíveis em uma opção de etapa. */
export const ACOES_OPCAO: { valor: string; rotulo: string }[] = [
  { valor: "proxima_etapa", rotulo: "Ir para a próxima etapa" },
  { valor: "ir_para_etapa", rotulo: "Ir para uma etapa específica" },
  { valor: "iniciar_fluxo", rotulo: "Iniciar outro fluxo" },
  { valor: "transferir_atendente", rotulo: "Transferir para atendente" },
  { valor: "transferir_silencioso", rotulo: "Transferir para atendente (sem mensagem)" },
  { valor: "voltar_inicio_fluxo", rotulo: "Voltar ao início do fluxo" },
  { valor: "finalizar", rotulo: "Finalizar atendimento" },
  { valor: "finalizar_silencioso", rotulo: "Finalizar atendimento (sem mensagem)" },
];

/** Ações possíveis após o cliente responder SIM ou NÃO a uma resposta automática. */
export const ACOES_RESPOSTA: { valor: string; rotulo: string }[] = [
  { valor: "aguardar", rotulo: "Aguardar a próxima mensagem" },
  { valor: "iniciar_fluxo", rotulo: "Iniciar um fluxo" },
  { valor: "resposta", rotulo: "Enviar outra resposta automática" },
  { valor: "atendente", rotulo: "Transferir para atendente" },
  { valor: "finalizar", rotulo: "Finalizar atendimento" },
  { valor: "finalizar_silencioso", rotulo: "Finalizar atendimento (sem mensagem)" },
];

export function rotuloAcaoResposta(valor: string) {
  return ACOES_RESPOSTA.find((a) => a.valor === valor)?.rotulo ?? valor;
}

/** Condições de identificação da primeira mensagem do cliente. */
export const CONDICOES_PRIMEIRO_CONTATO: { valor: string; rotulo: string; usaPalavras: boolean }[] = [
  { valor: "saudacao", rotulo: "Só uma saudação (oi, olá, bom dia...)", usaPalavras: false },
  { valor: "arquivo", rotulo: "Só arquivos (sem texto)", usaPalavras: false },
  { valor: "arquivo_palavra", rotulo: "Arquivos + palavras-chave", usaPalavras: true },
  { valor: "texto_palavra", rotulo: "Texto com palavras-chave", usaPalavras: true },
  { valor: "qualquer", rotulo: "Qualquer mensagem", usaPalavras: false },
];

/** Ações possíveis em uma regra de primeiro contato. */
export const ACOES_PRIMEIRO_CONTATO: { valor: string; rotulo: string }[] = [
  { valor: "aguardar", rotulo: "Só enviar a mensagem e aguardar" },
  { valor: "confirmar_fluxo", rotulo: "Perguntar SIM/NÃO e iniciar um fluxo" },
  { valor: "iniciar_fluxo", rotulo: "Iniciar um fluxo" },
  
  { valor: "resposta", rotulo: "Enviar uma resposta automática" },
  { valor: "atendente", rotulo: "Transferir para atendente" },
  { valor: "finalizar", rotulo: "Finalizar atendimento" },
];

export function rotuloCondicao(valor: string) {
  return CONDICOES_PRIMEIRO_CONTATO.find((c) => c.valor === valor)?.rotulo ?? valor;
}

export function rotuloAcaoPrimeiroContato(valor: string) {
  return ACOES_PRIMEIRO_CONTATO.find((a) => a.valor === valor)?.rotulo ?? valor;
}

/** Quando a mensagem da regra de primeiro contato é enviada. */
export const ENVIOS_PRIMEIRO_CONTATO: { valor: string; rotulo: string }[] = [
  { valor: "sempre", rotulo: "Sempre que a regra combinar" },
  { valor: "uma_vez_atendimento", rotulo: "Uma vez por atendimento" },
  { valor: "primeira_do_dia", rotulo: "Somente no 1º contato do dia" },
];



/** Ações da etapa que são executadas por módulos do sistema. */
export const ACOES_SISTEMA = new Set([
  "iniciar_orcamento",
  "analisar_arquivos",
  "contar_paginas",
  "receber_arquivo",
  "consultar_pedido",
  "iniciar_curriculo",
  "gerar_link",
  "enviar_orcamento",
  "transferir_atendente",
  "transferir_silencioso",
  "criar_pendente",
]);

export const ICONES: { valor: string; rotulo: string; emoji: string }[] = [
  { valor: "bot", rotulo: "Bot", emoji: "🤖" },
  { valor: "arquivo", rotulo: "Arquivo", emoji: "📄" },
  { valor: "pedido", rotulo: "Pedido", emoji: "📦" },
  { valor: "pessoa", rotulo: "Pessoa", emoji: "👤" },
  { valor: "atendente", rotulo: "Atendente", emoji: "🙋" },
  { valor: "mensagem", rotulo: "Mensagem", emoji: "💬" },
  { valor: "loja", rotulo: "Loja", emoji: "🏪" },
];

export function emojiIcone(icone: string) {
  return ICONES.find((i) => i.valor === icone)?.emoji ?? "🤖";
}

export function rotuloTipoResposta(valor: string) {
  return TIPOS_RESPOSTA.find((t) => t.valor === valor)?.rotulo ?? valor;
}

export function rotuloAcaoEtapa(valor: string) {
  return ACOES_ETAPA.find((a) => a.valor === valor)?.rotulo ?? valor;
}

export function rotuloAcaoOpcao(valor: string) {
  return ACOES_OPCAO.find((a) => a.valor === valor)?.rotulo ?? valor;
}

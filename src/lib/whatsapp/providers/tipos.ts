/**
 * Contrato dos provedores de WhatsApp (Z-API, Evolution API, ...).
 *
 * Tipos puros (sem I/O). Cada provedor declara suas CAPACIDADES e implementa
 * as operações; o que não for suportado devolve um erro padronizado
 * (`nao_suportado`) — nunca simula sucesso.
 */

export type ProvedorId = "zapi" | "evolution";

export type TipoMidia = "imagem" | "audio" | "video" | "documento";

export interface CapacidadesProvedor {
  enviarTexto: boolean;
  enviarImagem: boolean;
  enviarDocumento: boolean;
  enviarAudio: boolean;
  enviarVideo: boolean;
  presenca: boolean;
  apagarMensagem: boolean;
  editarMensagem: boolean;
  publicarStatus: boolean;
  consultarStatus: boolean;
  obterQrCode: boolean;
  criarInstancia: boolean;
  desconectar: boolean;
  configurarWebhook: boolean;
  baixarMidia: boolean;
}

export const SEM_CAPACIDADES: CapacidadesProvedor = {
  enviarTexto: false,
  enviarImagem: false,
  enviarDocumento: false,
  enviarAudio: false,
  enviarVideo: false,
  presenca: false,
  apagarMensagem: false,
  editarMensagem: false,
  publicarStatus: false,
  consultarStatus: false,
  obterQrCode: false,
  criarInstancia: false,
  desconectar: false,
  configurarWebhook: false,
  baixarMidia: false,
};

export type CodigoErroProvedor =
  | "nao_suportado"
  | "nao_configurado"
  | "nao_autenticado"
  | "nao_encontrado"
  | "invalido"
  | "rate_limit"
  | "timeout"
  | "rede"
  | "servidor"
  | "desconhecido";

export interface ErroProvedor {
  codigo: CodigoErroProvedor;
  /** Mensagem para o usuário/registro (nunca contém credenciais). */
  mensagem: string;
  httpStatus: number | null;
  /** Falhas transitórias que podem ser repetidas com backoff. */
  retentavel: boolean;
}

export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: ErroProvedor };

/** A conexão (número/instância) em nome da qual a operação é executada. */
export interface ContextoConexao {
  conexaoId: string | null;
  /**
   * Servidor do provedor, para operações que ainda não têm conexão (ex.: criar
   * instância). Quando há `conexaoId`, o servidor vem da própria conexão.
   */
  servidorId?: string | null;
}

/** Dados da conexão que o webhook já identificou (entrada da normalização/autenticação). */
export interface ContextoWebhook {
  conexaoId: string;
  webhookToken?: string;
  /**
   * Instância esperada pela conexão (`id_externo`). Provedores que marcam o
   * payload com o nome da instância (ex.: Evolution) têm a autenticidade
   * conferida contra ela: evento de outra instância é recusado.
   */
  instanciaEsperada?: string | null;
}

export interface EnvioTexto {
  telefone: string;
  texto: string;
}

export interface EnvioMidia {
  telefone: string;
  tipo: TipoMidia;
  /** URL pública/assinada ou data URL (base64). */
  url: string;
  legenda?: string;
  nomeArquivo?: string | null;
}

export interface ResultadoEnvio {
  /** Identificador da mensagem no provedor (pode vir nulo mesmo com sucesso HTTP). */
  mensagemId: string | null;
}

export interface ApagarMensagem {
  telefone: string;
  mensagemId: string;
}

export interface EditarMensagem {
  telefone: string;
  mensagemId: string;
  texto: string;
}

export interface MidiaBaixada {
  bytes: Uint8Array;
  mime: string | null;
  nome: string | null;
}

export interface StatusConexao {
  conectado: boolean;
  detalhe: string;
}

export interface QrCodeConexao {
  /** Imagem em base64 (sem prefixo) quando o provedor a fornece. */
  qrCodeBase64: string | null;
  codigoPareamento: string | null;
  estado: string | null;
}

export interface PublicarStatusEntrada {
  tipo: "texto" | "imagem";
  texto?: string;
  corFundo?: string;
  imagemUrl?: string;
  legenda?: string;
}

export interface ConfigurarWebhookEntrada {
  url: string;
  /** Segredo/cabeçalho que o provedor deve devolver para autenticar o webhook. */
  segredo?: string;
}

export interface ResultadoWebhook {
  configurados: string[];
  falhas: string[];
}

// ---------------------------------------------------------------------------
// Modelo interno de eventos (saída da normalização de webhooks)
// ---------------------------------------------------------------------------

export type TipoConteudoMensagem =
  | "texto"
  | "imagem"
  | "documento"
  | "audio"
  | "localizacao"
  | "botao"
  | "desconhecido";

export interface ConteudoNormalizado {
  tipo: TipoConteudoMensagem;
  texto: string;
  url: string | null;
  nome: string | null;
  mime: string | null;
  /** Páginas informadas pelo provedor (documentos), quando houver. */
  paginas: number | null;
  /**
   * Mídia que o provedor NÃO entrega por URL direta (ex.: Evolution): o arquivo é
   * baixado depois, pela conexão, usando este identificador.
   */
  midia?: { idMensagem: string } | null;
}

/** Mensagem recebida do cliente ou enviada pelo próprio número fora do sistema. */
export interface EventoMensagem {
  tipo: "mensagem_recebida" | "mensagem_enviada_fora";
  /** Identificador da mensagem no provedor (já prefixado quando o provedor exigir). */
  idExterno: string | null;
  /** Telefone normalizado; vazio quando só há o identificador interno do chat (LID). */
  telefone: string;
  /** Identificador interno do chat (somente dígitos), quando existir. */
  lid: string | null;
  nomeContato: string | null;
  conteudo: ConteudoNormalizado;
  /** Edição de mensagem já recebida (o pipeline atualiza o histórico antes de seguir). */
  edicao: { idAlvo: string; novoTexto: string } | null;
  /** Payload original, guardado no histórico da mensagem. */
  bruto: unknown;
}

export interface EventoRevogacao {
  tipo: "mensagem_revogada";
  idExterno: string | null;
  idAlvo: string | null;
}

/** Aviso de entrega/leitura de mensagem já enviada (atualiza os tiques). */
export interface EventoStatusMensagem {
  tipo: "status_mensagem";
  /** Identificadores das mensagens no provedor afetadas pelo aviso. */
  ids: string[];
  /** Novo status: "entregue" ou "lida" (nunca rebaixa o que já está registrado). */
  status: "entregue" | "lida";
  /** Momento informado pelo provedor (ISO 8601). */
  quando: string;
}

/** Callback que não é mensagem de cliente (entrega, presença, grupo, etc.). */
export interface EventoIgnorado {
  tipo: "ignorado";
  /** Motivo devolvido ao provedor (null = sem motivo, como o webhook atual). */
  motivo: string | null;
  /** Mudança de estado da conexão carregada por este callback, se houver. */
  statusConexao?: "conectado" | "desconectado";
  idExterno?: string | null;
  /** Edição que o pipeline ainda deve tentar aplicar antes de responder "ignorado". */
  edicao?: { idAlvo: string; novoTexto: string } | null;
}

export type EventoNormalizado = EventoMensagem | EventoRevogacao | EventoStatusMensagem | EventoIgnorado;

export interface ProvedorWhatsApp {
  readonly id: ProvedorId;
  readonly capacidades: CapacidadesProvedor;

  /**
   * Converte o corpo bruto de um webhook do provedor no modelo interno.
   * Função PURA (sem I/O): não acessa banco nem rede.
   */
  normalizarWebhook(bruto: unknown, ctx: ContextoWebhook): EventoNormalizado;

  /**
   * Autenticação ADICIONAL do webhook (além do token no endereço), por
   * cabeçalho secreto. Ausente = o provedor só usa o token do endereço.
   */
  autenticarWebhook?(headers: Headers, ctx: ContextoWebhook): boolean;

  enviarTexto(ctx: ContextoConexao, entrada: EnvioTexto): Promise<Resultado<ResultadoEnvio>>;
  enviarMidia(ctx: ContextoConexao, entrada: EnvioMidia): Promise<Resultado<ResultadoEnvio>>;
  enviarPresenca(ctx: ContextoConexao, telefone: string, duracaoMs: number): Promise<Resultado<null>>;
  apagarMensagem(ctx: ContextoConexao, entrada: ApagarMensagem): Promise<Resultado<null>>;
  editarMensagem(ctx: ContextoConexao, entrada: EditarMensagem): Promise<Resultado<null>>;
  baixarMidia(ctx: ContextoConexao, entrada: { idMensagem: string }): Promise<Resultado<MidiaBaixada>>;
  publicarStatus(ctx: ContextoConexao, entrada: PublicarStatusEntrada): Promise<Resultado<null>>;
  consultarStatus(ctx: ContextoConexao): Promise<Resultado<StatusConexao>>;
  obterQrCode(ctx: ContextoConexao): Promise<Resultado<QrCodeConexao>>;
  criarInstancia(ctx: ContextoConexao, nome: string): Promise<Resultado<{ idExterno: string }>>;
  desconectar(ctx: ContextoConexao): Promise<Resultado<null>>;
  configurarWebhook(ctx: ContextoConexao, entrada: ConfigurarWebhookEntrada): Promise<Resultado<ResultadoWebhook>>;
}

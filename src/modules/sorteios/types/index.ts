/**
 * Tipos do módulo Sorteios (Etapa 1 — fundação).
 *
 * O cadastro do participante é sempre `public.clientes` (cadastro mestre).
 * Nenhum tipo aqui repete CPF, nome, telefone ou data de nascimento:
 * a participação apenas referencia `clientes.id`.
 */

export type StatusSorteio = "RASCUNHO" | "ATIVO" | "ENCERRADO" | "CANCELADO" | "SORTEADO";
export type StatusNota = "PENDENTE" | "VALIDA" | "INVALIDA" | "CANCELADA";
export type StatusCupom = "ATIVO" | "CANCELADO" | "UTILIZADO";
export type StatusSincronizacaoParticipante = "PENDENTE" | "SINCRONIZADO" | "ERRO";
export type TipoSincronizacao =
  | "CLIENTES"
  | "NOTAS"
  | "NOTAS_LOJA_SUPABASE"
  | "CLIENTES_LOJA_SUPABASE"
  | "CLIENTES_SUPABASE_LOJA"
  | "RECONCILIACAO";
export type DirecaoSincronizacao = "SUPABASE_PARA_LOCAL" | "LOCAL_PARA_SUPABASE";
export type StatusSincronizacao = "EXECUTANDO" | "CONCLUIDA" | "ERRO" | "PARCIAL";
/** Estados da fila de itens de sincronização (Etapa 5). */
export type StatusFilaSincronizacao = "PENDENTE" | "PROCESSANDO" | "SINCRONIZADO" | "ERRO";
export type OrigemDestinoSincronizacao = "LOJA" | "SUPABASE";

export const STATUS_SORTEIO: StatusSorteio[] = [
  "RASCUNHO",
  "ATIVO",
  "ENCERRADO",
  "CANCELADO",
  "SORTEADO",
];

export const ROTULO_STATUS_SORTEIO: Record<StatusSorteio, string> = {
  RASCUNHO: "Rascunho",
  ATIVO: "Ativo",
  ENCERRADO: "Encerrado",
  CANCELADO: "Cancelado",
  SORTEADO: "Sorteado",
};

export const ROTULO_STATUS_NOTA: Record<StatusNota, string> = {
  PENDENTE: "Pendente",
  VALIDA: "Válida",
  INVALIDA: "Inválida",
  CANCELADA: "Cancelada",
};

export const ROTULO_STATUS_CUPOM: Record<StatusCupom, string> = {
  ATIVO: "Ativo",
  CANCELADO: "Cancelado",
  UTILIZADO: "Utilizado",
};

export interface Sorteio {
  id: string;
  nome: string;
  descricao: string;
  numero_sorteio: number;
  status: StatusSorteio;
  data_inicio: string | null;
  data_fim: string | null;
  data_sorteio: string | null;
  valor_por_cupom_centavos: number;
  quantidade_maxima_cupons: number | null;
  /** Última sincronização da base de notas deste sorteio (validação). */
  base_sincronizada_em?: string | null;
  /** Fechamento do sorteio (etapa de encerramento). */
  encerrado_em?: string | null;
  encerrado_por?: string | null;
  /** Retrato da conferência que autorizou o encerramento. */
  conferencia_encerramento?: ConferenciaSorteio | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

/* ----------------------------------------------- conferência de encerramento */

export interface TotaisConferencia {
  participantes: number;
  participantes_concorrentes: number;
  notas_validas: number;
  notas_canceladas: number;
  notas_pendentes: number;
  notas_invalidas: number;
  valor_notas_validas_centavos: number;
  cupons_ativos: number;
  cupons_cancelados: number;
  cupons_utilizados: number;
  saldo_acumulado_centavos: number;
  fontes_pendentes: number;
  fontes_pendentes_centavos: number;
  contribuicoes: number;
  contribuicoes_centavos: number;
}

export type DetalheConferencia = Record<string, string | number | boolean | null>;

export interface ItemConferencia {
  codigo: string;
  mensagem: string;
  quantidade: number;
  itens: DetalheConferencia[];
}

export interface ConferenciaSorteio {
  resultado: "OK" | "IGNORADA";
  motivo?: string;
  conferido_em?: string;
  sorteio?: {
    id: string;
    nome: string;
    numero_sorteio: number;
    status: StatusSorteio;
    data_inicio: string | null;
    data_fim: string | null;
    valor_por_cupom_centavos: number;
    quantidade_maxima_cupons: number | null;
  };
  totais?: TotaisConferencia;
  pendencias?: ItemConferencia[];
  inconsistencias?: ItemConferencia[];
  aprovada: boolean;
  pode_encerrar?: boolean;
}


export interface SorteioTermos {
  id: string;
  sorteio_id: string;
  versao: number;
  /** Título da versão (opcional). */
  titulo: string;
  /** Versão vigente: no máximo uma por sorteio (índice único parcial). */
  atual: boolean;
  regras: string;
  informacoes: string;
  premios: string;
  como_participar: string;
  validade: string;
  como_sera_realizado: string;
  outras_condicoes: string;
  publicado_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface SorteioParticipante {
  id: string;
  sorteio_id: string;
  /** Referência ao cadastro mestre `public.clientes`. */
  cliente_id: string;
  saldo_centavos: number;
  sincronizacao_status: StatusSincronizacaoParticipante;
  sincronizado_em: string | null;
  aceite_termos_em: string | null;
  aceite_termos_versao: number | null;
  /** Elegibilidade nesta participação: false = fora deste sorteio. */
  concorre_sorteio: boolean;
  criado_em: string;

  atualizado_em: string;
}

export interface SorteioNotaBase {
  id: string;
  /** Sorteio a que a nota da base pertence: a validação nunca cruza sorteios. */
  sorteio_id: string;
  numero: string;
  valor_centavos: number;
  /** Só sincronização/auditoria — nunca usada para validar a nota do participante. */
  data_nota: string | null;
  origem_id: string | null;
  /** Situação na loja: 1 = normal, 3 = cancelada. */
  situacao?: number;
  cancelada_em?: string | null;
  sincronizado_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface SorteioNota {
  id: string;
  sorteio_id: string;
  participante_id: string;
  numero: string;
  valor_centavos: number;
  status: StatusNota;
  motivo_invalidez: string | null;
  cadastrado_em: string;
  validado_em: string | null;
  invalidado_em: string | null;
  cancelado_em: string | null;
  nota_base_id: string | null;
  cupons_gerados: number;
  saldo_gerado_centavos: number;
  /** Marca de idempotência: nota já convertida em saldo/cupons. */
  cupons_processado_em?: string | null;
  atualizado_em: string;
}

export interface SorteioCupom {
  id: string;
  sorteio_id: string;
  participante_id: string;
  nota_id: string;
  /** Número aleatório, único dentro do sorteio (geração em etapa posterior). */
  numero: string;
  valor_base_centavos: number;
  gerado_em: string;
  status: StatusCupom;
  cancelado_em: string | null;
}

export interface SorteioHistorico {
  id: string;
  cliente_id: string;
  sorteio_id: string;
  numero_sorteio: number;
  saldo_final_centavos: number;
  quantidade_notas: number;
  quantidade_cupons: number;
  data_inicio: string | null;
  data_fim: string | null;
  encerrado_em: string | null;
  criado_em: string;
}

export interface SorteioPremio {
  id: string;
  sorteio_id: string;
  nome: string;
  descricao: string;
  ordem: number;
  quantidade: number;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface SorteioGanhador {
  id: string;
  sorteio_id: string;
  premio_id: string | null;
  participante_id: string;
  cupom_id: string;
  numero_cupom: string;
  sorteado_em: string;
  observacao: string | null;
  /** Unidade do prêmio apurada (1..quantidade). */
  unidade?: number | null;
  /** Usuário que realizou a apuração. */
  usuario_id?: string | null;
}

/* ---------------------------------------------- apuração do cupom vencedor */

export interface PremioApuracao {
  id: string;
  nome: string;
  descricao: string;
  ordem: number;
  quantidade: number;
  ativo: boolean;
  sorteados: number;
  disponivel: boolean;
}

export interface GanhadorApuracao {
  id: string;
  premio_id: string | null;
  premio_nome: string | null;
  premio_quantidade: number | null;
  unidade: number | null;
  cupom_id: string;
  numero_cupom: string;
  participante_id: string;
  participante_nome: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  cupom_status: StatusCupom | null;
  sorteado_em: string;
  usuario_id: string | null;
}

export interface TotaisApuracao {
  participantes_concorrentes: number;
  cupons_concorrentes: number;
  premios_cadastrados: number;
  unidades_total: number;
  unidades_sorteadas: number;
  unidades_disponiveis: number;
}

export interface ApuracaoSorteio {
  resultado: "OK" | "IGNORADA";
  motivo?: string;
  sorteio?: {
    id: string;
    nome: string;
    numero_sorteio: number;
    status: StatusSorteio;
  };
  totais?: TotaisApuracao;
  premios?: PremioApuracao[];
  ganhadores?: GanhadorApuracao[];
  /** Números usados apenas no efeito visual da animação. */
  numeros_amostra?: string[];
  pode_sortear?: boolean;
}

export type ResultadoApuracao =
  | {
      resultado: "SORTEADO";
      ganhador_id: string;
      sorteio_id: string;
      premio_id: string;
      premio_nome: string;
      premio_descricao: string | null;
      unidade: number;
      premio_quantidade: number;
      participante_id: string;
      participante_nome: string | null;
      cliente_id: string | null;
      cliente_nome: string | null;
      cupom_id: string;
      numero_cupom: string;
      sorteado_em: string;
      status: StatusSorteio;
      ultimo: boolean;
      unidades_restantes: number;
    }
  | { resultado: "IGNORADO"; motivo: string; status?: StatusSorteio };

export interface SorteioSincronizacao {
  id: string;
  tipo: TipoSincronizacao;
  direcao: DirecaoSincronizacao;
  iniciado_em: string;
  finalizado_em: string | null;
  status: StatusSincronizacao;
  registros_enviados: number;
  registros_recebidos: number;
  registros_processados: number;
  erro: string | null;
  /** Diagnóstico do lote (Etapa 5). */
  lote_id?: string | null;
  operacao_id?: string | null;
  sorteio_id?: string | null;
  origem?: OrigemDestinoSincronizacao | null;
  destino?: OrigemDestinoSincronizacao | null;
  duracao_ms?: number | null;
  criado_em: string;
}

/** Item da fila de sincronização — só metadados de processamento. */
export interface SorteioSincronizacaoItem {
  id: string;
  /** Marca d'água/cursor usado pela API local. */
  sequencia: number;
  tipo: TipoSincronizacao;
  entidade: string;
  entidade_id: string;
  sorteio_id: string | null;
  origem: OrigemDestinoSincronizacao;
  destino: OrigemDestinoSincronizacao;
  operacao: string;
  /** Chave de idempotência do evento. */
  operacao_id: string | null;
  status: StatusFilaSincronizacao;
  tentativas: number;
  ultima_tentativa_em: string | null;
  processado_em: string | null;
  erro: string | null;
  alterado_em: string;
  criado_em: string;
  atualizado_em: string;
}

/** Cursor confirmado por consumidor (ex.: API local da loja). */
export interface SorteioSincronizacaoCursor {
  consumidor: string;
  sequencia: number;
  criado_em: string;
  atualizado_em: string;
}

export interface SorteioAuditoria {
  id: string;
  sorteio_id: string | null;
  participante_id: string | null;
  cliente_id: string | null;
  nota_id: string | null;
  cupom_id: string | null;
  evento: string;
  origem: string;
  usuario_id: string | null;
  detalhe: Record<string, unknown>;
  criado_em: string;
}

/** Eventos previstos na trilha de auditoria do módulo. */
export const EVENTOS_AUDITORIA = {
  notaCadastrada: "nota.cadastrada",
  notaAlterada: "nota.alterada",
  notaValidada: "nota.validada",
  notaInvalidada: "nota.invalidada",
  notaCancelada: "nota.cancelada",
  cuponsGerados: "cupons.gerados",
  cupomCancelado: "cupom.cancelado",
  saldoRecalculado: "saldo.recalculado",
  termosAceitos: "termos.aceitos",
  sincronizacao: "sincronizacao.executada",
  portalEntrada: "portal.entrada",
  participanteCriado: "participante.criado",
  portalSaida: "portal.saida",
} as const;

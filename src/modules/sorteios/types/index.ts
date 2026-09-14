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
export type TipoSincronizacao = "CLIENTES" | "NOTAS";
export type DirecaoSincronizacao = "SUPABASE_PARA_LOCAL" | "LOCAL_PARA_SUPABASE";
export type StatusSincronizacao = "EXECUTANDO" | "CONCLUIDA" | "ERRO" | "PARCIAL";

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
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface SorteioTermos {
  id: string;
  sorteio_id: string;
  versao: number;
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
  criado_em: string;
  atualizado_em: string;
}

export interface SorteioNotaBase {
  id: string;
  numero: string;
  valor_centavos: number;
  /** Só sincronização/auditoria — nunca usada para validar a nota do participante. */
  data_nota: string | null;
  origem_id: string | null;
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
}

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
  criado_em: string;
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
  termosAceitos: "termos.aceitos",
  sincronizacao: "sincronizacao.executada",
} as const;

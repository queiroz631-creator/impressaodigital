import type { StatusSorteio } from "../types";

/**
 * Regras de situação do sorteio (Etapa 2).
 *
 * Nunca é possível voltar para uma situação anterior. Estas regras valem para a
 * interface, mas a decisão final é sempre refeita no servidor antes de gravar.
 */
export const TRANSICOES_PERMITIDAS: Record<StatusSorteio, StatusSorteio[]> = {
  RASCUNHO: ["ATIVO", "CANCELADO"],
  ATIVO: ["ENCERRADO", "CANCELADO"],
  ENCERRADO: ["SORTEADO", "CANCELADO"],
  SORTEADO: [],
  CANCELADO: [],
};

export function podeTransicionar(de: StatusSorteio, para: StatusSorteio): boolean {
  return TRANSICOES_PERMITIDAS[de]?.includes(para) ?? false;
}

/** Campos que alteram retroativamente a participação dos clientes. */
export const CAMPOS_CRITICOS = [
  "numero_sorteio",
  "data_inicio",
  "data_fim",
  "valor_por_cupom_centavos",
] as const;

export type CampoCritico = (typeof CAMPOS_CRITICOS)[number];

export const MENSAGEM_BLOQUEIO_CRITICO =
  "Este sorteio já possui movimentações e seus dados críticos não podem ser alterados.";

/**
 * Campos críticos só são editáveis em RASCUNHO e sem nenhuma movimentação
 * histórica (participantes, notas, cupons ou histórico — inclusive cancelados).
 */
export function podeEditarCriticos(status: StatusSorteio, movimentacoes: number): boolean {
  return status === "RASCUNHO" && movimentacoes === 0;
}

/** Somente consulta: nada mais pode ser alterado. */
export function somenteConsulta(status: StatusSorteio): boolean {
  return status === "SORTEADO" || status === "CANCELADO";
}

export const ROTULO_TRANSICAO: Record<StatusSorteio, string> = {
  RASCUNHO: "Voltar para rascunho",
  ATIVO: "Ativar sorteio",
  ENCERRADO: "Encerrar sorteio",
  CANCELADO: "Cancelar sorteio",
  SORTEADO: "Marcar como sorteado",
};

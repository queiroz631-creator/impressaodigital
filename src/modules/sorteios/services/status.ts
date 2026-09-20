import type { StatusSorteio } from "../types";

/**
 * Regras de situação do sorteio (Etapa 2).
 *
 * Nunca é possível voltar para uma situação anterior — com uma única exceção:
 * a reabertura controlada ENCERRADO → ATIVO, que só acontece pela função
 * dedicada `reabrirSorteio` (auditoria `sorteio.reaberto`), nunca pela troca
 * simples de status. Estas regras valem para a interface, mas a decisão final
 * é sempre refeita no servidor antes de gravar.
 */
export const TRANSICOES_PERMITIDAS: Record<StatusSorteio, StatusSorteio[]> = {
  RASCUNHO: ["ATIVO", "CANCELADO"],
  ATIVO: ["ENCERRADO", "CANCELADO"],
  ENCERRADO: ["SORTEADO", "CANCELADO", "ATIVO"],
  SORTEADO: [],
  CANCELADO: [],
};

export function podeTransicionar(de: StatusSorteio, para: StatusSorteio): boolean {
  return TRANSICOES_PERMITIDAS[de]?.includes(para) ?? false;
}

/**
 * Transições oferecidas como botão simples. O encerramento ficou de fora: ele
 * só acontece pela conferência de encerramento, que confere a base antes. A
 * reabertura também ficou de fora: ela só acontece pela função dedicada, que
 * registra a auditoria própria e limpa os dados do encerramento.
 */
export function transicoesManuais(de: StatusSorteio): StatusSorteio[] {
  return (TRANSICOES_PERMITIDAS[de] ?? []).filter(
    (para) =>
      !(de === "ATIVO" && para === "ENCERRADO") && !(de === "ENCERRADO" && para === "ATIVO"),
  );
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

export const MENSAGEM_BLOQUEIO_ATIVADO =
  "Este sorteio já foi ativado e seus dados críticos não podem mais ser alterados.";

/** Explica por que os campos críticos estão bloqueados (null = liberados). */
export function motivoBloqueioCriticos(
  status: StatusSorteio,
  movimentacoes: number,
): string | null {
  if (movimentacoes > 0) return MENSAGEM_BLOQUEIO_CRITICO;
  if (status !== "RASCUNHO") return MENSAGEM_BLOQUEIO_ATIVADO;
  return null;
}

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

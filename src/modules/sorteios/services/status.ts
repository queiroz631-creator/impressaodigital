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
  CANCELADO: ["ATIVO", "RASCUNHO"],
};

export function podeTransicionar(de: StatusSorteio, para: StatusSorteio): boolean {
  return TRANSICOES_PERMITIDAS[de]?.includes(para) ?? false;
}

/** Sorteios que podem ser reabertos pela função dedicada. */
export function podeReabrir(status: StatusSorteio): boolean {
  return status === "ENCERRADO" || status === "CANCELADO";
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
      !(de === "ATIVO" && para === "ENCERRADO") &&
      !(de === "ENCERRADO" && para === "ATIVO") &&
      de !== "CANCELADO",
  );
}

/**
 * Campos que alteram retroativamente os cupons já gerados. Ficam travados
 * quando há movimentação. Datas, nome, descrição, limite e mínimo da nota
 * podem ser alterados em qualquer situação editável.
 */
export const CAMPOS_CRITICOS = ["numero_sorteio", "valor_por_cupom_centavos"] as const;

export type CampoCritico = (typeof CAMPOS_CRITICOS)[number];

export const MENSAGEM_BLOQUEIO_CRITICO =
  "Este sorteio já possui movimentações (participantes, notas ou cupons): o número do sorteio e o valor por cupom não podem ser alterados, pois mudariam os cupons já gerados. Os demais campos, inclusive as datas, podem ser alterados.";

/** Explica por que os campos críticos estão bloqueados (null = liberados). */
export function motivoBloqueioCriticos(
  _status: StatusSorteio,
  movimentacoes: number,
): string | null {
  if (movimentacoes > 0) return MENSAGEM_BLOQUEIO_CRITICO;
  return null;
}

/** Número e valor por cupom só são editáveis sem nenhuma movimentação histórica. */
export function podeEditarCriticos(_status: StatusSorteio, movimentacoes: number): boolean {
  return movimentacoes === 0;
}

/** Somente consulta: nada mais pode ser alterado. */
export function somenteConsulta(status: StatusSorteio): boolean {
  return status === "SORTEADO" || status === "CANCELADO";
}

/** Motivos de recusa da reabertura, traduzidos para a tela. */
export const MENSAGEM_REABERTURA: Record<string, string> = {
  sorteio_nao_encontrado: "Sorteio não encontrado.",
  ja_ativo: "Este sorteio já está ativo.",
  ja_sorteado: "Este sorteio já foi sorteado e não pode ser reaberto.",
  cancelado: "Este sorteio está cancelado e não pode ser reaberto.",
  status_invalido: "A situação deste sorteio não permite reabertura.",
  em_rascunho: "Este sorteio ainda está em rascunho.",
};

export const ROTULO_TRANSICAO: Record<StatusSorteio, string> = {
  RASCUNHO: "Voltar para rascunho",
  ATIVO: "Ativar sorteio",
  ENCERRADO: "Encerrar sorteio",
  CANCELADO: "Cancelar sorteio",
  SORTEADO: "Marcar como sorteado",
};

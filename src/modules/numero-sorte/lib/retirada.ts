/** Regras puras do comprovante e da retirada do Nº da Sorte (exibição e pré-validação). */
export const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export type SituacaoPremiacao = "reservado" | "entregue" | "vencido" | "cancelado";

/** "K7M9P2Q4" -> "K7M9-P2Q4". */
export function formatarCodigoRetirada(codigo: string): string {
  const c = normalizarCodigoRetirada(codigo);
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

/** Remove separadores/espaços e passa para maiúsculas. */
export function normalizarCodigoRetirada(texto: string): string {
  return texto.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function codigoRetiradaValido(texto: string): boolean {
  const c = normalizarCodigoRetirada(texto);
  return c.length === 8 && [...c].every((ch) => ALFABETO_CODIGO.includes(ch));
}

/** Extrai o token de uma URL lida no QR (/numero-da-sorte/validar/<token>) ou do próprio token. */
export function extrairTokenQr(lido: string): string | null {
  const t = lido.trim();
  const m = t.match(/\/numero-da-sorte\/validar\/([A-Za-z0-9_-]{20,})\/?(?:[?#].*)?$/);
  if (m) return m[1]!;
  return /^[A-Za-z0-9_-]{40,}$/.test(t) ? t : null;
}

/** Situação efetiva considerando o prazo (o banco também vence automaticamente). */
export function situacaoEfetiva(situacao: SituacaoPremiacao, prazoEm: string, agora = new Date()): SituacaoPremiacao {
  if (situacao === "reservado" && new Date(prazoEm).getTime() < agora.getTime()) return "vencido";
  return situacao;
}

export const rotuloSituacao: Record<SituacaoPremiacao, string> = {
  reservado: "Aguardando retirada",
  entregue: "Entregue",
  vencido: "Vencido",
  cancelado: "Cancelado",
};

/** O que o funcionário pode fazer com a premiação. */
export function acaoRetirada(
  situacao: SituacaoPremiacao,
  prazoEm: string,
  podeExcecao: boolean,
  agora = new Date(),
): "entregar" | "excecao" | "nenhuma" {
  const s = situacaoEfetiva(situacao, prazoEm, agora);
  if (s === "reservado") return "entregar";
  if (s === "vencido" && podeExcecao) return "excecao";
  return "nenhuma";
}

export function justificativaValida(texto: string): boolean {
  return texto.trim().length >= 10;
}

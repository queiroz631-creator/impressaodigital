/** Regras puras dos indicadores e relatórios do Nº da Sorte (Etapa 4). */

export function percentual(numerador: number, denominador: number): number {
  if (!denominador || denominador <= 0) return 0;
  return Math.round((numerador / denominador) * 1000) / 10;
}

/** Premiação = clientes premiados / clientes participantes. */
export function taxaPremiacao(premiados: number, participantes: number) {
  return percentual(premiados, participantes);
}

/**
 * Retirada = entregues / premiações válidas.
 * Válidas = entregues + aguardando + vencidas (canceladas e não encontradas ficam fora).
 */
export function taxaRetirada(s: { entregue?: number; reservado?: number; vencido?: number }) {
  const entregue = s.entregue ?? 0;
  return percentual(entregue, entregue + (s.reservado ?? 0) + (s.vencido ?? 0));
}

export const ROTULO_RESULTADO: Record<string, string> = {
  nao_premiado: "Não premiado",
  premiado: "Premiado",
  repetida: "Número já utilizado",
  bloqueada: "Cliente já contemplado",
  limite: "Limite de consultas atingido",
  invalida: "Número inválido / campanha indisponível",
};

export const ROTULO_PREMIACAO: Record<string, string> = {
  reservado: "Aguardando retirada",
  entregue: "Entregue",
  vencido: "Vencido",
  cancelado: "Cancelado",
};

export function mascararCpf(cpf: string | null | undefined): string {
  const d = (cpf ?? "").replace(/\D/g, "");
  if (d.length !== 11) return "";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

/** Converte datas AAAA-MM-DD (horário de Brasília) em intervalo [de, ate). */
export function intervaloPeriodo(de?: string, ate?: string) {
  const ok = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const inicio = ok(de) ? new Date(`${de}T00:00:00-03:00`).toISOString() : null;
  let fim: string | null = null;
  if (ok(ate)) {
    const d = new Date(`${ate}T00:00:00-03:00`);
    d.setUTCDate(d.getUTCDate() + 1);
    fim = d.toISOString();
  }
  return { de: inicio, ate: fim };
}

function celula(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "boolean" ? (v ? "Sim" : "Não") : String(v);
  const seguro = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** CSV com separador ";" (Excel pt-BR), proteção contra fórmulas e BOM UTF-8. */
export function gerarCsv(colunas: { chave: string; titulo: string }[], linhas: Record<string, unknown>[]) {
  const cab = colunas.map((c) => celula(c.titulo)).join(";");
  const corpo = linhas.map((l) => colunas.map((c) => celula(l[c.chave])).join(";"));
  return "\uFEFF" + [cab, ...corpo].join("\r\n");
}

export type TipoRelatorio = "participantes" | "consultas" | "premiacoes" | "retiradas";

export const COLUNAS_RELATORIO: Record<TipoRelatorio, { chave: string; titulo: string }[]> = {
  participantes: [
    { chave: "nome", titulo: "Cliente" },
    { chave: "telefone", titulo: "Telefone" },
    { chave: "cpf", titulo: "CPF" },
    { chave: "campanha_numero", titulo: "Campanha" },
    { chave: "consultas", titulo: "Consultas" },
    { chave: "distintos", titulo: "Números distintos" },
    { chave: "primeiro_acesso", titulo: "Primeiro acesso" },
    { chave: "ultima", titulo: "Última participação" },
    { chave: "situacao", titulo: "Situação" },
    { chave: "premiado", titulo: "Premiado" },
  ],
  consultas: [
    { chave: "campanha_numero", titulo: "Campanha" },
    { chave: "cliente", titulo: "Cliente" },
    { chave: "numero", titulo: "Número informado" },
    { chave: "criado_em", titulo: "Data e hora" },
    { chave: "resultado", titulo: "Resultado" },
  ],
  premiacoes: [
    { chave: "campanha_numero", titulo: "Campanha" },
    { chave: "cliente", titulo: "Cliente" },
    { chave: "numero", titulo: "Número premiado" },
    { chave: "premio", titulo: "Prêmio" },
    { chave: "reservado_em", titulo: "Data da premiação" },
    { chave: "prazo_em", titulo: "Prazo de retirada" },
    { chave: "situacao", titulo: "Situação" },
    { chave: "entregue_em", titulo: "Data da entrega" },
    { chave: "entregue_por", titulo: "Entregue por" },
  ],
  retiradas: [
    { chave: "campanha_numero", titulo: "Campanha" },
    { chave: "cliente", titulo: "Cliente" },
    { chave: "numero", titulo: "Número premiado" },
    { chave: "premio", titulo: "Prêmio" },
    { chave: "entregue_em", titulo: "Data da entrega" },
    { chave: "entregue_por", titulo: "Entregue por" },
    { chave: "excecao_prazo", titulo: "Exceção de prazo" },
    { chave: "justificativa", titulo: "Justificativa" },
  ],
};

/** Formata linhas para exportação (datas em Brasília, rótulos legíveis). */
export function formatarLinhaExportacao(l: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...l };
  for (const k of ["primeiro_acesso", "ultima", "criado_em", "reservado_em", "prazo_em", "entregue_em"]) {
    const v = l[k];
    if (typeof v === "string") out[k] = new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }
  if (typeof l.resultado === "string") out.resultado = ROTULO_RESULTADO[l.resultado] ?? l.resultado;
  if (typeof l.situacao === "string" && ROTULO_PREMIACAO[l.situacao]) out.situacao = ROTULO_PREMIACAO[l.situacao];
  return out;
}

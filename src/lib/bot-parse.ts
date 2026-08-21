/** Interpretação das respostas do cliente no atendimento automático. Módulo puro. */

/** Remove acentos e normaliza para comparação. */
export function chave(valor: string | null | undefined) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const SIM = ["sim", "s", "isso", "claro", "quero", "pode", "positivo", "ok", "confirmo", "confirmar", "certo", "aham", "yes", "1"];
const NAO = ["nao", "n", "negativo", "nunca", "sem", "no", "2"];

/** Retorna true/false para respostas de sim ou não, ou null quando indefinido. */
export function simOuNao(texto: string): boolean | null {
  const t = chave(texto);
  if (!t) return null;
  if (SIM.includes(t)) return true;
  if (NAO.includes(t)) return false;
  if (/\bnao\b|\bnão\b/.test(t)) return false;
  if (/\bsim\b|\bquero\b|\bpode\b/.test(t)) return true;
  return null;
}

/** Primeiro número inteiro presente no texto (0 incluso). */
export function primeiroNumero(texto: string): number | null {
  const m = /-?\d+/.exec(String(texto ?? ""));
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** Todos os números inteiros presentes no texto (para escolhas múltiplas). */
export function todosNumeros(texto: string): number[] {
  return (String(texto ?? "").match(/\d+/g) ?? []).map(Number).filter((n) => Number.isFinite(n));
}

/**
 * Escolhe uma opção pelo número da lista (1..n) ou pelo nome digitado.
 * Retorna o índice (0-based) ou null.
 */
export function escolherOpcao(texto: string, opcoes: string[]): number | null {
  const t = chave(texto);
  if (!t) return null;

  const n = primeiroNumero(t);
  if (n !== null && n >= 1 && n <= opcoes.length && /^\s*\d+\s*$/.test(t)) return n - 1;

  const exato = opcoes.findIndex((o) => chave(o) === t);
  if (exato >= 0) return exato;

  const contem = opcoes.findIndex((o) => chave(o).includes(t) || t.includes(chave(o)));
  if (contem >= 0) return contem;

  if (n !== null && n >= 1 && n <= opcoes.length) return n - 1;

  return null;
}

/** Detecta pedido explícito de falar com um atendente humano. */
export function pediuAtendente(texto: string): boolean {
  const t = chave(texto);
  if (!t) return false;
  return /atendente|humano|pessoa|falar com alguem|nao sou robo|atendimento humano|gerente|reclama/.test(t);
}

/** Detecta que o cliente terminou de enviar os arquivos. */
export function terminouEnvio(texto: string): boolean {
  const t = chave(texto);
  if (!t) return false;
  return /^(pronto|ok|acabou|so isso|somente isso|terminei|enviei|finalizei|e so|fim|nada mais)$/.test(t) ||
    /terminei|acabei de enviar|so esses|somente esses|nao tenho mais/.test(t);
}

/** Nome informado pelo cliente, limpo de saudações. */
export function extrairNome(texto: string): string {
  const limpo = String(texto ?? "")
    .replace(/^\s*(ola|olá|oi|bom dia|boa tarde|boa noite|meu nome e|meu nome é|me chamo|sou o|sou a|aqui e|aqui é)\s*[,:-]?\s*/i, "")
    .replace(/[.!,;]+$/, "")
    .trim();
  return limpo.slice(0, 80);
}

/** Substitui marcadores {nome}, {total} etc. em um modelo de mensagem. */
export function aplicarModelo(modelo: string, valores: Record<string, string>) {
  return String(modelo ?? "").replace(/\{(\w+)\}/g, (todo, chaveVar: string) => valores[chaveVar] ?? todo);
}

export function moeda(valor: number) {
  return (Number(valor) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

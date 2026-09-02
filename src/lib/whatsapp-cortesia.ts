/**
 * Mensagens de cortesia (agradecimentos/despedidas) ignoradas logo após o
 * atendimento ser finalizado, para não reabrir um atendimento novo.
 * Módulo puro: usado no webhook e na tela de configuração do bot.
 */

export interface IgnorarAgradecimentosCfg {
  ativo: boolean;
  janela_minutos: number;
  frases: string[];
}

export const FRASES_CORTESIA_PADRAO: string[] = [
  "obrigado", "obrigada", "obg", "muito obrigado", "muito obrigada",
  "valeu", "vlw", "ok", "okay", "tá bom", "ta bom", "blz", "beleza",
  "agradeço", "grato", "grata", "show", "perfeito", "ótimo", "otimo",
  "maravilha", "combinado", "certo", "deus abençoe", "amém", "👍", "🙏",
];

export function cfgCortesiaPadrao(): IgnorarAgradecimentosCfg {
  return { ativo: true, janela_minutos: 30, frases: [...FRASES_CORTESIA_PADRAO] };
}

/** Lê o campo jsonb da configuração com tolerância a formatos antigos/vazios. */
export function lerCfgCortesia(valor: unknown): IgnorarAgradecimentosCfg {
  const v = (valor ?? {}) as Partial<IgnorarAgradecimentosCfg>;
  const frases = Array.isArray(v.frases) ? v.frases.filter((f) => typeof f === "string" && f.trim()) : [];
  return {
    ativo: v.ativo !== false,
    janela_minutos: Math.max(0, Number(v.janela_minutos ?? 30) || 0),
    frases: frases.length ? frases : [...FRASES_CORTESIA_PADRAO],
  };
}

/** Minúsculas, sem acento, sem pontuação/emoji, espaços colapsados. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A mensagem é apenas cortesia? Comparação exata após normalizar: "obrigado"
 * conta; "obrigado, e quanto fica 10 cópias?" não conta. Mensagens só de
 * emoji (normalizam para vazio) caem na comparação do texto cru.
 */
export function ehMensagemCortesia(texto: string, frases: string[]): boolean {
  const cru = texto.trim().toLowerCase();
  if (!cru) return false;
  const norm = normalizar(texto);
  for (const frase of frases) {
    const f = frase.trim();
    if (!f) continue;
    if (cru === f.toLowerCase()) return true;
    if (norm && norm === normalizar(f)) return true;
  }
  return false;
}

/** Dentro da janela de encerramento após a finalização? */
export function dentroDaJanela(dataFinalizacao: string | null | undefined, janelaMinutos: number, agora: Date): boolean {
  if (janelaMinutos <= 0 || !dataFinalizacao) return false;
  const fim = new Date(dataFinalizacao).getTime() + janelaMinutos * 60_000;
  return Number.isFinite(fim) && agora.getTime() <= fim;
}

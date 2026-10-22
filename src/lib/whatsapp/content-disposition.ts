/**
 * Montagem segura do header `Content-Disposition`.
 *
 * Nomes de arquivo vindos do WhatsApp carregam acentos em Unicode
 * **decomposto** (NFD): o "ó" chega como `o` + U+0301. O Node exige que o
 * valor de um header seja uma ByteString (Latin-1); um caractere acima de
 * U+00FF derruba a rota inteira com
 * `TypeError: Cannot convert argument to a ByteString` — ou seja, um anexo
 * chamado "Cópia de Vinicius.pdf" quebra a exibição do arquivo.
 *
 * A saída segue a RFC 6266:
 * - `filename="..."` — versão ASCII (fallback para clientes antigos);
 * - `filename*=UTF-8''...` — nome real percent-encoded (formato RFC 5987),
 *   suportado pelos navegadores atuais.
 *
 * Módulo puro (sem rede, sem banco) para ser testável isoladamente.
 */

/** Substituições usadas no fallback ASCII (evita `__` feio no nome antigo). */
const TRANSLITERACAO: Record<string, string> = {
  á: "a", à: "a", ã: "a", â: "a", ä: "a", å: "a",
  é: "e", è: "e", ê: "e", ë: "e",
  í: "i", ì: "i", î: "i", ï: "i",
  ó: "o", ò: "o", õ: "o", ô: "o", ö: "o",
  ú: "u", ù: "u", û: "u", ü: "u",
  ç: "c", ñ: "n", ý: "y", ÿ: "y", ß: "ss", æ: "ae", ø: "o", ð: "d", þ: "th",
  đ: "d", ħ: "h", ĸ: "k", ŧ: "t", º: "o", ª: "a", µ: "u", ə: "e",
  ā: "a", ă: "a", ą: "a", ć: "c", č: "c", ė: "e", ę: "e", ē: "e", ğ: "g",
  ī: "i", į: "i", ı: "i", ĺ: "l", ł: "l", ń: "n", ň: "n", ō: "o", ő: "o",
  œ: "oe", ŕ: "r", ř: "r", ś: "s", š: "s", ţ: "t", ť: "t", ũ: "u", ū: "u",
  ů: "u", ű: "u", ų: "u", ž: "z", ź: "z",
};

/** Caracteres que não podem aparecer no valor do header. */
const INVALIDOS = /["\\]/g;
/** Caracteres de controle (incluem CR/LF, que permitiriam injeção de header). */
const CONTROLES = /[\u0000-\u001F\u007F]/g;

/**
 * Normaliza o nome do arquivo: NFC (para ter um único acento por letra),
 * sem controles, sem aspas/barras e sem espaços nas pontas.
 */
export function sanitizarNomeArquivo(nome: string | null | undefined): string {
  const base = (nome ?? "").normalize("NFC").replace(CONTROLES, "");
  return base.replace(INVALIDOS, "").trim();
}

/** Versão ASCII do nome, usada no parâmetro `filename` (fallback). */
export function nomeAsciiSeguro(nome: string): string {
  let out = "";
  for (const letra of nome) {
    const baixa = letra.toLowerCase();
    const traduzida = TRANSLITERACAO[baixa];
    if (traduzida) {
      out += traduzida;
    } else if (letra.codePointAt(0)! <= 0x7e && letra !== ";") {
      out += letra;
    } else {
      out += "_";
    }
  }
  out = out.trim();
  return out || "arquivo";
}

/** Percent-encoding no formato da RFC 5987 (apenas `attr-char` permitido). */
function percentEncode5987(valor: string): string {
  return encodeURIComponent(valor)
    .replace(/[']/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
}

/**
 * Monta o valor do header `Content-Disposition`.
 *
 * @param tipo `inline` (exibição) ou `attachment` (download).
 * @param nome Nome do arquivo, já vindo do provedor (pode ter acento/NFD).
 */
export function montarContentDisposition(
  tipo: "inline" | "attachment",
  nome: string | null | undefined,
): string {
  const limpo = sanitizarNomeArquivo(nome);
  const ascii = nomeAsciiSeguro(limpo);
  const base = `${tipo}; filename="${ascii}"`;

  // Sem nome (ou já ASCII e seguro): não há necessidade do parâmetro estendido.
  if (limpo === "" || ascii === limpo) return base;

  return `${base}; filename*=UTF-8''${percentEncode5987(limpo)}`;
}

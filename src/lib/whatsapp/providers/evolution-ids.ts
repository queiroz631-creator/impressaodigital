/**
 * Identificadores de mensagem da Evolution API. PURO.
 *
 * `whatsapp_mensagens.whatsapp_message_id` tem índice único GLOBAL. O id de
 * uma mensagem do WhatsApp pode se repetir entre conexões (a mesma mensagem
 * vista por dois números) e entre provedores, então os ids da Evolution são
 * gravados com prefixo: `evo:<conexaoId>:<idOriginal>`. Os ids da Z-API
 * seguem sem prefixo (inalterados).
 */

const PREFIXO = /^evo:([0-9a-f-]{36}):(.+)$/i;

export function prefixarIdEvolution(conexaoId: string, idOriginal: string): string {
  return `evo:${conexaoId}:${idOriginal}`;
}

/** Id original no provedor (aceita o id já sem prefixo). */
export function idOriginalEvolution(idGravado: string): string {
  const m = PREFIXO.exec(idGravado);
  return m ? m[2]! : idGravado;
}

export function ehIdEvolution(id: string): boolean {
  return PREFIXO.test(id);
}

/** Referência interna de mídia que só o provedor sabe baixar (gravada em `arquivo_url`). */
export const ESQUEMA_MIDIA_PROVEDOR = "provedor-midia:";

export function montarUrlMidiaProvedor(conexaoId: string, idMensagem: string): string {
  return `${ESQUEMA_MIDIA_PROVEDOR}//${conexaoId}/${encodeURIComponent(idMensagem)}`;
}

export function lerUrlMidiaProvedor(url: string | null | undefined): { conexaoId: string; idMensagem: string } | null {
  if (!url || !url.startsWith(`${ESQUEMA_MIDIA_PROVEDOR}//`)) return null;
  const resto = url.slice(ESQUEMA_MIDIA_PROVEDOR.length + 2);
  const barra = resto.indexOf("/");
  if (barra <= 0) return null;
  const conexaoId = resto.slice(0, barra);
  if (!/^[0-9a-f-]{36}$/i.test(conexaoId)) return null;
  try {
    const idMensagem = decodeURIComponent(resto.slice(barra + 1));
    return idMensagem ? { conexaoId, idMensagem } : null;
  } catch {
    return null;
  }
}

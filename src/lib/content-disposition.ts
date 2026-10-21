/**
 * Monta um cabeçalho Content-Disposition seguro (RFC 6266 / RFC 5987).
 * Sempre retorna somente caracteres ASCII imprimíveis, evitando o erro
 * ByteString do runtime com nomes acentuados (inclusive NFD).
 */
export function montarContentDisposition(
  nomeOriginal: string | null | undefined,
  modo: "inline" | "attachment",
): string {
  const limpo = (nomeOriginal ?? "")
    .normalize("NFC")
    // remove caracteres de controle (inclui CR/LF/TAB) e separadores de caminho
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/[\\/]/g, "_")
    .trim();
  const nome = limpo || "arquivo";

  const ascii =
    nome
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7e]/g, "_")
      .replace(/["%;\\]/g, "_")
      .trim() || "arquivo";

  const codificado = encodeURIComponent(nome).replace(
    /['()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );

  return `${modo}; filename="${ascii}"; filename*=UTF-8''${codificado}`;
}

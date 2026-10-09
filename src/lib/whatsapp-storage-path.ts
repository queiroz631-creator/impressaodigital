const EXTENSOES_POR_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "video/mp4": "mp4",
  "application/zip": "zip",
  "text/plain": "txt",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

/** IDs come from database UUID columns; received names never become path components. */
export function caminhoMidiaWhatsapp(
  conversaId: string,
  arquivoId: string,
  nome: string | null,
  mime: string | null,
): string {
  const tipo = (mime ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  const nomeSemParametros = (nome ?? "").split(/[?#]/)[0] ?? "";
  const extensaoNome = /\.([a-z0-9]{1,10})$/i.exec(nomeSemParametros)?.[1]?.toLowerCase();
  const extensao = EXTENSOES_POR_MIME[tipo] ?? extensaoNome ?? "bin";
  return `${conversaId}/${arquivoId}.${extensao}`;
}
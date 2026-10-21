export type SituacaoPdf = "ok" | "protegido" | "danificado";

/** Lê um PDF e informa páginas e situação (com senha ou danificado). */
export async function analisarPdf(
  dados: ArrayBuffer,
): Promise<{ situacao: SituacaoPdf; paginas: number | null }> {
  const { PDFDocument } = await import("pdf-lib");
  try {
    const doc = await PDFDocument.load(dados);
    return { situacao: "ok", paginas: doc.getPageCount() };
  } catch (e) {
    const nome = e instanceof Error ? `${e.name} ${e.message}` : "";
    const criptografado =
      /encrypt/i.test(nome) || new TextDecoder("latin1").decode(dados.slice(0, 4096 * 64)).includes("/Encrypt");
    if (criptografado) {
      try {
        const doc = await PDFDocument.load(dados, { ignoreEncryption: true });
        return { situacao: "protegido", paginas: doc.getPageCount() };
      } catch {
        return { situacao: "protegido", paginas: null };
      }
    }
    return { situacao: "danificado", paginas: null };
  }
}

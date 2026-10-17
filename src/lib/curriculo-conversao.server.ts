/**
 * Conversão de currículos Word (DOC/DOCX) em PDF com o LibreOffice da VPS.
 * Somente servidor Node (VPS). Na hospedagem sem LibreOffice devolve SEM_CONVERSOR.
 * Os arquivos temporários são sempre apagados, inclusive em falha.
 */

export class ErroConversao extends Error {}

export async function converterWordEmPdf(base64: string, extensao: "doc" | "docx"): Promise<string> {
  let fs: typeof import("node:fs/promises");
  let os: typeof import("node:os");
  let path: typeof import("node:path");
  let cp: typeof import("node:child_process");
  try {
    fs = await import("node:fs/promises");
    os = await import("node:os");
    path = await import("node:path");
    cp = await import("node:child_process");
    if (typeof cp.execFile !== "function") throw new Error();
  } catch {
    throw new ErroConversao("SEM_CONVERSOR");
  }

  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) throw new ErroConversao("ARQUIVO_INVALIDO");
  if (bytes.length > 10 * 1024 * 1024) throw new ErroConversao("ARQUIVO_GRANDE");

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "curriculo-conv-"));
  try {
    const entrada = path.join(dir, `curriculo.${extensao}`);
    await fs.writeFile(entrada, bytes);
    const perfil = `file://${path.join(dir, "perfil")}`;
    await new Promise<void>((resolve, reject) => {
      cp.execFile(
        process.env["LIBREOFFICE_BIN"] || "soffice",
        [
          `-env:UserInstallation=${perfil}`,
          "--headless",
          "--norestore",
          "--nolockcheck",
          "--convert-to",
          "pdf",
          "--outdir",
          dir,
          entrada,
        ],
        { timeout: 45000, killSignal: "SIGKILL" },
        (erro) => {
          if (!erro) return resolve();
          const codigo = (erro as NodeJS.ErrnoException).code;
          reject(new ErroConversao(codigo === "ENOENT" ? "SEM_CONVERSOR" : "FALHA_CONVERSAO"));
        },
      );
    });
    const pdf = await fs.readFile(path.join(dir, "curriculo.pdf")).catch(() => null);
    if (!pdf || pdf.length < 100 || pdf.subarray(0, 5).toString() !== "%PDF-") {
      throw new ErroConversao("FALHA_CONVERSAO");
    }
    return pdf.toString("base64");
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

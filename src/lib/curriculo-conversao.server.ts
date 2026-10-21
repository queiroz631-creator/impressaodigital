/**
 * Conversão de currículos Word (DOC/DOCX) em PDF, somente servidor.
 *
 * Duas necessidades convivem aqui:
 *  - `converterDocParaPdf`: server function usada pela leitura do texto do
 *    documento (extrai o texto do PDF gerado pelo LibreOffice headless).
 *  - `converterWordEmPdf`: conversão simples usada no anexo do currículo,
 *    com validação do PDF e limpeza garantida dos arquivos temporários
 *    (roda na VPS; sem LibreOffice devolve SEM_CONVERSOR).
 *
 * Na hospedagem sem LibreOffice, `converterWordEmPdf` devolve SEM_CONVERSOR e
 * `converterDocParaPdf` devolve LIBREOFFICE_NAO_INSTALADO. Os arquivos
 * temporários são sempre removidos, inclusive em falha.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Schema de entrada: arquivo como base64 + nome original
const converterSchema = z.object({
  arquivoBase64: z.string().min(1),
  nomeArquivo: z.string().min(1),
});

// Schema de saída detalhado
const resultadoSchema = z.object({
  ok: z.boolean(),
  texto: z.string().optional(),
  erro: z.string().optional(),
  detalhe: z.string().optional(),
});

/**
 * Verifica se LibreOffice está disponível e retorna o caminho do executável
 */
async function verificarLibreOffice(): Promise<{ ok: boolean; caminho?: string; erro?: string }> {
  const caminhosComuns = [
    // Windows - usar soffice.com (versão console) para linha de comando
    path.join(process.env["ProgramFiles"] || "C:\\Program Files", "LibreOffice", "program", "soffice.com"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "LibreOffice", "program", "soffice.com"),
    // Linux/macOS
    "/usr/bin/libreoffice",
    "/usr/bin/soffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
  ];

  // Adicionar caminhos do PATH
  const pathDirs = (process.env["PATH"] || "").split(path.delimiter);
  for (const dir of pathDirs) {
    caminhosComuns.push(path.join(dir, "libreoffice"));
    caminhosComuns.push(path.join(dir, "soffice"));
    caminhosComuns.push(path.join(dir, "soffice.com"));
    caminhosComuns.push(path.join(dir, "soffice.exe"));
  }

  for (const cmd of caminhosComuns) {
    try {
      await execFileAsync(cmd, ["--version"], { timeout: 5000 });
      return { ok: true, caminho: cmd };
    } catch {
      // Continuar tentando próximo caminho
    }
  }

  return { ok: false, erro: "LibreOffice não encontrado no sistema. Instale o LibreOffice e certifique-se de que o diretório de instalação está no PATH do sistema." };
}

/**
 * Converte DOC/DOCX para PDF usando LibreOffice headless e extrai texto.
 * Remove arquivos temporários ao final.
 */
async function converterEExtrairTexto(arquivoBase64: string, nomeArquivo: string): Promise<{ ok: boolean; texto?: string; erro?: string; detalhe?: string | undefined }> {
  // Verificar se LibreOffice está disponível
  const checkLibreOffice = await verificarLibreOffice();
  if (!checkLibreOffice.ok) {
    return { ok: false, erro: "LIBREOFFICE_NAO_INSTALADO", detalhe: checkLibreOffice.erro ?? undefined };
  }

  const libreOfficeCmd = checkLibreOffice.caminho!;
  const tempDir = os.tmpdir();
  const id = randomUUID();
  const ext = path.extname(nomeArquivo).toLowerCase();
  const tempInput = path.join(tempDir, `curriculo_${id}${ext}`);
  const tempPdf = path.join(tempDir, `curriculo_${id}.pdf`);

  try {
    // 1. Salvar arquivo base64 temporariamente
    const buffer = Buffer.from(arquivoBase64, "base64");
    fs.writeFileSync(tempInput, buffer);

    // 2. Converter para PDF usando LibreOffice headless
    // No Windows usar soffice.com (versão console), no Linux/macOS usar o comando detectado
    const isWindows = process.platform === "win32";
    const convertCmd = isWindows && libreOfficeCmd.endsWith("soffice.com")
      ? libreOfficeCmd  // Já é soffice.com
      : libreOfficeCmd;

    try {
      await execFileAsync(convertCmd, [
        "--headless",
        "--convert-to", "pdf",
        "--outdir", tempDir,
        tempInput
      ], { timeout: 60000 }); // timeout 60s
    } catch (execError) {
      const msg = execError instanceof Error ? execError.message : String(execError);
      console.error("Erro na execução do LibreOffice:", msg);
      throw new Error(`Falha ao executar LibreOffice: ${msg}`);
    }

    // O LibreOffice cria o PDF com o mesmo nome base na pasta de saída
    const expectedPdf = path.join(tempDir, `curriculo_${id}.pdf`);

    if (!fs.existsSync(expectedPdf)) {
      // Tentar encontrar o PDF gerado (pode ter nome ligeiramente diferente)
      const files = fs.readdirSync(tempDir).filter(f => f.startsWith(`curriculo_${id}`) && f.endsWith(".pdf"));
      if (files.length === 0) {
        throw new Error("PDF não foi gerado pelo LibreOffice");
      }
    }

    // 3. Extrair texto do PDF gerado
    const pdfjs = await import("pdfjs-dist");
    const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default as string;
    pdfjs.GlobalWorkerOptions.workerSrc = worker;

    const pdfData = fs.readFileSync(expectedPdf);
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfData) }).promise;

    const partes: string[] = [];
    for (let p = 1; p <= doc.numPages; p += 1) {
      const pagina = await doc.getPage(p);
      const conteudo = await pagina.getTextContent();
      let linha = "";
      let ultimoY: number | null = null;
      for (const item of conteudo.items) {
        const it = item as { str?: string; transform?: number[]; hasEOL?: boolean };
        if (typeof it.str !== "string") continue;
        const y = it.transform?.[5] ?? null;
        if (ultimoY !== null && y !== null && Math.abs(y - ultimoY) > 2) {
          partes.push(linha.trim());
          linha = "";
        }
        linha += `${it.str} `;
        ultimoY = y;
      }
      partes.push(linha.trim());
      partes.push("");
    }

    const texto = partes.join("\n").trim();

    if (!texto || texto.replace(/\s+/g, "").length < 60) {
      return { ok: false, erro: "PDF_SEM_TEXTO", detalhe: "O PDF gerado não contém texto legível (mínimo 60 caracteres)." };
    }

    return { ok: true, texto: texto.slice(0, 40000) };
  } catch (e) {
    const erro = e instanceof Error ? e.message : "Erro desconhecido na conversão";
    console.error("Erro na conversão DOC/DOCX para PDF (LibreOffice):", erro);
    return { ok: false, erro: "FALHA_CONVERSAO", detalhe: erro };
  } finally {
    // Limpeza: remover arquivos temporários
    try { if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput); } catch { }
    try { if (fs.existsSync(tempPdf)) fs.unlinkSync(tempPdf); } catch { }
  }
}

export const converterDocParaPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => converterSchema.parse(input))
  .handler(async ({ data }: { data: z.infer<typeof converterSchema> }): Promise<{ ok: boolean; texto?: string; erro?: string; detalhe?: string | undefined }> => {
    // Verificar permissão (qualquer usuário autenticado pode importar currículo)
    return await converterEExtrairTexto(data.arquivoBase64, data.nomeArquivo);
  });

/** Erro de conversão com código legível (SEM_CONVERSOR, ARQUIVO_INVALIDO, ...). */
export class ErroConversao extends Error {}

/**
 * Converte um currículo Word (base64) em PDF e devolve o PDF em base64.
 * Usada no anexo do currículo; na VPS usa `LIBREOFFICE_BIN` (padrão `soffice`).
 */
export async function converterWordEmPdf(base64: string, extensao: "doc" | "docx"): Promise<string> {
  let fsPromises: typeof import("node:fs/promises");
  let os2: typeof import("node:os");
  let path2: typeof import("node:path");
  let cp: typeof import("node:child_process");
  try {
    fsPromises = await import("node:fs/promises");
    os2 = await import("node:os");
    path2 = await import("node:path");
    cp = await import("node:child_process");
    if (typeof cp.execFile !== "function") throw new Error();
  } catch {
    throw new ErroConversao("SEM_CONVERSOR");
  }

  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) throw new ErroConversao("ARQUIVO_INVALIDO");
  if (bytes.length > 10 * 1024 * 1024) throw new ErroConversao("ARQUIVO_GRANDE");

  const dir = await fsPromises.mkdtemp(path2.join(os2.tmpdir(), "curriculo-conv-"));
  try {
    const entrada = path2.join(dir, `curriculo.${extensao}`);
    await fsPromises.writeFile(entrada, bytes);
    const perfil = `file://${path2.join(dir, "perfil")}`;
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
    const pdf = await fsPromises.readFile(path2.join(dir, "curriculo.pdf")).catch(() => null);
    if (!pdf || pdf.length < 100 || pdf.subarray(0, 5).toString() !== "%PDF-") {
      throw new ErroConversao("FALHA_CONVERSAO");
    }
    return pdf.toString("base64");
  } finally {
    await fsPromises.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

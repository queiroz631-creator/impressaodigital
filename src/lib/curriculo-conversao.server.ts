/**
 * Conversão de DOC/DOCX para PDF e extração de texto.
 * Somente servidor (usa LibreOffice headless - funciona em Linux/Windows/macOS).
 * Arquivos temporários são removidos após a extração.
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
  const pathDirs = (process.env.PATH || "").split(path.delimiter);
  for (const dir of pathDirs) {
    caminhosComuns.push(path.join(dir, "libreoffice"));
    caminhosComuns.push(path.join(dir, "soffice"));
    caminhosComuns.push(path.join(dir, "soffice.com"));
    caminhosComuns.push(path.join(dir, "soffice.exe"));
  }

  for (const cmd of caminhosComuns) {
    try {
      const { execFile } = await import("child_process");
      const { promisify } = await import("util");
      const execFileAsync = promisify(execFile);
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
async function converterEExtrairTexto(arquivoBase64: string, nomeArquivo: string): Promise<{ ok: boolean; texto?: string; erro?: string; detalhe?: string }> {
  // Verificar se LibreOffice está disponível
  const checkLibreOffice = await verificarLibreOffice();
  if (!checkLibreOffice.ok) {
    return { ok: false, erro: "LIBREOFFICE_NAO_INSTALADO", detalhe: checkLibreOffice.erro };
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

    let conversionResult;
    try {
      conversionResult = await execFileAsync(convertCmd, [
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
  .handler(async ({ data }): Promise<{ ok: boolean; texto?: string; erro?: string; detalhe?: string }> => {
    // Verificar permissão (qualquer usuário autenticado pode importar currículo)
    return await converterEExtrairTexto(data.arquivoBase64, data.nomeArquivo);
  });
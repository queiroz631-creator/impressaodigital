/**
 * Extração de texto de currículos enviados (PDF, DOCX e DOC).
 * - PDF: extração direta no navegador (pdfjs-dist)
 * - DOCX/DOC: envia para o servidor que converte para PDF (docx2pdf + Word)
 *   e extrai o texto do PDF gerado, removendo arquivos temporários ao final.
 * O arquivo nunca é armazenado permanentemente.
 */

export const TAMANHO_MAXIMO_IMPORT = 10 * 1024 * 1024;

export type TipoArquivoImport = "pdf" | "docx" | "doc";

export function tipoImportacao(nome: string): TipoArquivoImport | null {
  const n = nome.toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".docx")) return "docx";
  if (n.endsWith(".doc")) return "doc";
  return null;
}

export class ErroImportacao extends Error {}

async function textoDePdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default as string;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;

  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
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
  return partes.join("\n");
}

/** Converte DOC/DOCX para PDF no servidor e extrai texto do PDF gerado. */
async function converterDocNoServidor(file: File): Promise<string> {
  const base64 = await fileToBase64(file);
  const { converterDocParaPdf } = await import("@/lib/curriculo-conversao.server");
  const r = await converterDocParaPdf({ data: { arquivoBase64: base64, nomeArquivo: file.name } });
  if (!r.ok) {
    // Usar o erro detalhado se disponível
    const mensagem = r.detalhe || r.erro || "Erro desconhecido";
    const codigo = r.erro === "PDF_SEM_TEXTO" ? "PDF_SEM_TEXTO" : 
                   r.erro === "LIBREOFFICE_NAO_INSTALADO" ? "LIBREOFFICE_NAO_INSTALADO" : 
                   "FALHA_CONVERSAO";
    throw new ErroImportacao(`${codigo}: ${mensagem}`);
  }
  return r.texto!;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Lê o arquivo e devolve o texto extraído.
 * - PDF: extração local (pdfjs-dist)
 * - DOCX/DOC: conversão server-side para PDF + extração (docx2pdf + Word)
 */
export async function extrairTextoCurriculo(file: File): Promise<string> {
  const tipo = tipoImportacao(file.name);
  if (!tipo) throw new ErroImportacao("FORMATO_NAO_SUPORTADO");
  if (file.size > TAMANHO_MAXIMO_IMPORT) throw new ErroImportacao("ARQUIVO_GRANDE");

  let texto = "";
  try {
    if (tipo === "pdf") {
      texto = await textoDePdf(file);
    } else {
      // DOCX e DOC: conversão server-side para PDF + extração
      texto = await converterDocNoServidor(file);
    }
  } catch (e) {
    if (e instanceof ErroImportacao) throw e;
    throw new ErroImportacao("ARQUIVO_INVALIDO");
  }

  const limpo = texto.replace(/\u0000/g, "").trim();
  if (limpo.replace(/\s+/g, "").length < 60) {
    throw new ErroImportacao("SEM_TEXTO");
  }
  return limpo.slice(0, 40000);
}

export function mensagemErroImportacao(codigo: string): string {
  switch (codigo) {
    case "FORMATO_NAO_SUPORTADO":
      return "Formato não suportado. Envie um arquivo PDF, DOC ou DOCX.";
    case "ARQUIVO_GRANDE":
      return "Arquivo muito grande. O limite é de 10 MB.";
    case "PDF_SEM_TEXTO":
      return "Não foi possível ler o conteúdo deste arquivo. Tente enviar um PDF com melhor qualidade ou um arquivo Word.";
    case "DOC_ILEGIVEL":
      return "Não foi possível ler este arquivo .doc. Abra no Word e salve como DOCX ou PDF.";
    case "SEM_TEXTO":
      return "O documento não possui texto para leitura.";
    case "ARQUIVO_INVALIDO":
      return "Arquivo corrompido ou ilegível. Tente enviar outro arquivo.";
    case "LIBREOFFICE_NAO_INSTALADO":
      return "LibreOffice não está instalado no servidor. Necessário para converter DOC/DOCX para PDF. Contate o administrador.";
    case "FALHA_CONVERSAO":
      return "Falha ao converter o documento para PDF. Verifique se o arquivo não está corrompido e tente novamente.";
    case "IA_INDISPONIVEL":
      return "Não foi possível interpretar o currículo agora. Tente novamente em instantes.";
    case "IA_OCUPADA":
      return "O serviço de IA está ocupado neste momento. Tente novamente em alguns instantes.";
    case "IA_LIMITE":
      return "O limite de uso da IA foi atingido. Aguarde alguns minutos e tente novamente.";
    case "IA_CREDITOS":
      return "Os créditos de IA acabaram. Verifique a configuração na aba IA.";
    case "IA_CHAVE":
      return "A chave da IA foi recusada. Verifique a configuração na aba IA.";
    case "IA_MODELO":
      return "O modelo de IA configurado não está disponível para esta chave. Escolha outro na aba IA.";
    default:
      return "Não foi possível importar este currículo. Tente outro arquivo.";
  }
}
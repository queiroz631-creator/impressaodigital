/**
 * Extração de texto de currículos enviados (PDF, DOCX e tentativa em DOC).
 * Roda no navegador do usuário autenticado — o arquivo nunca é armazenado.
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

async function textoDeDocx(file: File): Promise<string> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const zip = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const doc = zip["word/document.xml"];
  if (!doc) throw new ErroImportacao("ARQUIVO_INVALIDO");
  const xml = strFromU8(doc);

  return xml
    .replace(/<w:tab[^>]*\/>/g, " ")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<\/w:tc>/g, " | ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x?[0-9a-fA-F]+;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** .doc antigo: tentativa de recuperar trechos legíveis do binário. */
async function textoDeDoc(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const bruto = new TextDecoder("latin1").decode(bytes);
  const legivel = bruto
    .replace(/[^\x20-\x7E\u00C0-\u00FF\n]/g, " ")
    .replace(/\s{3,}/g, "\n")
    .trim();
  const palavras = legivel.split(/\s+/).filter((p) => p.length > 2);
  if (palavras.length < 40) throw new ErroImportacao("DOC_ILEGIVEL");
  return legivel;
}

/** Lê o arquivo e devolve o texto extraído. */
export async function extrairTextoCurriculo(file: File): Promise<string> {
  const tipo = tipoImportacao(file.name);
  if (!tipo) throw new ErroImportacao("FORMATO_NAO_SUPORTADO");
  if (file.size > TAMANHO_MAXIMO_IMPORT) throw new ErroImportacao("ARQUIVO_GRANDE");

  let texto = "";
  try {
    if (tipo === "pdf") texto = await textoDePdf(file);
    else if (tipo === "docx") texto = await textoDeDocx(file);
    else texto = await textoDeDoc(file);
  } catch (e) {
    if (e instanceof ErroImportacao) throw e;
    throw new ErroImportacao(tipo === "doc" ? "DOC_ILEGIVEL" : "ARQUIVO_INVALIDO");
  }

  const limpo = texto.replace(/\u0000/g, "").trim();
  if (limpo.replace(/\s+/g, "").length < 60) {
    throw new ErroImportacao(tipo === "pdf" ? "PDF_SEM_TEXTO" : "SEM_TEXTO");
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
    case "IA_INDISPONIVEL":
      return "Não foi possível interpretar o currículo agora. Tente novamente em instantes.";
    default:
      return "Não foi possível importar este currículo. Tente outro arquivo.";
  }
}

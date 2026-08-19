import { tipoDoArquivo, type ArquivoDoc } from "./documento";

export interface ContagemArquivos {
  arquivos: ArquivoDoc[];
  ignorados: string[];
  /** Arquivos adicionados cuja quantidade de páginas precisa ser informada manualmente. */
  manuais: string[];
}

/**
 * Tenta ler a quantidade real de páginas de um .docx.
 * O DOCX é um ZIP; a propriedade <Pages> fica em docProps/app.xml e é gravada
 * pelo Word ao salvar. Quando o arquivo não traz essa informação, retornamos null
 * (nunca estimamos páginas pelo tamanho do arquivo).
 */
async function paginasDocx(file: File): Promise<number | null> {
  try {
    const { unzipSync, strFromU8 } = await import("fflate");
    const zip = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      filter: (f) => f.name === "docProps/app.xml",
    });
    const xml = zip["docProps/app.xml"];
    if (!xml) return null;
    const match = /<Pages>(\d+)<\/Pages>/.exec(strFromU8(xml));
    const paginas = match ? Number(match[1]) : 0;
    return paginas > 0 ? paginas : null;
  } catch {
    return null;
  }
}

export async function contarPaginas(files: File[]): Promise<ContagemArquivos> {
  const arquivos: ArquivoDoc[] = [];
  const ignorados: string[] = [];
  const manuais: string[] = [];
  const { PDFDocument } = await import("pdf-lib");

  for (const file of files) {
    const nomeMinusculo = file.name.toLowerCase();
    const ehPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const ehImagem = file.type.startsWith("image/");
    const ehDocx = nomeMinusculo.endsWith(".docx");
    const ehDoc = nomeMinusculo.endsWith(".doc");
    if (ehPdf) {
      try {
        const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
        arquivos.push({
          nome: file.name,
          tipo: tipoDoArquivo(file.name, file.type),
          paginas: doc.getPageCount(),
          copias: 1,
          frenteVerso: false,
        });
      } catch {
        ignorados.push(file.name);
      }
    } else if (ehImagem) {
      arquivos.push({
        nome: file.name,
        tipo: tipoDoArquivo(file.name, file.type),
        paginas: 1,
        copias: 1,
        frenteVerso: false,
      });
    } else if (ehDocx || ehDoc) {
      const paginas = ehDocx ? await paginasDocx(file) : null;
      if (paginas == null) manuais.push(file.name);
      arquivos.push({
        nome: file.name,
        tipo: tipoDoArquivo(file.name, file.type),
        paginas: paginas ?? 1,
        copias: 1,
        frenteVerso: false,
        paginasManuais: paginas == null,
      });
    } else {
      ignorados.push(file.name);
    }
  }

  return { arquivos, ignorados, manuais };
}

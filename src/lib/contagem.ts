import { tipoDoArquivo, type ArquivoDoc } from "./documento";

export interface ContagemArquivos {
  arquivos: ArquivoDoc[];
  ignorados: string[];
}

export async function contarPaginas(files: File[]): Promise<ContagemArquivos> {
  const arquivos: ArquivoDoc[] = [];
  const ignorados: string[] = [];
  const { PDFDocument } = await import("pdf-lib");

  for (const file of files) {
    const ehPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const ehImagem = file.type.startsWith("image/");
    if (ehPdf) {
      try {
        const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
        arquivos.push({
          nome: file.name,
          tipo: tipoDoArquivo(file.name, file.type),
          paginas: doc.getPageCount(),
        });
      } catch {
        ignorados.push(file.name);
      }
    } else if (ehImagem) {
      arquivos.push({ nome: file.name, tipo: tipoDoArquivo(file.name, file.type), paginas: 1 });
    } else {
      ignorados.push(file.name);
    }
  }

  return { arquivos, ignorados };
}

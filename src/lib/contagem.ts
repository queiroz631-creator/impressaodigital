export interface ContagemArquivos {
  arquivos: number;
  paginas: number;
  ignorados: string[];
}

export async function contarPaginas(files: File[]): Promise<ContagemArquivos> {
  let arquivos = 0;
  let paginas = 0;
  const ignorados: string[] = [];
  const { PDFDocument } = await import("pdf-lib");

  for (const file of files) {
    const ehPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const ehImagem = file.type.startsWith("image/");
    if (ehPdf) {
      try {
        const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
        arquivos += 1;
        paginas += doc.getPageCount();
      } catch {
        ignorados.push(file.name);
      }
    } else if (ehImagem) {
      arquivos += 1;
      paginas += 1;
    } else {
      ignorados.push(file.name);
    }
  }

  return { arquivos, paginas, ignorados };
}

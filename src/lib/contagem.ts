import { tipoDoArquivo, type ArquivoDoc } from "./documento";

export interface ContagemArquivos {
  arquivos: ArquivoDoc[];
  ignorados: string[];
  /** Arquivos adicionados cuja quantidade de páginas precisa ser informada manualmente. */
  manuais: string[];
}

export async function contarPaginas(files: File[]): Promise<ContagemArquivos> {
  const arquivos: ArquivoDoc[] = [];
  const ignorados: string[] = [];
  const manuais: string[] = [];
  const { PDFDocument } = await import("pdf-lib");

  for (const file of files) {
    const nomeMinusculo = file.name.toLowerCase();
    const ehPdf = file.type === "application/pdf" || nomeMinusculo.endsWith(".pdf");
    const ehImagem = file.type.startsWith("image/");
    const ehWord = nomeMinusculo.endsWith(".docx") || nomeMinusculo.endsWith(".doc");
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
    } else if (ehWord) {
      // Arquivos Word não permitem contagem confiável no navegador:
      // a quantidade de páginas é sempre informada manualmente.
      manuais.push(file.name);
      arquivos.push({
        nome: file.name,
        tipo: tipoDoArquivo(file.name, file.type),
        paginas: 0,
        copias: 1,
        frenteVerso: false,
        paginasManuais: true,
      });
    } else {
      ignorados.push(file.name);
    }
  }

  return { arquivos, ignorados, manuais };
}

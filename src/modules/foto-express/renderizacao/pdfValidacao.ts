// Leitura nativa (sem dependências) das páginas de PDFs gerados por pdfJpeg.ts.
export function lerPaginasPdf(bytes: Uint8Array): Array<{ width: number; height: number }> {
  const texto = new TextDecoder("latin1").decode(bytes);
  const paginas: Array<{ width: number; height: number }> = [];
  const regex = /\/Type\s*\/Page(?!s)[^]*?\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(texto))) {
    paginas.push({ width: Number(m[3]) - Number(m[1]), height: Number(m[4]) - Number(m[2]) });
  }
  return paginas;
}

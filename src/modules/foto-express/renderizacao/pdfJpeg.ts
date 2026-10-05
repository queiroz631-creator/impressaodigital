type PaginaJpeg = {
  bytes: Uint8Array;
  larguraPx: number;
  alturaPx: number;
  larguraPontos: number;
  alturaPontos: number;
};

const encoder = new TextEncoder();

function texto(valor: string) {
  return encoder.encode(valor);
}

function concatenar(partes: Uint8Array[]) {
  const tamanho = partes.reduce((total, parte) => total + parte.byteLength, 0);
  const resultado = new Uint8Array(tamanho);
  let posicao = 0;
  for (const parte of partes) {
    resultado.set(parte, posicao);
    posicao += parte.byteLength;
  }
  return resultado;
}

function objeto(numero: number, conteudo: Uint8Array) {
  return concatenar([
    texto(`${numero} 0 obj\n`),
    conteudo,
    texto("\nendobj\n"),
  ]);
}

function stream(dicionario: string, bytes: Uint8Array) {
  return concatenar([
    texto(`<< ${dicionario} /Length ${bytes.byteLength} >>\nstream\n`),
    bytes,
    texto("\nendstream"),
  ]);
}

function numeroPdf(valor: number) {
  if (!Number.isFinite(valor) || valor <= 0) throw new Error("Dimensão inválida para o PDF.");
  return valor.toFixed(4).replace(/\.?0+$/, "");
}

export function gerarPdfComJpegs(paginas: PaginaJpeg[]) {
  if (!paginas.length) throw new Error("O PDF não possui páginas.");

  const objetos: Uint8Array[] = [];
  const referenciasPaginas: string[] = [];
  const primeiraPagina = 3;

  for (let indice = 0; indice < paginas.length; indice += 1) {
    const pagina = paginas[indice];
    if (!pagina || pagina.bytes.byteLength < 4 || pagina.bytes[0] !== 0xff || pagina.bytes[1] !== 0xd8) {
      throw new Error(`A folha ${indice + 1} não contém uma imagem JPEG válida.`);
    }

    const numeroPagina = primeiraPagina + indice * 3;
    const numeroImagem = numeroPagina + 1;
    const numeroConteudo = numeroPagina + 2;
    const largura = numeroPdf(pagina.larguraPontos);
    const altura = numeroPdf(pagina.alturaPontos);
    const nomeImagem = `Im${indice + 1}`;
    const comandos = texto(`q\n${largura} 0 0 ${altura} 0 0 cm\n/${nomeImagem} Do\nQ\n`);

    referenciasPaginas.push(`${numeroPagina} 0 R`);
    objetos[numeroPagina] = objeto(numeroPagina, texto(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${largura} ${altura}] /Resources << /XObject << /${nomeImagem} ${numeroImagem} 0 R >> >> /Contents ${numeroConteudo} 0 R >>`,
    ));
    objetos[numeroImagem] = objeto(numeroImagem, stream(
      `/Type /XObject /Subtype /Image /Width ${pagina.larguraPx} /Height ${pagina.alturaPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,
      pagina.bytes,
    ));
    objetos[numeroConteudo] = objeto(numeroConteudo, stream("", comandos));
  }

  objetos[1] = objeto(1, texto("<< /Type /Catalog /Pages 2 0 R >>"));
  objetos[2] = objeto(2, texto(`<< /Type /Pages /Count ${paginas.length} /Kids [${referenciasPaginas.join(" ")}] >>`));

  const cabecalho = concatenar([texto("%PDF-1.7\n%"), new Uint8Array([0xe2, 0xe3, 0xcf, 0xd3]), texto("\n")]);
  const partes: Uint8Array[] = [cabecalho];
  const offsets: number[] = [0];
  let tamanho = cabecalho.byteLength;
  for (let numero = 1; numero < objetos.length; numero += 1) {
    const atual = objetos[numero];
    if (!atual) throw new Error("Estrutura incompleta ao montar o PDF.");
    offsets[numero] = tamanho;
    partes.push(atual);
    tamanho += atual.byteLength;
  }

  const inicioXref = tamanho;
  const xref = [
    `xref\n0 ${objetos.length}\n`,
    "0000000000 65535 f \n",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`,
  ].join("");
  partes.push(texto(xref));
  return concatenar(partes);
}
const TIPOS = new Set(["image/jpeg", "image/png", "image/webp"]);
export const LIMITE_ORIGINAL = 20 * 1024 * 1024;

export function validarImagem(arquivo: File) {
  if (!TIPOS.has(arquivo.type)) throw new Error(`${arquivo.name}: use JPG, PNG ou WEBP.`);
  if (arquivo.size > LIMITE_ORIGINAL) throw new Error(`${arquivo.name}: o limite é 20 MB.`);
}

export async function dimensoesImagem(arquivo: File) {
  const url = URL.createObjectURL(arquivo);
  try {
    const imagem = new Image();
    const carregada = new Promise<void>((resolve, reject) => {
      imagem.onload = () => resolve();
      imagem.onerror = () => reject(new Error(`${arquivo.name}: não foi possível ler a imagem.`));
    });
    imagem.src = url;
    await carregada;
    return { largura: imagem.naturalWidth, altura: imagem.naturalHeight, imagem };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function criarThumbnail(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * escala));
  canvas.height = Math.max(1, Math.round(bitmap.height * escala));
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("Não foi possível preparar a miniatura.");
  contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Não foi possível gerar a miniatura.")), "image/jpeg", 0.82));
}

export function nomeSeguro(nome: string) {
  const base = nome.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-");
  return base.replace(/-+/g, "-").slice(-100) || "foto";
}

/** Leitura e redimensionamento da foto de perfil do currículo (3x4). */

/** Proporção 2,5cm x 3,5cm usada na impressão/PDF. */
export const FOTO_LARGURA_PX = 300;
export const FOTO_ALTURA_PX = 420;

/**
 * Converte o arquivo escolhido em um JPEG pequeno (data URL), recortado no
 * formato 3x4 — leve o bastante para ser gravado junto com o currículo.
 */
export function lerFotoCurriculo(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = FOTO_LARGURA_PX;
        canvas.height = FOTO_ALTURA_PX;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Não foi possível processar a imagem."));
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Recorte "cover" centralizado, mantendo a proporção original.
        const escala = Math.max(canvas.width / img.width, canvas.height / img.height);
        const largura = img.width * escala;
        const altura = img.height * escala;
        ctx.drawImage(img, (canvas.width - largura) / 2, (canvas.height - altura) / 2, largura, altura);

        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(leitor.result);
    };
    leitor.readAsDataURL(arquivo);
  });
}

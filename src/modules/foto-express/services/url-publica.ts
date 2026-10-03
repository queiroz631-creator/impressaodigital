/** URL completa do portal público FOTO EXPRESS. */
export function urlPublicaFotoExpress(caminho = "/fotos"): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const rota = caminho.startsWith("/") ? caminho : `/${caminho}`;
  return base ? `${base}${rota}` : rota;
}
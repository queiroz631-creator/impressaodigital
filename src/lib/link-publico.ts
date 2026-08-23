/** Normaliza URLs públicas geradas no servidor (evita endereços locais). */

const HOSTS_LOCAIS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

export function urlPublica(url: string): string {
  if (typeof window === "undefined") return url;
  try {
    const alvo = new URL(url, window.location.origin);
    if (HOSTS_LOCAIS.has(alvo.hostname)) {
      return `${window.location.origin}${alvo.pathname}${alvo.search}${alvo.hash}`;
    }
    return alvo.toString();
  } catch {
    return url;
  }
}

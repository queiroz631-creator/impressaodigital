/**
 * URL pública do portal de Sorteios.
 *
 * A base nunca é escrita diretamente no código: vem de
 * `SORTEIOS_PUBLIC_URL` (servidor) ou `VITE_SORTEIOS_PUBLIC_URL` (navegador).
 * Sem a variável, usa a origem atual — o portal funciona em localhost,
 * no preview do Lovable e na publicação sem nenhuma configuração.
 */

function baseConfigurada(): string {
  const navegador =
    typeof import.meta !== "undefined"
      ? ((import.meta.env?.["VITE_SORTEIOS_PUBLIC_URL"] as string | undefined) ?? "")
      : "";
  const servidor = typeof process !== "undefined" ? (process.env["SORTEIOS_PUBLIC_URL"] ?? "") : "";
  return (navegador || servidor).trim().replace(/\/+$/, "");
}

/** URL completa do portal (ex.: https://sorteios.exemplo.com.br/sorteios-publico). */
export function urlPublicaSorteios(caminho = "/sorteios-publico"): string {
  const base = baseConfigurada() || (typeof window !== "undefined" ? window.location.origin : "");
  const rota = caminho.startsWith("/") ? caminho : `/${caminho}`;
  return base ? `${base}${rota}` : rota;
}

/**
 * Host configurado para o portal público (ex.: sorteios.exemplo.com.br),
 * ou null quando a variável não está definida — usado para redirecionar a
 * raiz do domínio público para o portal sem afetar localhost/preview.
 */
export function hostPublicoSorteios(): string | null {
  const configurada = baseConfigurada();
  if (!configurada) return null;
  try {
    return new URL(configurada).hostname;
  } catch {
    return null;
  }
}

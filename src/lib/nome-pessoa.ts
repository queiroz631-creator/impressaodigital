/**
 * Padronização do nome de pessoas (clientes e participantes).
 *
 * Mesmo comportamento de `texto()` em `api-local/app/utils/normalizacao.py`:
 * CAIXA ALTA, sem acentos, sem caracteres especiais e sem espaços repetidos.
 * Ex.: "joão d'ávila  silva" -> "JOAO DAVILA SILVA".
 */
export function normalizarNomePessoa(valor?: string | null): string {
  if (!valor) return "";
  const semAcento = valor
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  return semAcento
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

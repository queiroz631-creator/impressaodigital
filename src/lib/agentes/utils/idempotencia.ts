/**
 * Chaves de idempotência da Central de Agentes.
 *
 * Função pura: monta a chave estável usada em `agente_idempotencia` para
 * impressão, WhatsApp e alterações de dados. O banco continua sendo a fonte
 * da verdade (UNIQUE em `chave`); aqui só evitamos variações acidentais de
 * formato entre chamadas equivalentes.
 */
export function montarChaveIdempotencia(
  escopo: string,
  ...partes: Array<string | number | null | undefined>
): string {
  const limpas = partes
    .filter((p) => p !== null && p !== undefined)
    .map((p) => String(p).trim())
    .filter((p) => p.length > 0);
  return limpas.length ? `${escopo}:${limpas.join(":")}` : escopo;
}

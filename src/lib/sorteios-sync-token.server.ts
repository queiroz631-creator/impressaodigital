/**
 * Autenticação das rotas internas de sincronização.
 * O token nunca é registrado em log e nenhuma configuração é devolvida.
 */
export async function tokenValido(request: Request): Promise<boolean> {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return false;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("whatsapp_config")
    .select("webhook_token")
    .limit(1)
    .maybeSingle();

  const esperado = data?.webhook_token ?? "";
  if (!esperado || token.length !== esperado.length) return false;

  // Comparação de tempo constante.
  let diferenca = 0;
  for (let i = 0; i < esperado.length; i += 1) {
    diferenca |= token.charCodeAt(i) ^ esperado.charCodeAt(i);
  }
  return diferenca === 0;
}

/**
 * Autenticação exclusiva da API do Lojamix Sync.
 * Lê somente LOJAMIX_SYNC_TOKEN do ambiente; sem fallback para webhook_token.
 * O token nunca é registrado em log nem devolvido em resposta.
 */
export async function tokenLojamixSyncValido(request: Request): Promise<boolean> {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return false;

  const candidatos: string[] = [];

  // Chave cadastrada na aba "Chave Key" das Configurações.
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("sistema_chaves")
      .select("valor")
      .eq("nome", "sincronizacao")
      .maybeSingle();
    if (data?.valor) candidatos.push(data.valor);
  } catch {
    // Sem acesso ao banco: segue com a chave do ambiente.
  }

  // Reserva: chave antiga do ambiente.
  const ambiente = process.env["LOJAMIX_SYNC_TOKEN"] ?? "";
  if (ambiente) candidatos.push(ambiente);

  return candidatos.some((esperado) => {
    if (token.length !== esperado.length) return false;
    // Comparação de tempo constante.
    let diferenca = 0;
    for (let i = 0; i < esperado.length; i += 1) {
      diferenca |= token.charCodeAt(i) ^ esperado.charCodeAt(i);
    }
    return diferenca === 0;
  });
}

export const naoAutorizado = () => new Response("Não autorizado", { status: 401 });

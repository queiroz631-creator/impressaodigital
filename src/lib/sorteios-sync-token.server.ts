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

export const naoAutorizado = () => new Response("Não autorizado", { status: 401 });

/**
 * Configuração do webhook de uma conexão no provedor (somente servidor).
 *
 * Separação de responsabilidades: a lógica fica aqui (testável sem a camada
 * `createServerFn`) e as server functions ficam só com auth/administração.
 */

import {
  montarUrlWebhook,
  resolverBaseWebhook,
  urlWebhookCorresponde,
  validarBaseWebhook,
} from "@/lib/whatsapp/webhook-url";

/** Resultado simples das operações de configuração (mesmo contrato das server functions). */
export interface ResultadoSimples {
  ok: boolean;
  erro: string | null;
}

/** Endereço público da base dos webhooks (banco → `WHATSAPP_WEBHOOK_BASE_URL` → `SITE_URL` → fallback). */
export async function urlBaseWebhook(provedor: string): Promise<{ base: string | null; erro: string | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("whatsapp_config")
    .select("app_url")
    .limit(1)
    .maybeSingle();

  return resolverBaseWebhook({
    // A variável própria tem prioridade, exceto para conexões Z-API, cujo
    // endereço exibido/configurado permanece exatamente como estava.
    variavelAmbiente:
      provedor === "zapi" ? null : (process.env["WHATSAPP_WEBHOOK_BASE_URL"] ?? null),
    appUrl: (data as { app_url?: string | null } | null)?.app_url ?? null,
    siteUrl: process.env["SITE_URL"] ?? null,
  });
}

/**
 * Grava o endereço do webhook (com segredo) no provedor da conexão.
 * Valida a base pública (HTTPS) e a correspondência do caminho com o token.
 */
export async function reconfigurarWebhookConexao(conexaoId: string): Promise<ResultadoSimples> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("whatsapp_conexoes")
    .select("webhook_token, provedor")
    .eq("id", conexaoId)
    .maybeSingle();

  const registro = data as { webhook_token?: string | null; provedor?: string | null } | null;
  const token = registro?.webhook_token;
  if (!token) return { ok: false, erro: "Conexão não encontrada." };

  const provedor = registro?.provedor || "zapi";

  const { derivarSegredoWebhook } = await import("@/lib/whatsapp/providers/evolution-adapter.server");
  const segredo = derivarSegredoWebhook(token);
  if (!segredo) {
    return {
      ok: false,
      erro:
        "Defina WHATSAPP_WEBHOOK_SEGREDO (mín. 16 caracteres) no ambiente do servidor para autenticar o webhook da Evolution.",
    };
  }

  const { obterProvedorDaConexao } = await import("@/lib/whatsapp/providers/registro.server");
  const p = await obterProvedorDaConexao(conexaoId);
  if (!p.ok) return { ok: false, erro: p.erro.mensagem };

  const { base, erro: erroBase } = await urlBaseWebhook(provedor);
  if (!base) return { ok: false, erro: erroBase ?? "Endereço público do webhook não configurado." };

  const url = montarUrlWebhook(base, token);
  if (!validarBaseWebhook(base)) {
    return { ok: false, erro: "Endereço público do webhook deve usar HTTPS." };
  }
  // A URL aponta para ESTA conexão? Evita gravar (ou reconfigurar) um endereço
  // com token de outra conexão — cenário de origem cruzada.
  if (!urlWebhookCorresponde(url, token)) {
    return { ok: false, erro: "A URL gerada não corresponde a esta conexão." };
  }

  const r = await p.dados.configurarWebhook({ conexaoId }, { url, segredo });
  return r.ok ? { ok: true, erro: null } : { ok: false, erro: r.erro.mensagem };
}

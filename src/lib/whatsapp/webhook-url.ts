/**
 * Endereço público usado como base dos webhooks de WhatsApp. Módulo puro
 * (sem Supabase, sem rede) para ser testável isoladamente.
 *
 * `WHATSAPP_WEBHOOK_BASE_URL` tem PRIORIDADE sobre `whatsapp_config.app_url`,
 * `SITE_URL` e o fallback do domínio Lovable. É ela que permite apontar os
 * webhooks para um endereço público temporário (ex.: túnel do Cloudflare)
 * enquanto o sistema roda localmente, sem tocar no `SITE_URL` do restante
 * do sistema.
 *
 * Quando a variável está ausente, o comportamento anterior é preservado.
 */

/** Fallback usado quando nada está configurado (comportamento anterior). */
export const BASE_WEBHOOK_PADRAO = "https://impressaodigital.lovable.app";

const PADRAO_CAMINHO_WEBHOOK = /^\/api\/public\/whatsapp\/webhook\/([A-Za-z0-9_-]+)$/;
const HOST_LOCAL = /^(localhost|127(\.\d{1,3}){3}|::1|0\.0\.0\.0)$/i;

/** Parseia a base e recusa tudo que não for a origem (caminho, query, hash, credenciais). */
function parsear(bruto: string): { url: URL | null; erro: string | null } {
  const limpo = bruto.trim().replace(/\/+$/, "");
  if (!limpo) return { url: null, erro: "Base vazia." };

  let url: URL;
  try {
    url = new URL(limpo);
  } catch {
    return { url: null, erro: "A base não é uma URL válida." };
  }

  if (url.username || url.password) {
    return { url: null, erro: "A base do webhook não pode conter usuário ou senha." };
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    return { url: null, erro: "A base deve ser somente a origem (https://host), sem caminho, query ou hash." };
  }

  return { url, erro: null };
}

/**
 * Normaliza uma base removendo a barra final.
 * Uma base só faz sentido como origem (`https://host[:porta]`); caminho,
 * query e hash são rejeitados, pois mudariam o endereço do webhook.
 */
function normalizarBase(bruto: string): { base: string | null; erro: string | null } {
  const { url, erro } = parsear(bruto);
  if (!url) return { base: null, erro };

  if (url.protocol !== "https:") {
    return { base: null, erro: "A base do webhook deve usar HTTPS." };
  }
  if (HOST_LOCAL.test(url.hostname)) {
    // A Evolution precisa alcançar o endereço pela internet; localhost nunca serve.
    return { base: null, erro: "A base do webhook não pode ser um endereço local (localhost/127.0.0.1)." };
  }

  // A origem reconstruída normaliza a porta padrão (https://h:443 → https://h).
  return { base: new URL(url.origin).origin, erro: null };
}

/**
 * Resolve a base pública dos webhooks a partir de uma origem configurada.
 * Valida HTTPS e origem limpa; devolve `null` quando a origem não é aceitável.
 */
export function validarBaseWebhook(bruto: string): string | null {
  const { base } = normalizarBase(bruto);
  return base;
}

/**
 * Base efetiva dos webhooks. `WHATSAPP_WEBHOOK_BASE_URL` é usada primeiro,
 * quando estiver definida; depois a origem informada (ex.: `app_url` do
 * banco, `SITE_URL`) e por fim o fallback histórico.
 */
export function resolverBaseWebhook(opcoes: {
  /** Valor de `WHATSAPP_WEBHOOK_BASE_URL`. */
  variavelAmbiente?: string | null;
  /** `whatsapp_config.app_url` (comportamento anterior). */
  appUrl?: string | null;
  /** `SITE_URL` (comportamento anterior). */
  siteUrl?: string | null;
}): { base: string | null; erro: string | null } {
  const variavel = opcoes.variavelAmbiente?.trim();
  if (variavel) {
    // Variável definida pobremente não cai silenciosamente no `SITE_URL`:
    // avisar é melhor do que gravar um webhook que não recebe eventos.
    const { base, erro } = normalizarBase(variavel);
    if (!base) {
      return {
        base: null,
        erro: `WHATSAPP_WEBHOOK_BASE_URL inválida: ${erro} Corrija a variável de ambiente.`,
      };
    }
    return { base, erro: null };
  }

  // Caminho legado (comportamento anterior): `app_url` e `SITE_URL` são usados
  // como texto, sem exigência de HTTPS — quem os define já cuidava disso.
  // Uma base legada malformada cai no fallback, como antes.
  const legado = (opcoes.appUrl?.trim() || opcoes.siteUrl?.trim() || "").replace(/\/+$/, "");
  return { base: legado || BASE_WEBHOOK_PADRAO, erro: null };
}

/** Monta o endereço do webhook de uma conexão a partir da base. */
export function montarUrlWebhook(base: string, token: string): string {
  return `${base.replace(/\/+$/, "")}/api/public/whatsapp/webhook/${token}`;
}

/** Confere se a URL gerada corresponde ao caminho esperado para aquele token. */
export function urlWebhookCorresponde(url: string, token: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const m = PADRAO_CAMINHO_WEBHOOK.exec(u.pathname);
    return Boolean(m && m[1] === token && !u.search && !u.hash);
  } catch {
    return false;
  }
}

/**
 * Nome da instância declarado no corpo do evento, quando houver.
 * A Evolution v2 manda `instance` como texto (`"instance": "nome"`); algumas
 * versões aninham o objeto (`{"instance": {"instanceName": "nome"}}`). Os dois
 * formatos são aceitos.
 */
export function instanciaDoEvento(evento: unknown): string | null {
  const instancia = (evento as { instance?: unknown } | null)?.instance;
  if (typeof instancia === "string") return instancia || null;
  const aninhada = (instancia as { instanceName?: unknown } | null)?.instanceName;
  return typeof aninhada === "string" && aninhada ? aninhada : null;
}

/** Confere se a instância do evento é a esperada pela conexão. */
export function instanciaConfere(evento: unknown, instanciaEsperada: string | null | undefined): boolean {
  if (!instanciaEsperada) return true;
  const doEvento = instanciaDoEvento(evento);
  if (!doEvento) return true; // sem informação: a autenticação pelo segredo já vale
  return doEvento === instanciaEsperada;
}

/**
 * Registro dos provedores disponíveis e resolução do provedor de uma conexão.
 * Somente servidor.
 *
 * Provedores registrados: Z-API e Evolution API. Uma conexão marcada com um
 * provedor sem adaptador recebe erro `nao_configurado` — nunca cai
 * silenciosamente em outro provedor.
 */

import { evolutionAdapter } from "./evolution-adapter.server";
import { zapiAdapter } from "./zapi-adapter.server";
import type { ProvedorId, ProvedorWhatsApp, Resultado } from "./tipos";

const ADAPTADORES = new Map<ProvedorId, ProvedorWhatsApp>([
  ["zapi", zapiAdapter],
  ["evolution", evolutionAdapter],
]);

export type ResolvedorProvedor = (conexaoId: string | null) => Promise<ProvedorId | string>;

const TTL_CACHE_MS = 30_000;
const cacheProvedor = new Map<string, { provedor: string; expira: number }>();

/**
 * Resolvedor padrão: lê `whatsapp_conexoes.provedor` (cache curto). Sem
 * conexão, sem a coluna (migração ainda não aplicada), sem valor ou em
 * qualquer erro, o provedor é `zapi` — as conexões existentes nunca mudam de
 * comportamento por falha de leitura.
 */
const resolvedorPadrao: ResolvedorProvedor = async (conexaoId) => {
  if (!conexaoId) return "zapi";

  const emCache = cacheProvedor.get(conexaoId);
  if (emCache && emCache.expira > Date.now()) return emCache.provedor;

  let provedor = "zapi";
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("whatsapp_conexoes")
      .select("provedor")
      .eq("id", conexaoId)
      .maybeSingle();
    const lido = (data as { provedor?: string | null } | null)?.provedor;
    if (!error && lido) provedor = lido;
  } catch {
    /* mantém zapi */
  }

  cacheProvedor.set(conexaoId, { provedor, expira: Date.now() + TTL_CACHE_MS });
  return provedor;
};

let resolvedor: ResolvedorProvedor = resolvedorPadrao;

/** Substitui o resolvedor (testes) ou restaura o padrão com `null`. Limpa o cache. */
export function definirResolvedorDeProvedor(novo: ResolvedorProvedor | null): void {
  resolvedor = novo ?? resolvedorPadrao;
  cacheProvedor.clear();
}

/** Descarta o cache (ex.: depois de trocar o provedor de uma conexão). */
export function limparCacheDeProvedor(conexaoId?: string): void {
  if (conexaoId) cacheProvedor.delete(conexaoId);
  else cacheProvedor.clear();
}

export function registrarProvedor(adaptador: ProvedorWhatsApp): void {
  ADAPTADORES.set(adaptador.id, adaptador);
}

export function provedoresRegistrados(): ProvedorId[] {
  return [...ADAPTADORES.keys()];
}

export function obterProvedorPorId(id: string): ProvedorWhatsApp | null {
  return ADAPTADORES.get(id as ProvedorId) ?? null;
}

export async function obterProvedorDaConexao(conexaoId: string | null): Promise<Resultado<ProvedorWhatsApp>> {
  let id: string;
  try {
    id = await resolvedor(conexaoId);
  } catch (e) {
    return {
      ok: false,
      erro: {
        codigo: "desconhecido",
        mensagem: e instanceof Error ? e.message : "Falha ao identificar o provedor da conexão.",
        httpStatus: null,
        retentavel: true,
      },
    };
  }

  const adaptador = obterProvedorPorId(id);
  if (!adaptador) {
    return {
      ok: false,
      erro: {
        codigo: "nao_configurado",
        mensagem: `O provedor "${id}" não está disponível neste servidor.`,
        httpStatus: null,
        retentavel: false,
      },
    };
  }
  return { ok: true, dados: adaptador };
}

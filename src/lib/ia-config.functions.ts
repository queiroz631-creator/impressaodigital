import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Configuração do provedor de IA (aba "IA" das Configurações).
 *
 * Tudo é decidido no servidor: permissão, gravação da chave (em tabela
 * acessível somente pelo service_role) e o teste real de conexão.
 * A chave nunca volta para o navegador.
 */

type Cliente = SupabaseClient<Database>;

const PROVEDORES = ["lovable_openai", "lovable_gemini", "openai_proprio", "gemini_proprio"] as const;
type Provedor = (typeof PROVEDORES)[number];

/** Somente administradores mexem nas configurações do sistema. */
async function exigirAdmin(context: { supabase: Cliente; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Somente administradores podem alterar as configurações.");
}

const esquemaConfig = z.object({
  provedor: z.enum(PROVEDORES),
  modelo: z.string().trim().max(120).optional().nullable(),
  modeloAudio: z.string().trim().max(120).optional().nullable(),
});

export interface EstadoIA {
  provedor: Provedor;
  modelo: string | null;
  modeloAudio: string | null;
  /** Indica apenas se existe chave gravada (nunca o valor). */
  chaveOpenai: boolean;
  chaveGemini: boolean;
}

/** Estado atual da configuração de IA (sem nenhuma chave). */
export const estadoIA = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EstadoIA> => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: config } = await supabaseAdmin
      .from("configuracoes")
      .select("ia_provedor, ia_modelo, ia_modelo_audio")
      .limit(1)
      .maybeSingle();

    const { data: chaves } = await supabaseAdmin.from("ia_credenciais").select("provedor");
    const temChave = (p: string) => (chaves ?? []).some((c) => c.provedor === p);

    const provedor = (PROVEDORES as readonly string[]).includes(config?.ia_provedor ?? "")
      ? (config?.ia_provedor as Provedor)
      : "lovable_openai";

    return {
      provedor,
      modelo: config?.ia_modelo ?? null,
      modeloAudio: config?.ia_modelo_audio ?? null,
      chaveOpenai: temChave("openai_proprio"),
      chaveGemini: temChave("gemini_proprio"),
    };
  });

/** Salva provedor e modelos escolhidos. */
export const salvarConfiguracaoIA = createServerFn({ method: "POST" })
  .validator((input: unknown) => esquemaConfig.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { limparCacheIA } = await import("@/lib/ia-chave.server");

    const payload = {
      ia_provedor: data.provedor,
      ia_modelo: data.modelo?.trim() ? data.modelo.trim() : null,
      ia_modelo_audio: data.modeloAudio?.trim() ? data.modeloAudio.trim() : null,
    };

    const { data: existente } = await supabaseAdmin
      .from("configuracoes")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (existente) {
      const { error } = await supabaseAdmin
        .from("configuracoes")
        .update(payload)
        .eq("id", existente.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("configuracoes").insert(payload);
      if (error) throw new Error(error.message);
    }

    limparCacheIA();
    return { ok: true as const };
  });

/** Grava (ou substitui) a chave própria de um provedor. */
export const salvarChaveIA = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        provedor: z.enum(["openai_proprio", "gemini_proprio"]),
        chave: z.string().trim().min(10, "Chave muito curta.").max(400),
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { limparCacheIA } = await import("@/lib/ia-chave.server");

    const { error } = await supabaseAdmin.from("ia_credenciais").upsert(
      {
        provedor: data.provedor,
        chave: data.chave,
        atualizado_em: new Date().toISOString(),
        atualizado_por: context.userId,
      },
      { onConflict: "provedor" },
    );
    if (error) throw new Error(error.message);

    limparCacheIA();
    return { ok: true as const };
  });

/** Remove a chave própria de um provedor. */
export const removerChaveIA = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ provedor: z.enum(["openai_proprio", "gemini_proprio"]) }).parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { limparCacheIA } = await import("@/lib/ia-chave.server");

    const { error } = await supabaseAdmin
      .from("ia_credenciais")
      .delete()
      .eq("provedor", data.provedor);
    if (error) throw new Error(error.message);

    limparCacheIA();
    return { ok: true as const };
  });

/** Mensagem em português para os erros mais comuns dos provedores. */
function explicarErro(status: number, bruto: string): string {
  const texto = bruto.slice(0, 400);
  if (status === 0) return "Não foi possível falar com o provedor de IA (sem chave ou sem rede).";
  if (status === 401) return "Chave de API inválida ou não autorizada.";
  if (status === 402) return "Sem créditos de IA disponíveis. Faça uma recarga para continuar.";
  if (status === 403) return "Acesso negado pelo provedor para este modelo.";
  if (status === 404) return "Modelo não encontrado. Confira o nome do modelo informado.";
  if (status === 429) return "Limite de uso atingido. Tente novamente em alguns instantes.";
  if (status >= 500) return "O provedor de IA está indisponível neste momento.";
  return `O provedor recusou a chamada (código ${status}). ${texto}`;
}

/** Faz uma chamada curta de verdade com a configuração salva. */
export const testarIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context);
    const { gerarTextoIA, limparCacheIA, resolverConfigIA } = await import(
      "@/lib/ia-chave.server"
    );
    limparCacheIA();

    const cfg = await resolverConfigIA();
    const r = await gerarTextoIA(
      "Responda somente com a palavra OK, sem pontuação.",
      "Teste de conexão.",
      {},
    );

    if (r.conteudo)
      return {
        ok: true as const,
        provedor: cfg.provedor,
        modelo: cfg.modeloTexto,
        resposta: r.conteudo.slice(0, 120),
      };

    return {
      ok: false as const,
      provedor: cfg.provedor,
      modelo: cfg.modeloTexto,
      mensagem: explicarErro(r.status, r.erroBruto ?? ""),
    };
  });

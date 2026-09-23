import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Chaves do sistema (aba "Chave Key" das Configurações).
 * A chave completa só é devolvida na função verChave, e sempre para administrador.
 */

type Cliente = SupabaseClient<Database>;

/** Somente administradores mexem nas chaves do sistema. */
async function exigirAdmin(context: { supabase: Cliente; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Somente administradores podem alterar as chaves do sistema.");
}

export interface ChaveResumo {
  nome: string;
  urlBase: string;
  /** Últimos 4 caracteres da chave, para conferência. */
  final4: string;
  temChave: boolean;
  atualizadoEm: string | null;
}

/** Lista das chaves cadastradas, sem revelar os valores. */
export const listarChaves = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChaveResumo[]> => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("sistema_chaves")
      .select("nome, valor, url_base, atualizado_em")
      .order("nome");
    if (error) throw new Error(error.message);

    return (data ?? []).map((c) => ({
      nome: c.nome,
      urlBase: c.url_base ?? "",
      final4: (c.valor ?? "").slice(-4),
      temChave: Boolean(c.valor),
      atualizadoEm: c.atualizado_em ?? null,
    }));
  });

/** Valor completo de uma chave (para copiar e configurar o app da loja). */
export const verChave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { nome: string }) => z.object({ nome: z.string().trim().min(1) }).parse(input))
  .handler(async ({ data, context }): Promise<{ valor: string }> => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: linha, error } = await supabaseAdmin
      .from("sistema_chaves")
      .select("valor")
      .eq("nome", data.nome)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { valor: linha?.valor ?? "" };
  });

const esquemaSalvar = z.object({
  nome: z.string().trim().min(1),
  valor: z.string().trim().max(200),
  urlBase: z.string().trim().max(300),
});

/** Grava a chave e a URL base informadas. */
export const salvarChave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => esquemaSalvar.parse(input))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);

    const url = data.urlBase.replace(/\/+$/, "");
    if (url && !/^https?:\/\/[^\s]+$/i.test(url)) {
      throw new Error("Informe a URL completa, começando com https://");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("sistema_chaves").upsert(
      {
        nome: data.nome,
        valor: data.valor,
        url_base: url,
        atualizado_em: new Date().toISOString(),
        atualizado_por: context.userId,
      },
      { onConflict: "nome" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Gera uma chave aleatória forte e devolve o valor (não grava). */
export const gerarChave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ valor: string }> => {
    await exigirAdmin(context);
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const valor = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return { valor };
  });

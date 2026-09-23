import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

/**
 * Logo exibida no topo do portal público de sorteios.
 *
 * O arquivo fica no bucket privado "portal-sorteios" e o portal recebe apenas
 * um endereço temporário (assinado). Sem arquivo gravado, o portal usa a logo
 * padrão que já vem no código.
 */

const BUCKET = "portal-sorteios";
const TIPOS = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;
const EXTENSAO: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
const LIMITE_BYTES = 2 * 1024 * 1024;

type Cliente = SupabaseClient<Database>;

/** Exige administrador OU permissão sensível de gerenciamento de sorteios. */
async function exigirGestao(context: { supabase: Cliente; userId: string }) {
  const { data: isAdmin, error: erroRole } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (erroRole) throw new Error(erroRole.message);
  if (isAdmin) return;

  const { data: permitido, error } = await context.supabase.rpc("tem_permissao", {
    _user_id: context.userId,
    _chave: "sorteios.gerenciar",
  });
  if (error) throw new Error(error.message);
  if (!permitido) throw new Error("Você não tem permissão para gerenciar sorteios.");
}

/** Caminho gravado em configuracoes.sorteio_logo_url (vazio = logo padrão). */
async function caminhoGravado(): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("configuracoes")
    .select("id, sorteio_logo_url")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.sorteio_logo_url ?? "";
}

/** Endereço temporário do arquivo (12 h) ou null quando não há logo enviada. */
async function urlAssinada(caminho: string): Promise<string | null> {
  if (!caminho) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(caminho, 60 * 60 * 12);
  return data?.signedUrl ?? null;
}

export interface LogoPortal {
  /** Endereço para exibir a imagem; null = usar a logo padrão do código. */
  url: string | null;
  /** true quando existe uma logo enviada pela loja. */
  personalizada: boolean;
}

/** Logo do portal — pública, usada pelas telas do participante (sem login). */
export const logoPortalPublica = createServerFn({ method: "GET" }).handler(
  async (): Promise<LogoPortal> => {
    try {
      const caminho = await caminhoGravado();
      const url = await urlAssinada(caminho);
      return { url, personalizada: Boolean(url) };
    } catch {
      return { url: null, personalizada: false };
    }
  },
);

/** Logo atual para a tela administrativa de Sorteios. */
export const logoPortalAtual = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LogoPortal> => {
    await exigirGestao(context);
    const caminho = await caminhoGravado();
    const url = await urlAssinada(caminho);
    return { url, personalizada: Boolean(caminho) };
  });

const esquemaSalvar = z.object({
  /** Conteúdo do arquivo em base64, sem o prefixo "data:". */
  base64: z.string().min(16),
  tipo: z.enum(TIPOS),
});

/** Grava (ou troca) a logo mostrada no portal de sorteios. */
export const salvarLogoSorteio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { base64: string; tipo: string }) => esquemaSalvar.parse(input))
  .handler(async ({ data, context }): Promise<LogoPortal> => {
    await exigirGestao(context);

    const binario = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    if (binario.byteLength === 0) throw new Error("Arquivo vazio.");
    if (binario.byteLength > LIMITE_BYTES) throw new Error("A imagem precisa ter até 2 MB.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const caminho = `logo-${Date.now()}.${EXTENSAO[data.tipo] ?? "png"}`;

    const { error: erroUpload } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(caminho, binario, { contentType: data.tipo, upsert: true });
    if (erroUpload) throw new Error(erroUpload.message);

    const anterior = await caminhoGravado();

    const { data: cfg, error: erroCfg } = await supabaseAdmin
      .from("configuracoes")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (erroCfg) throw new Error(erroCfg.message);

    if (cfg?.id) {
      const { error } = await supabaseAdmin
        .from("configuracoes")
        .update({ sorteio_logo_url: caminho })
        .eq("id", cfg.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("configuracoes")
        .insert({ sorteio_logo_url: caminho });
      if (error) throw new Error(error.message);
    }

    if (anterior && anterior !== caminho) {
      await supabaseAdmin.storage.from(BUCKET).remove([anterior]);
    }

    await context.supabase.from("sorteio_auditoria").insert({
      sorteio_id: null,
      evento: "sorteio.logo_alterada",
      origem: "painel",
      usuario_id: context.userId,
      detalhe: { arquivo: caminho, anterior: anterior || null } as Json,
    });

    const url = await urlAssinada(caminho);
    return { url, personalizada: true };
  });

/** Remove a logo enviada e volta à logo padrão do sistema. */
export const limparLogoSorteio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LogoPortal> => {
    await exigirGestao(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const anterior = await caminhoGravado();

    const { data: cfg } = await supabaseAdmin
      .from("configuracoes")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (cfg?.id) {
      const { error } = await supabaseAdmin
        .from("configuracoes")
        .update({ sorteio_logo_url: null })
        .eq("id", cfg.id);
      if (error) throw new Error(error.message);
    }
    if (anterior) await supabaseAdmin.storage.from(BUCKET).remove([anterior]);

    await context.supabase.from("sorteio_auditoria").insert({
      sorteio_id: null,
      evento: "sorteio.logo_alterada",
      origem: "painel",
      usuario_id: context.userId,
      detalhe: { arquivo: null, anterior: anterior || null } as Json,
    });

    return { url: null, personalizada: false };
  });

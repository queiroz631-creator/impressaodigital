import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const BUCKET = "foto-express-thumbnails";
const TIPOS = ["image/png", "image/jpeg", "image/webp"] as const;
const EXTENSAO: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const LIMITE_BYTES = 2 * 1024 * 1024;
type Cliente = SupabaseClient<Database>;

async function exigirGestao(context: { supabase: Cliente }) {
  const { data: permitido, error } = await context.supabase.rpc("pode_foto_express", { _chave: "foto_express.trabalhos.editar" });
  if (error) throw new Error(error.message);
  if (!permitido) throw new Error("Você não tem permissão para gerenciar o FOTO EXPRESS.");
}

async function configuracao() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("configuracoes").select("id, foto_express_logo_url").limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function urlAssinada(caminho: string): Promise<string | null> {
  if (!caminho) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(caminho, 60 * 60 * 12);
  return data?.signedUrl ?? null;
}

export interface LogoPortalFotos { url: string | null; personalizada: boolean }

export const logoPortalFotosPublica = createServerFn({ method: "GET" }).handler(async (): Promise<LogoPortalFotos> => {
  try {
    const cfg = await configuracao();
    const caminho = cfg?.foto_express_logo_url ?? "";
    const url = await urlAssinada(caminho);
    return { url, personalizada: Boolean(url) };
  } catch { return { url: null, personalizada: false }; }
});

export const logoPortalFotosAtual = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }): Promise<LogoPortalFotos> => {
  await exigirGestao(context);
  const cfg = await configuracao();
  const caminho = cfg?.foto_express_logo_url ?? "";
  return { url: await urlAssinada(caminho), personalizada: Boolean(caminho) };
});

const esquemaSalvar = z.object({ base64: z.string().min(16), tipo: z.enum(TIPOS) });
export const salvarLogoPortalFotos = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: { base64: string; tipo: string }) => esquemaSalvar.parse(input)).handler(async ({ data, context }): Promise<LogoPortalFotos> => {
  await exigirGestao(context);
  const binario = Uint8Array.from(atob(data.base64), (caractere) => caractere.charCodeAt(0));
  if (!binario.byteLength) throw new Error("Arquivo vazio.");
  if (binario.byteLength > LIMITE_BYTES) throw new Error("A imagem precisa ter até 2 MB.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const caminho = `portal/logo-${Date.now()}.${EXTENSAO[data.tipo] ?? "png"}`;
  const { error: erroUpload } = await supabaseAdmin.storage.from(BUCKET).upload(caminho, binario, { contentType: data.tipo, upsert: false });
  if (erroUpload) throw new Error(erroUpload.message);
  const anterior = await configuracao();
  const valores = { foto_express_logo_url: caminho };
  const resultado = anterior?.id ? await supabaseAdmin.from("configuracoes").update(valores).eq("id", anterior.id) : await supabaseAdmin.from("configuracoes").insert(valores);
  if (resultado.error) { await supabaseAdmin.storage.from(BUCKET).remove([caminho]); throw new Error(resultado.error.message); }
  if (anterior?.foto_express_logo_url && anterior.foto_express_logo_url !== caminho) await supabaseAdmin.storage.from(BUCKET).remove([anterior.foto_express_logo_url]);
  return { url: await urlAssinada(caminho), personalizada: true };
});

export const limparLogoPortalFotos = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }): Promise<LogoPortalFotos> => {
  await exigirGestao(context);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const anterior = await configuracao();
  if (anterior?.id) {
    const { error } = await supabaseAdmin.from("configuracoes").update({ foto_express_logo_url: null }).eq("id", anterior.id);
    if (error) throw new Error(error.message);
  }
  if (anterior?.foto_express_logo_url) await supabaseAdmin.storage.from(BUCKET).remove([anterior.foto_express_logo_url]);
  return { url: null, personalizada: false };
});
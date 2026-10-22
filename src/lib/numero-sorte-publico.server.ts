/**
 * Portal público do Nº da Sorte — somente servidor.
 * Usa o cliente administrativo porque não há usuário logado; cada operação
 * valida a sessão (cookie HttpOnly) e nunca confia em IDs do navegador.
 */
import { createHash, randomBytes } from "crypto";
import { getCookie, getRequest, getRequestIP, setResponseHeader } from "@tanstack/react-start/server";

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export class ErroPublico extends Error {
  constructor(public codigo: string, mensagem: string) {
    super(mensagem);
  }
}

const COOKIE = "ns_sessao";
const TTL_MS = 4 * 60 * 60 * 1000;
export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export function ipHash(): string {
  let ip = "desconhecido";
  try {
    ip = getRequestIP({ xForwardedFor: true }) ?? ip;
  } catch {
    /* sem IP */
  }
  return sha256(`ns:${ip}`);
}

function cookie(valor: string, maxAge: number) {
  let seguro = "; Secure";
  try {
    if (!getRequest().url.startsWith("https:")) seguro = "";
  } catch {
    /* mantém Secure */
  }
  return `${COOKIE}=${valor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${seguro}`;
}

export async function criarSessao(campanhaId: string, clienteId: string) {
  const supabase = await admin();
  const token = randomBytes(32).toString("base64url");
  const { error } = await supabase.from("numero_sorte_sessoes").insert({
    token_hash: sha256(token),
    campanha_id: campanhaId,
    cliente_id: clienteId,
    expira_em: new Date(Date.now() + TTL_MS).toISOString(),
  });
  if (error) throw new ErroPublico("ERRO", "Não foi possível iniciar sua participação. Tente novamente.");
  setResponseHeader("Set-Cookie", cookie(token, TTL_MS / 1000));
}

/** Cliente da sessão, desde que seja da mesma campanha e esteja válida. */
export async function clienteDaSessao(campanhaId: string): Promise<string | null> {
  const token = getCookie(COOKIE);
  if (!token) return null;
  const supabase = await admin();
  const { data } = await supabase
    .from("numero_sorte_sessoes")
    .select("cliente_id, campanha_id, expira_em")
    .eq("token_hash", sha256(token))
    .maybeSingle();
  if (!data || data.campanha_id !== campanhaId || new Date(data.expira_em) < new Date()) return null;
  return data.cliente_id;
}

export function encerrarSessao() {
  setResponseHeader("Set-Cookie", cookie("", 0));
}

/** Limite por aparelho/IP numa janela de 10 minutos. */
export async function limitarIp(acao: string, maximo: number) {
  const supabase = await admin();
  const h = ipHash();
  await supabase.from("numero_sorte_tentativas").insert({ acao, ip_hash: h });
  const { count } = await supabase
    .from("numero_sorte_tentativas")
    .select("id", { count: "exact", head: true })
    .eq("acao", acao)
    .eq("ip_hash", h)
    .gte("criado_em", new Date(Date.now() - 10 * 60 * 1000).toISOString());
  if ((count ?? 0) > maximo) {
    await supabase.from("numero_sorte_auditoria").insert({
      evento: "atividade_suspeita",
      detalhe: { acao, ip_hash: h.slice(0, 12) },
    });
    throw new ErroPublico("LIMITE", "Muitas tentativas. Aguarde alguns minutos e tente novamente.");
  }
}

export function normalizarTelefone(v?: string | null): string {
  let d = (v ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  return d;
}

export async function urlAssinada(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await admin();
  const { data } = await supabase.storage.from("numero-sorte-divulgacao").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

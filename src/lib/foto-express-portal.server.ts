import { createHash, randomBytes } from "crypto";
import { getCookie, getRequest, getRequestIP, setResponseHeader } from "@tanstack/react-start/server";

export class ErroPortalFotos extends Error {
  constructor(public codigo: string, mensagem: string) { super(mensagem); }
}

const COOKIE_SESSAO = "fe_sessao";
const COOKIE_DISPOSITIVO = "fe_dispositivo";
const SESSAO_TTL = 2 * 60 * 60 * 1000;
const DISPOSITIVO_TTL = 30 * 24 * 60 * 60 * 1000;
const hash = (valor: string) => createHash("sha256").update(valor).digest("hex");
const token = () => randomBytes(32).toString("base64url");

export async function fotoPortalAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function ipPedido() {
  try { return getRequestIP({ xForwardedFor: true }) ?? "desconhecido"; }
  catch { return "desconhecido"; }
}

function cookie(nome: string, valor: string, segundos: number) {
  let seguro = true;
  try { seguro = getRequest().url.startsWith("https:"); } catch { seguro = true; }
  return `${nome}=${valor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${segundos}${seguro ? "; Secure" : ""}`;
}

function definirCookies(sessao: string, dispositivo: string | null) {
  const valores = [cookie(COOKIE_SESSAO, sessao, SESSAO_TTL / 1000)];
  if (dispositivo) valores.push(cookie(COOKIE_DISPOSITIVO, dispositivo, DISPOSITIVO_TTL / 1000));
  setResponseHeader("Set-Cookie", valores);
}

export async function criarSessaoFotos(clienteId: string, lembrar: boolean) {
  const admin = await fotoPortalAdmin();
  const agora = Date.now();
  const sessao = token();
  const dispositivo = lembrar ? token() : null;
  let userAgent: string | null = null;
  try { userAgent = getRequest().headers.get("user-agent")?.slice(0, 300) ?? null; } catch { userAgent = null; }
  const { error } = await admin.from("foto_express_portal_sessoes").insert({
    cliente_id: clienteId, token_hash: hash(sessao), renovacao_hash: dispositivo ? hash(dispositivo) : null,
    expira_em: new Date(agora + SESSAO_TTL).toISOString(), renovacao_expira_em: dispositivo ? new Date(agora + DISPOSITIVO_TTL).toISOString() : null,
    ip: ipPedido(), user_agent: userAgent,
  });
  if (error) throw new ErroPortalFotos("ERRO", "Não foi possível iniciar sua sessão.");
  definirCookies(sessao, dispositivo);
}

export async function carregarSessaoFotos() {
  const admin = await fotoPortalAdmin();
  const agora = Date.now();
  const sessaoToken = getCookie(COOKIE_SESSAO);
  let sessao = sessaoToken ? (await admin.from("foto_express_portal_sessoes").select("*").eq("token_hash", hash(sessaoToken)).maybeSingle()).data : null;
  if (!sessao || sessao.revogado_em || new Date(sessao.expira_em).getTime() <= agora) {
    const dispositivoToken = getCookie(COOKIE_DISPOSITIVO);
    const antiga = dispositivoToken ? (await admin.from("foto_express_portal_sessoes").select("*").eq("renovacao_hash", hash(dispositivoToken)).maybeSingle()).data : null;
    if (!antiga || antiga.revogado_em || !antiga.renovacao_expira_em || new Date(antiga.renovacao_expira_em).getTime() <= agora) throw new ErroPortalFotos("SESSAO", "Sua sessão expirou. Entre novamente.");
    const novaSessao = token(); const novoDispositivo = token();
    const { error } = await admin.from("foto_express_portal_sessoes").update({ token_hash: hash(novaSessao), renovacao_hash: hash(novoDispositivo), expira_em: new Date(agora + SESSAO_TTL).toISOString(), renovacao_expira_em: new Date(agora + DISPOSITIVO_TTL).toISOString(), usado_em: new Date().toISOString() }).eq("id", antiga.id);
    if (error) throw new ErroPortalFotos("SESSAO", "Não foi possível restaurar sua sessão.");
    definirCookies(novaSessao, novoDispositivo); sessao = antiga;
  } else {
    await admin.from("foto_express_portal_sessoes").update({ usado_em: new Date().toISOString(), expira_em: new Date(agora + SESSAO_TTL).toISOString() }).eq("id", sessao.id);
  }
  const { data: cliente } = await admin.from("clientes").select("id,nome,telefone,telefone_normalizado,cpf,data_nascimento").eq("id", sessao.cliente_id).maybeSingle();
  if (!cliente) throw new ErroPortalFotos("SESSAO", "Sua sessão expirou. Entre novamente.");
  return { admin, sessao, cliente };
}

export async function exigirTrabalhoCliente(trabalhoId: string, editavel = false) {
  const contexto = await carregarSessaoFotos();
  const { data: trabalho } = await contexto.admin.from("foto_express_trabalhos").select("*").eq("id", trabalhoId).eq("cliente_id", contexto.cliente.id).eq("origem_portal", true).maybeSingle();
  if (!trabalho) throw new ErroPortalFotos("NAO_ENCONTRADO", "Álbum não encontrado.");
  if (editavel && trabalho.portal_enviado_em) throw new ErroPortalFotos("BLOQUEADO", "Este álbum já foi enviado para impressão e não pode mais ser alterado.");
  return { ...contexto, trabalho };
}

const LIMITES = { cpf: 20, telefone: 20, cadastro: 5, upload: 80, envio: 10 } as const;
export async function limitarPortalFotos(acao: keyof typeof LIMITES) {
  const admin = await fotoPortalAdmin(); const ip = ipPedido();
  await admin.from("foto_express_portal_tentativas").insert({ acao, ip });
  const janela = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await admin.from("foto_express_portal_tentativas").select("id", { count: "exact", head: true }).eq("acao", acao).eq("ip", ip).gte("criado_em", janela);
  if ((count ?? 0) > LIMITES[acao]) throw new ErroPortalFotos("LIMITE", "Muitas tentativas. Aguarde alguns minutos.");
}

export async function sairPortalFotos() {
  const admin = await fotoPortalAdmin(); const valor = getCookie(COOKIE_SESSAO);
  if (valor) await admin.from("foto_express_portal_sessoes").update({ revogado_em: new Date().toISOString() }).eq("token_hash", hash(valor));
  setResponseHeader("Set-Cookie", [cookie(COOKIE_SESSAO, "", 0), cookie(COOKIE_DISPOSITIVO, "", 0)]);
}
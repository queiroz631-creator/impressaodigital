/**
 * Regras do portal público de Sorteios (Etapa 3) — somente servidor.
 *
 * Tudo aqui roda com o cliente administrativo (service role) porque o portal
 * é público: não existe usuário autenticado. Por isso cada função valida a
 * sessão do participante (cookie HttpOnly) antes de qualquer leitura ou
 * gravação, e nunca confia em IDs vindos do navegador.
 */
import { createHash, randomBytes } from "crypto";
import {
  getCookie,
  getRequest,
  getRequestIP,
  setResponseHeader,
} from "@tanstack/react-start/server";
import type { Database, Json } from "@/integrations/supabase/types";
import { EVENTOS_AUDITORIA } from "@/modules/sorteios/types";
import { mascararCpf } from "@/modules/sorteios/validations/sorteio";

type Admin = Awaited<ReturnType<typeof carregarAdmin>>;

async function carregarAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function admin(): Promise<Admin> {
  return carregarAdmin();
}

/** Erro com mensagem amigável e código estável para a interface reagir. */
export class ErroPortal extends Error {
  codigo: string;
  constructor(codigo: string, mensagem: string) {
    super(mensagem);
    this.codigo = codigo;
  }
}

export type SorteioRow = Database["public"]["Tables"]["sorteios"]["Row"];
export type ParticipanteRow = Database["public"]["Tables"]["sorteio_participantes"]["Row"];
export type ClienteRow = Database["public"]["Tables"]["clientes"]["Row"];
type SessaoRow = Database["public"]["Tables"]["sorteio_sessoes"]["Row"];

// ---------------------------------------------------------------------------
// Sessão do participante (cookie HttpOnly; nunca CPF/telefone como token)
// ---------------------------------------------------------------------------

const COOKIE_SESSAO = "sp_sessao";
const COOKIE_DISPOSITIVO = "sp_dispositivo";
const SESSAO_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas, renovada a cada uso
const DISPOSITIVO_TTL_MS = 30 * 24 * 60 * 60 * 1000; // "lembrar neste dispositivo"

const sha256 = (valor: string) => createHash("sha256").update(valor).digest("hex");
const novoToken = () => randomBytes(32).toString("base64url");

function conexaoSegura(): boolean {
  try {
    return getRequest().url.startsWith("https:");
  } catch {
    return true;
  }
}

function serializarCookie(nome: string, valor: string, maxAgeSegundos: number): string {
  const seguro = conexaoSegura() ? "; Secure" : "";
  return `${nome}=${valor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSegundos}${seguro}`;
}

function definirCookiesSessao(sessaoToken: string, dispositivoToken: string | null): void {
  const cookies = [serializarCookie(COOKIE_SESSAO, sessaoToken, SESSAO_TTL_MS / 1000)];
  if (dispositivoToken) {
    cookies.push(serializarCookie(COOKIE_DISPOSITIVO, dispositivoToken, DISPOSITIVO_TTL_MS / 1000));
  }
  setResponseHeader("Set-Cookie", cookies);
}

function limparCookiesSessao(): void {
  setResponseHeader("Set-Cookie", [
    serializarCookie(COOKIE_SESSAO, "", 0),
    serializarCookie(COOKIE_DISPOSITIVO, "", 0),
  ]);
}

export async function criarSessaoParticipante(opts: {
  participante_id: string;
  cliente_id: string;
  sorteio_id: string;
  lembrar: boolean;
}): Promise<void> {
  const supabase = await admin();
  const agora = Date.now();
  const sessaoToken = novoToken();
  const dispositivoToken = opts.lembrar ? novoToken() : null;

  let userAgent: string | null = null;
  try {
    userAgent = getRequest().headers.get("user-agent")?.slice(0, 300) ?? null;
  } catch {
    userAgent = null;
  }

  const { error } = await supabase.from("sorteio_sessoes").insert({
    participante_id: opts.participante_id,
    cliente_id: opts.cliente_id,
    sorteio_id: opts.sorteio_id,
    token_hash: sha256(sessaoToken),
    renovacao_hash: dispositivoToken ? sha256(dispositivoToken) : null,
    renovacao_expira_em: dispositivoToken
      ? new Date(agora + DISPOSITIVO_TTL_MS).toISOString()
      : null,
    expira_em: new Date(agora + SESSAO_TTL_MS).toISOString(),
    ip: ipDoPedido(),
    user_agent: userAgent,
  });
  if (error) throw new ErroPortal("ERRO", "Não foi possível iniciar sua sessão. Tente novamente.");
  definirCookiesSessao(sessaoToken, dispositivoToken);
}

async function buscarSessao(
  supabase: Admin,
  campo: "token_hash" | "renovacao_hash",
  hash: string,
): Promise<SessaoRow | null> {
  const { data } = await supabase
    .from("sorteio_sessoes")
    .select("*")
    .eq(campo, hash)
    .maybeSingle();
  return data;
}

export interface ContextoParticipante {
  sessaoId: string;
  participante: ParticipanteRow;
  sorteio: SorteioRow;
}

/**
 * Carrega e valida a sessão do participante. Renova a validade a cada uso.
 * Se o cookie expirou mas o "lembrar neste dispositivo" é válido, gira um
 * novo token de sessão. Sorteio em RASCUNHO (ou inexistente) bloqueia o
 * acesso como se o sorteio não existisse.
 */
export async function carregarSessao(): Promise<ContextoParticipante> {
  const supabase = await admin();
  const agora = Date.now();
  let sessao: SessaoRow | null = null;

  const token = getCookie(COOKIE_SESSAO);
  if (token) {
    const encontrada = await buscarSessao(supabase, "token_hash", sha256(token));
    if (
      encontrada &&
      !encontrada.revogado_em &&
      new Date(encontrada.expira_em).getTime() > agora
    ) {
      sessao = encontrada;
    }
  }

  if (!sessao) {
    const renovacao = getCookie(COOKIE_DISPOSITIVO);
    const antiga = renovacao
      ? await buscarSessao(supabase, "renovacao_hash", sha256(renovacao))
      : null;
    if (
      antiga &&
      !antiga.revogado_em &&
      antiga.renovacao_expira_em &&
      new Date(antiga.renovacao_expira_em).getTime() > agora
    ) {
      const novoSessaoToken = novoToken();
      const novoDispositivo = novoToken();
      const { error } = await supabase
        .from("sorteio_sessoes")
        .update({
          token_hash: sha256(novoSessaoToken),
          renovacao_hash: sha256(novoDispositivo),
          renovacao_expira_em: new Date(agora + DISPOSITIVO_TTL_MS).toISOString(),
          expira_em: new Date(agora + SESSAO_TTL_MS).toISOString(),
          usado_em: new Date(agora).toISOString(),
        })
        .eq("id", antiga.id);
      if (error) throw new ErroPortal("ERRO", "Não foi possível restaurar sua sessão.");
      definirCookiesSessao(novoSessaoToken, novoDispositivo);
      sessao = { ...antiga, token_hash: sha256(novoSessaoToken) };
    }
  } else {
    // Janela deslizante: cada uso renova a sessão por mais 2 horas.
    await supabase
      .from("sorteio_sessoes")
      .update({
        usado_em: new Date(agora).toISOString(),
        expira_em: new Date(agora + SESSAO_TTL_MS).toISOString(),
      })
      .eq("id", sessao.id);
  }

  if (!sessao) {
    throw new ErroPortal("SESSAO", "Sua sessão expirou. Entre novamente com seu CPF.");
  }

  const { data: participante } = await supabase
    .from("sorteio_participantes")
    .select("*")
    .eq("id", sessao.participante_id)
    .maybeSingle();
  if (!participante) {
    throw new ErroPortal("SESSAO", "Sua sessão expirou. Entre novamente com seu CPF.");
  }

  const { data: sorteio } = await supabase
    .from("sorteios")
    .select("*")
    .eq("id", sessao.sorteio_id)
    .maybeSingle();
  if (!sorteio || sorteio.status === "RASCUNHO") {
    throw new ErroPortal(
      "SORTEIO_INDISPONIVEL",
      "Não há nenhum sorteio disponível no momento.",
    );
  }

  return { sessaoId: sessao.id, participante, sorteio };
}

export async function revogarSessaoAtual(): Promise<ContextoParticipante | null> {
  const supabase = await admin();
  const token = getCookie(COOKIE_SESSAO);
  let contexto: ContextoParticipante | null = null;
  try {
    contexto = await carregarSessao();
  } catch {
    contexto = null;
  }
  if (token) {
    await supabase
      .from("sorteio_sessoes")
      .update({ revogado_em: new Date().toISOString() })
      .eq("token_hash", sha256(token))
      .is("revogado_em", null);
  }
  limparCookiesSessao();
  return contexto;
}

// ---------------------------------------------------------------------------
// Sorteio ativo e termos
// ---------------------------------------------------------------------------

/** Sorteio ATIVO único. Zero ou mais de um são condições de indisponibilidade. */
export async function obterSorteioAtivo(): Promise<SorteioRow> {
  const supabase = await admin();
  const { data, error } = await supabase
    .from("sorteios")
    .select("*")
    .eq("status", "ATIVO")
    .order("criado_em", { ascending: true });
  if (error) {
    throw new ErroPortal("ERRO", "Não foi possível carregar o sorteio. Tente novamente.");
  }
  if (!data || data.length === 0) {
    throw new ErroPortal("SEM_SORTEIO", "Não há nenhum sorteio disponível no momento.");
  }
  if (data.length > 1) {
    throw new ErroPortal(
      "CONFIGURACAO",
      "O sorteio está temporariamente indisponível. Tente novamente mais tarde.",
    );
  }
  return data[0]!;
}

/** Período de participação (usado na entrada e no registro de notas). */
export function periodoAberto(sorteio: SorteioRow): { aberto: boolean; mensagem?: string } {
  if (sorteio.status !== "ATIVO") {
    return { aberto: false, mensagem: "Este sorteio não está recebendo participação no momento." };
  }
  const agora = Date.now();
  if (sorteio.data_inicio && agora < new Date(sorteio.data_inicio).getTime()) {
    return { aberto: false, mensagem: "Este sorteio ainda não começou. Volte em breve." };
  }
  if (sorteio.data_fim && agora > new Date(sorteio.data_fim).getTime()) {
    return { aberto: false, mensagem: "O período de participação deste sorteio terminou." };
  }
  return { aberto: true };
}

export type TermosRow = Database["public"]["Tables"]["sorteio_termos"]["Row"];

export async function obterTermosAtual(
  supabase: Admin,
  sorteioId: string,
): Promise<TermosRow | null> {
  const { data } = await supabase
    .from("sorteio_termos")
    .select("*")
    .eq("sorteio_id", sorteioId)
    .eq("atual", true)
    .maybeSingle();
  return data;
}

/** Garante a participação do cliente no sorteio (idempotente pela regra única). */
export async function garantirParticipacao(
  supabase: Admin,
  sorteioId: string,
  clienteId: string,
): Promise<ParticipanteRow> {
  const { data: existente } = await supabase
    .from("sorteio_participantes")
    .select("*")
    .eq("sorteio_id", sorteioId)
    .eq("cliente_id", clienteId)
    .maybeSingle();
  if (existente) return existente;

  const { data: criado, error } = await supabase
    .from("sorteio_participantes")
    .insert({ sorteio_id: sorteioId, cliente_id: clienteId })
    .select("*")
    .single();
  if (error) {
    // Conflito de unicidade: outra chamada criou primeiro — apenas relê.
    const { data: releitura } = await supabase
      .from("sorteio_participantes")
      .select("*")
      .eq("sorteio_id", sorteioId)
      .eq("cliente_id", clienteId)
      .maybeSingle();
    if (releitura) return releitura;
    throw new ErroPortal("ERRO", "Não foi possível concluir sua participação. Tente novamente.");
  }
  return criado;
}

/** Próxima etapa após identificar o participante: termos pendentes ou painel. */
export async function etapaAposIdentificacao(
  supabase: Admin,
  sorteio: SorteioRow,
  participante: ParticipanteRow,
): Promise<"termos" | "painel"> {
  const termos = await obterTermosAtual(supabase, sorteio.id);
  if (!termos) return "painel";
  return participante.aceite_termos_versao === termos.versao && participante.aceite_termos_em
    ? "painel"
    : "termos";
}

// ---------------------------------------------------------------------------
// Telefone
// ---------------------------------------------------------------------------

function normalizarDigitos(valor?: string | null): string {
  let d = (valor ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  return d;
}

/** Compara o telefone informado com o cadastro (formato exibido e normalizado). */
export function telefoneConfere(
  informado: string,
  telefone?: string | null,
  telefoneNormalizado?: string | null,
): boolean {
  const a = normalizarDigitos(informado);
  if (a.length < 10) return false;
  const b = normalizarDigitos(telefone);
  const c = normalizarDigitos(telefoneNormalizado);
  return (b.length > 0 && a === b) || (c.length > 0 && a === c);
}

// ---------------------------------------------------------------------------
// Limite de tentativas (por IP e ação, janela de 10 minutos)
// ---------------------------------------------------------------------------

const LIMITES = { cpf: 20, telefone: 20, cadastro: 5, nota: 30 } as const;
export type AcaoLimitada = keyof typeof LIMITES;

function ipDoPedido(): string {
  try {
    return getRequestIP({ xForwardedFor: true }) ?? "desconhecido";
  } catch {
    return "desconhecido";
  }
}

export async function limitarTentativas(acao: AcaoLimitada): Promise<void> {
  const supabase = await admin();
  const ip = ipDoPedido();
  await supabase.from("sorteio_tentativas").insert({ acao, ip });
  const janela = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("sorteio_tentativas")
    .select("id", { count: "exact", head: true })
    .eq("acao", acao)
    .eq("ip", ip)
    .gte("criado_em", janela);
  if ((count ?? 0) > LIMITES[acao]) {
    throw new ErroPortal(
      "LIMITE",
      "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    );
  }
}

// ---------------------------------------------------------------------------
// Auditoria (origem "portal", dados sempre mascarados)
// ---------------------------------------------------------------------------

export async function auditarPortal(dados: {
  sorteio_id: string;
  participante_id?: string | null;
  cliente_id?: string | null;
  nota_id?: string | null;
  evento: (typeof EVENTOS_AUDITORIA)[keyof typeof EVENTOS_AUDITORIA];
  detalhe?: Record<string, unknown>;
}): Promise<void> {
  const supabase = await admin();
  const { error } = await supabase.from("sorteio_auditoria").insert({
    sorteio_id: dados.sorteio_id,
    participante_id: dados.participante_id ?? null,
    cliente_id: dados.cliente_id ?? null,
    nota_id: dados.nota_id ?? null,
    usuario_id: null,
    evento: dados.evento,
    origem: "portal",
    detalhe: (dados.detalhe ?? {}) as Json,
  });
  if (error) throw new ErroPortal("ERRO", "Não foi possível concluir agora. Tente novamente.");
}

export { mascararCpf };

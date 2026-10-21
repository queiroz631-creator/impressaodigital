/**
 * Cliente HTTP da Evolution API. Somente servidor.
 *
 * - O servidor (URL) vem de `whatsapp_servidores`; a chave NUNCA é guardada no
 *   banco: o servidor aponta para o NOME de uma variável de ambiente
 *   (`segredo_ref`, restrito a `EVOLUTION_API_KEY*`) e o valor é lido de
 *   `process.env` só na hora da chamada.
 * - Toda chamada passa pela proteção SSRF (`fetchSeguro`): https, DNS público,
 *   sem redirecionamento e com limite de tempo.
 * - A chave nunca aparece em mensagens de erro nem em logs.
 */

import { ErroUrlInsegura, fetchSeguro } from "@/lib/whatsapp/seguranca/url-segura.server";
import { classificarFalha } from "./erros";
import type { ContextoConexao, ErroProvedor } from "./tipos";

const PADRAO_SEGREDO_REF = /^EVOLUTION_API_KEY[A-Z0-9_]{0,40}$/;

export interface ServidorEvolution {
  id: string;
  baseUrl: string;
  segredoRef: string;
}

export interface AlvoEvolution {
  servidor: ServidorEvolution;
  /** Nome da instância (id externo da conexão); nulo em operações de servidor. */
  instancia: string | null;
  conexaoId: string | null;
}

export interface RespostaEvolution {
  ok: boolean;
  status: number;
  dados: unknown;
  erro?: string;
}

export type ResolucaoAlvo = { ok: true; alvo: AlvoEvolution } | { ok: false; erro: ErroProvedor };

function erroConfig(mensagem: string, codigo: ErroProvedor["codigo"] = "nao_configurado"): { ok: false; erro: ErroProvedor } {
  return { ok: false, erro: { codigo, mensagem, httpStatus: null, retentavel: false } };
}

/** Valor da chave do servidor (somente do ambiente). */
export function chaveDoServidor(segredoRef: string): string | null {
  if (!PADRAO_SEGREDO_REF.test(segredoRef)) return null;
  const v = process.env[segredoRef];
  return v && v.trim() ? v.trim() : null;
}

const TTL_MS = 30_000;
const cache = new Map<string, { alvo: AlvoEvolution; expira: number }>();

export function limparCacheEvolution(): void {
  cache.clear();
}

async function carregarServidor(db: Awaited<ReturnType<typeof banco>>, servidorId: string): Promise<ResolucaoAlvo | ServidorEvolution> {
  const { data, error } = await db
    .from("whatsapp_servidores")
    .select("id, provedor, base_url, segredo_ref, ativo")
    .eq("id", servidorId)
    .maybeSingle();
  if (error || !data) return erroConfig("Servidor do provedor não encontrado.");
  const s = data as { id: string; provedor: string; base_url: string; segredo_ref: string | null; ativo: boolean };
  if (s.provedor !== "evolution") return erroConfig("O servidor informado não é do provedor Evolution.");
  if (!s.ativo) return erroConfig("O servidor Evolution está desativado.");
  if (!s.segredo_ref) return erroConfig("O servidor Evolution não tem chave configurada.");
  return { id: s.id, baseUrl: s.base_url.replace(/\/+$/, ""), segredoRef: s.segredo_ref };
}

async function banco() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Resolve servidor (e instância) a partir da conexão ou do servidor informado no contexto. */
export async function resolverAlvoEvolution(ctx: ContextoConexao): Promise<ResolucaoAlvo> {
  const db = await banco();

  if (ctx.conexaoId) {
    const emCache = cache.get(ctx.conexaoId);
    if (emCache && emCache.expira > Date.now()) return { ok: true, alvo: emCache.alvo };

    const { data, error } = await db
      .from("whatsapp_conexoes")
      .select("id, provedor, servidor_id, id_externo")
      .eq("id", ctx.conexaoId)
      .maybeSingle();
    if (error || !data) return erroConfig("Conexão não encontrada.", "nao_encontrado");
    const c = data as { id: string; provedor: string; servidor_id: string | null; id_externo: string | null };
    if (c.provedor !== "evolution" || !c.servidor_id || !c.id_externo) {
      return erroConfig("A conexão não está configurada como Evolution (servidor/instância ausentes).");
    }
    const servidor = await carregarServidor(db, c.servidor_id);
    if ("ok" in servidor) return servidor;
    const alvo: AlvoEvolution = { servidor, instancia: c.id_externo, conexaoId: c.id };
    cache.set(ctx.conexaoId, { alvo, expira: Date.now() + TTL_MS });
    return { ok: true, alvo };
  }

  if (ctx.servidorId) {
    const servidor = await carregarServidor(db, ctx.servidorId);
    if ("ok" in servidor) return servidor;
    return { ok: true, alvo: { servidor, instancia: null, conexaoId: null } };
  }

  return erroConfig("Informe a conexão ou o servidor do provedor.");
}

function mensagemDoErro(dados: unknown, status: number): string {
  if (dados && typeof dados === "object") {
    const d = dados as { response?: { message?: unknown }; message?: unknown; error?: unknown };
    const m = d.response?.message ?? d.message;
    if (Array.isArray(m) && m.length > 0) {
      return m
        .map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
        .join("; ")
        .slice(0, 300);
    }
    if (typeof m === "string" && m) return m.slice(0, 300);
    if (typeof d.error === "string" && d.error) return d.error.slice(0, 300);
  }
  return `HTTP ${status}`;
}

export async function chamarEvolution(
  alvo: AlvoEvolution,
  caminho: string,
  opcoes: { metodo?: "GET" | "POST" | "PUT" | "DELETE"; corpo?: unknown; timeoutMs?: number } = {},
): Promise<RespostaEvolution> {
  const chave = chaveDoServidor(alvo.servidor.segredoRef);
  if (!chave) {
    return { ok: false, status: 0, dados: null, erro: "Chave do servidor Evolution não configurada no ambiente." };
  }

  const url = `${alvo.servidor.baseUrl}/${caminho.replace(/^\/+/, "")}`;
  try {
    const resposta = await fetchSeguro(
      url,
      {
        method: opcoes.metodo ?? "GET",
        headers: { "Content-Type": "application/json", apikey: chave },
        ...(opcoes.corpo !== undefined ? { body: JSON.stringify(opcoes.corpo) } : {}),
      },
      { timeoutMs: opcoes.timeoutMs ?? 20_000 },
    );

    const texto = await resposta.text();
    let dados: unknown = texto;
    try {
      dados = texto ? JSON.parse(texto) : null;
    } catch {
      /* resposta não-JSON */
    }

    if (!resposta.ok) {
      return { ok: false, status: resposta.status, dados, erro: mensagemDoErro(dados, resposta.status) };
    }
    return { ok: true, status: resposta.status, dados };
  } catch (e) {
    if (e instanceof ErroUrlInsegura) {
      return { ok: false, status: 0, dados: null, erro: e.message };
    }
    const nome = e instanceof Error ? e.name : "";
    const msg = e instanceof Error ? e.message : "Falha de conexão";
    return {
      ok: false,
      status: 0,
      dados: null,
      erro: nome === "TimeoutError" || nome === "AbortError" ? "Tempo esgotado ao falar com o servidor Evolution." : msg,
    };
  }
}

/** Converte uma resposta com falha em erro padronizado (sem expor credenciais). */
export function erroDaResposta(r: RespostaEvolution, padrao: string): ErroProvedor {
  const e = classificarFalha(r.status, r.erro ?? padrao);
  // URL insegura / chave ausente não são falhas transitórias.
  if (r.status === 0 && /não configurada|redirecion|interna|https|Protocolo|usuário ou senha|resolver/i.test(r.erro ?? "")) {
    return { ...e, codigo: e.codigo === "rede" ? "invalido" : e.codigo, retentavel: false };
  }
  return e;
}

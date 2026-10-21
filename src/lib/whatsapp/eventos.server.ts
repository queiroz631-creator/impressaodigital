/**
 * Registro de eventos de webhook (idempotência, log e status de conexão).
 * Somente servidor.
 *
 * REGRA CRÍTICA: este registro é um reforço. Qualquer falha — inclusive a
 * tabela/função ainda não existir no banco (ex.: VPS antes de aplicar a
 * migração) — NÃO pode impedir o atendimento: as funções devolvem `null`/não
 * fazem nada e o fluxo segue pelas proteções já existentes (índice único de
 * mensagens, idempotência do agente).
 */

import type { EventoNormalizado, ProvedorId } from "./providers/tipos";

export interface EventoRegistrado {
  id: string;
  novo: boolean;
  status: string;
}

export type TipoEventoRegistro =
  | "mensagem_recebida"
  | "mensagem_enviada_fora"
  | "mensagem_editada"
  | "mensagem_revogada"
  | "conexao_status";

/** Códigos que indicam "tabela/função inexistente" (migração ainda não aplicada). */
const CODIGOS_AUSENTE = new Set(["42883", "42P01", "PGRST202", "PGRST205"]);
const PAUSA_QUANDO_AUSENTE_MS = 60_000;

let indisponivelAte = 0;

/** Apenas para testes. */
export function reiniciarEstadoDeEventos(): void {
  indisponivelAte = 0;
}

/** Tipo e chave de idempotência do evento; `null` = não registra (ex.: entrega, presença, grupo). */
export function classificarParaRegistro(ev: EventoNormalizado): { tipo: TipoEventoRegistro; chave: string } | null {
  switch (ev.tipo) {
    case "mensagem_recebida":
    case "mensagem_enviada_fora": {
      if (!ev.idExterno) return null;
      const tipo: TipoEventoRegistro = ev.edicao ? "mensagem_editada" : ev.tipo;
      return { tipo, chave: `${tipo}:${ev.idExterno}` };
    }
    case "mensagem_revogada": {
      const id = ev.idExterno ?? ev.idAlvo;
      return id ? { tipo: "mensagem_revogada", chave: `mensagem_revogada:${id}` } : null;
    }
    case "ignorado":
      // Só mudanças de estado da conexão interessam; o resto (entrega, presença,
      // grupo) é ruído e não é registrado.
      return ev.statusConexao
        ? { tipo: "conexao_status", chave: `conexao_status:${ev.statusConexao}:${Math.floor(Date.now() / 60_000)}` }
        : null;
  }
}

/**
 * Resumo SEM dados pessoais para o log: nunca guarda telefone, nome nem
 * texto da mensagem (já ficam no histórico da conversa).
 */
export function resumoParaLog(ev: EventoNormalizado): Record<string, unknown> {
  switch (ev.tipo) {
    case "mensagem_recebida":
    case "mensagem_enviada_fora":
      return {
        tipoConteudo: ev.conteudo.tipo,
        temArquivo: Boolean(ev.conteudo.url),
        tamanhoTexto: ev.conteudo.texto.length,
        edicao: Boolean(ev.edicao),
        viaLid: !ev.telefone,
      };
    case "mensagem_revogada":
      return { revogacao: true };
    case "ignorado":
      return { motivo: ev.motivo, statusConexao: ev.statusConexao ?? null };
  }
}

function disponivel(): boolean {
  return Date.now() >= indisponivelAte;
}

function tratarErro(onde: string, erro: { code?: string; message?: string } | null | undefined): void {
  if (!erro) return;
  if (erro.code && CODIGOS_AUSENTE.has(erro.code)) {
    indisponivelAte = Date.now() + PAUSA_QUANDO_AUSENTE_MS;
    console.warn(`[whatsapp-eventos] ${onde}: registro de eventos indisponível (migração pendente?). Seguindo sem ele.`);
    return;
  }
  console.warn(`[whatsapp-eventos] ${onde}: ${erro.message ?? "falha"}`);
}

export async function registrarEvento(
  conexaoId: string,
  provedor: ProvedorId | string,
  ev: EventoNormalizado,
): Promise<EventoRegistrado | null> {
  const cls = classificarParaRegistro(ev);
  if (!cls || !disponivel()) return null;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("whatsapp_evento_registrar", {
      _conexao_id: conexaoId,
      _provedor: provedor,
      _tipo: cls.tipo,
      _dedup_key: cls.chave,
      _payload: resumoParaLog(ev) as never,
    });
    if (error) {
      tratarErro("registrar", error);
      return null;
    }
    const linha = Array.isArray(data) ? data[0] : data;
    if (!linha || typeof linha !== "object" || !("id" in linha)) return null;
    const r = linha as { id: string; novo: boolean; status: string };
    return { id: r.id, novo: Boolean(r.novo), status: String(r.status ?? "recebido") };
  } catch (e) {
    tratarErro("registrar", { message: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

export async function concluirEvento(
  registro: EventoRegistrado | null,
  desfecho: "processado" | "ignorado" | "erro",
  erro?: string | null,
): Promise<void> {
  if (!registro || !disponivel()) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("whatsapp_evento_concluir", {
      _id: registro.id,
      _status: desfecho,
      ...(erro ? { _erro: erro } : {}),
    });
    tratarErro("concluir", error);
  } catch (e) {
    tratarErro("concluir", { message: e instanceof Error ? e.message : String(e) });
  }
}

/** Persiste o estado da conexão informado pelo provedor (conectado/desconectado). */
export async function registrarStatusDaConexao(
  conexaoId: string,
  status: "conectado" | "desconectado",
): Promise<void> {
  if (!disponivel()) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("whatsapp_conexao_registrar_status", {
      _conexao_id: conexaoId,
      _status: status,
    });
    tratarErro("status da conexão", error);
  } catch (e) {
    tratarErro("status da conexão", { message: e instanceof Error ? e.message : String(e) });
  }
}

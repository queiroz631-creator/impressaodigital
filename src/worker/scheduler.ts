/**
 * Agendador de automações (roda dentro do worker).
 *
 * Toda a decisão fica no PostgreSQL: `agente_agendar_automacoes` reserva as
 * automações vencidas com `FOR UPDATE SKIP LOCKED` e cria UMA tarefa por
 * ocorrência (idempotency_key `automacao:{id}:{epoch}`). Por isso várias
 * instâncias do worker/agendador, reinícios e retentativas não duplicam
 * execuções. Este módulo apenas dispara os ciclos e trata falhas de conexão.
 *
 * Ciclos independentes do loop de tarefas (uma tarefa longa não atrasa o
 * agendamento):
 * - agendar automações vencidas  (padrão 30 s)
 * - gerar/resolver alertas       (padrão 60 s)
 * - manter heartbeats obsoletos  (padrão 10 min)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { logger } from "./logger";

type Cliente = SupabaseClient<Database>;

export interface OpcoesScheduler {
  agendarMs?: number;
  alertasMs?: number;
  manutencaoMs?: number;
}

export function iniciarScheduler(supabaseAdmin: Cliente, opcoes: OpcoesScheduler = {}): () => void {
  if (process.env["WORKER_SCHEDULER_ENABLED"] === "false") {
    logger.info("Scheduler de automações desabilitado (WORKER_SCHEDULER_ENABLED=false)");
    return () => {};
  }

  const agendarMs = opcoes.agendarMs ?? Number(process.env["WORKER_SCHEDULER_INTERVAL_MS"] ?? 30_000);
  const alertasMs = opcoes.alertasMs ?? Number(process.env["WORKER_ALERTAS_INTERVAL_MS"] ?? 60_000);
  const manutencaoMs = opcoes.manutencaoMs ?? Number(process.env["WORKER_MANUTENCAO_INTERVAL_MS"] ?? 600_000);

  const emAndamento = new Set<string>();

  // Cada ciclo nunca roda em paralelo consigo mesmo e nunca derruba o worker:
  // o RPC do supabase-js não lança, então o `error` é verificado explicitamente.
  const ciclo = (nome: string, rpc: "agente_agendar_automacoes" | "agente_gerar_alertas" | "agente_heartbeats_manter") =>
    async () => {
      if (emAndamento.has(nome)) return;
      emAndamento.add(nome);
      try {
        const { data, error } = await supabaseAdmin.rpc(rpc as never);
        if (error) throw new Error(error.message);
        const r = (data ?? {}) as Record<string, number>;
        const relevante = Object.values(r).some((v) => typeof v === "number" && v > 0);
        if (relevante) logger.info(`Scheduler: ${nome}`, r);
      } catch (e) {
        logger.warn(`Scheduler: falha no ciclo "${nome}" (será repetido)`, { erro: String(e) });
      } finally {
        emAndamento.delete(nome);
      }
    };

  const agendar = ciclo("agendar automações", "agente_agendar_automacoes");
  const alertas = ciclo("alertas", "agente_gerar_alertas");
  const manutencao = ciclo("manutenção de heartbeats", "agente_heartbeats_manter");

  // Execução imediata: após um reinício, ocorrências vencidas são tratadas
  // pela política de execuções perdidas (só a mais recente dentro da tolerância).
  void agendar();
  void alertas();
  void manutencao();

  const timers = [
    setInterval(() => void agendar(), agendarMs),
    setInterval(() => void alertas(), alertasMs),
    setInterval(() => void manutencao(), manutencaoMs),
  ];
  for (const t of timers) t.unref?.();

  logger.info("Scheduler de automações iniciado", { agendarMs, alertasMs, manutencaoMs });

  return () => {
    for (const t of timers) clearInterval(t);
    logger.info("Scheduler de automações parado");
  };
}

/**
 * Heartbeat do Worker
 *
 * Registra periodicamente o status do worker na tabela `agente_worker_heartbeats`.
 * Permite monitorar workers ativos no painel administrativo.
 */

import os from "node:os";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Cliente = SupabaseClient<Database>;

let heartbeatInterval: NodeJS.Timeout | null = null;

// Inline logger to avoid ESM import issues
const logger = {
  debug: (msg: string, meta?: any, workerId?: string) => console.log(new Date().toISOString(), "[DEBUG]", workerId ? `[${workerId}]` : "", msg, meta ?? ""),
  info: (msg: string, meta?: any, workerId?: string) => console.log(new Date().toISOString(), "[INFO]", workerId ? `[${workerId}]` : "", msg, meta ?? ""),
  warn: (msg: string, meta?: any, workerId?: string) => console.warn(new Date().toISOString(), "[WARN]", workerId ? `[${workerId}]` : "", msg, meta ?? ""),
  error: (msg: string, meta?: any, workerId?: string) => console.error(new Date().toISOString(), "[ERROR]", workerId ? `[${workerId}]` : "", msg, meta ?? ""),
};

/**
 * Inicia o heartbeat periódico.
 */
export function iniciarHeartbeat(
  supabaseAdmin: Cliente,
  workerId: string,
  estaOcupado: () => boolean = () => false,
): NodeJS.Timeout {
  const intervaloMs = Number(process.env["WORKER_HEARTBEAT_INTERVAL_MS"] ?? "10000");

  const executar = async () => {
    try {
      // A tabela agente_worker_heartbeats só aceita 'online' | 'ocupado' | 'parado'.
      const { error } = await supabaseAdmin.rpc("agente_registrar_heartbeat", {
        _worker_id: workerId,
        _status: estaOcupado() ? "ocupado" : "online",
        _versao: process.env["npm_package_version"] ?? "1.0.0",
        _hostname: os.hostname(),
        _processos: 1,
      });
      if (error) throw new Error(error.message);
    } catch (e) {
      logger.warn("Falha no heartbeat", { workerId, erro: String(e) });
    }
  };

  // Executar imediatamente
  executar();

  // Agendar execuções periódicas
  heartbeatInterval = setInterval(executar, intervaloMs);

  // Garantir que não impede encerramento do processo
  heartbeatInterval.unref?.();

  logger.info("Heartbeat iniciado", { workerId, intervaloMs });
  return heartbeatInterval;
}

/**
 * Para o heartbeat.
 */
export function pararHeartbeat(intervalId: NodeJS.Timeout | null) {
  if (intervalId) {
    clearInterval(intervalId);
    heartbeatInterval = null;
    logger.info("Heartbeat parado");
  }
}
/**
 * Worker da Central de Agentes — Entry Point
 *
 * Processa tarefas da fila `agente_tarefas` de forma independente do navegador.
 * Gerenciado por PM2 na VPS. Executa apenas no servidor (Node.js).
 *
 * Funcionamento:
 * 1. Inicializa conexão Supabase (service_role)
 * 2. Registra heartbeat inicial
 * 3. Loop principal: reserva tarefas → processa → atualiza status
 * 4. Heartbeat periódico para monitoramento
 * 5. Encerramento gracioso com cleanup
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { iniciarHeartbeat, pararHeartbeat } from "./heartbeat";
import { iniciarScheduler } from "./scheduler";
import { processarTarefa, retomarExecucaoAposAprovacao, type TarefaReservada } from "./task-processor";
import os from "node:os";

// Inline logger to avoid ESM import issues
const logger = {
  debug: (msg: string, meta?: any, workerId?: string) => console.log(new Date().toISOString(), "[DEBUG]", workerId ? `[${workerId}]` : "", msg, meta ?? ""),
  info: (msg: string, meta?: any, workerId?: string) => console.log(new Date().toISOString(), "[INFO]", workerId ? `[${workerId}]` : "", msg, meta ?? ""),
  warn: (msg: string, meta?: any, workerId?: string) => console.warn(new Date().toISOString(), "[WARN]", workerId ? `[${workerId}]` : "", msg, meta ?? ""),
  error: (msg: string, meta?: any, workerId?: string) => console.error(new Date().toISOString(), "[ERROR]", workerId ? `[${workerId}]` : "", msg, meta ?? ""),
};

// ============================================================
// Configuração
// ============================================================

const SUPABASE_URL = process.env["SUPABASE_URL"] ?? "http://127.0.0.1:54521";
const SUPABASE_SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!SUPABASE_SERVICE_ROLE_KEY) {
  logger.error("SUPABASE_SERVICE_ROLE_KEY não definido. Worker não pode iniciar.");
  process.exit(1);
}

const WORKER_ID = `worker_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const POLL_INTERVAL_MS = Number(process.env["WORKER_POLL_INTERVAL_MS"] ?? 5000);
const MAX_TAREFAS_POR_CICLO = Number(process.env["WORKER_MAX_TAREFAS"] ?? 10);
const LEASE_SEGUNDOS = Number(process.env["WORKER_LEASE_SEGUNDOS"] ?? 60);

// Cliente Supabase com service_role (bypass RLS para operações internas)
const supabaseAdmin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "public" },
});

// ============================================================
// Estado do worker
// ============================================================

let encerrando = false;
let tarefasEmProcessamento = 0;

// ============================================================
// Loop principal
// ============================================================

async function main() {
  logger.info(`Worker iniciado`, { workerId: WORKER_ID, pid: process.pid });

  try {
    // Registrar worker no banco
    await registrarWorker();
  } catch (e) {
    console.error("ERROR in registrarWorker:", e);
    throw e;
  }

  let heartbeatInterval: NodeJS.Timeout | null = null;
  try {
    // Iniciar heartbeat
    heartbeatInterval = iniciarHeartbeat(supabaseAdmin, WORKER_ID, () => tarefasEmProcessamento > 0);
  } catch (e) {
    console.error("ERROR in iniciarHeartbeat:", e);
    throw e;
  }

  // Agendador de automações + alertas + manutenção de heartbeats (ciclos
  // independentes do loop de tarefas; a idempotência fica no banco).
  const pararScheduler = iniciarScheduler(supabaseAdmin);

  // Tratamento de sinais para encerramento gracioso
  const sinais: NodeJS.Signals[] = ["SIGTERM", "SIGINT", "SIGHUP"];
  for (const sinal of sinais) {
    process.on(sinal, () => handleShutdown(sinal));
  }

  // Loop de processamento
  let ultimaExpiracaoLease = 0;
  const INTERVALO_EXPIRAR_LEASE_MS = 60 * 1000;

  while (!encerrando) {
    try {
      // Recuperação: devolve à fila tarefas cujo lease venceu (worker caiu).
      if (Date.now() - ultimaExpiracaoLease > INTERVALO_EXPIRAR_LEASE_MS) {
        ultimaExpiracaoLease = Date.now();
        await expirarLeases();
      }

      if (tarefasEmProcessamento >= MAX_TAREFAS_POR_CICLO) {
        await sleep(1000);
        continue;
      }

      const vagas = MAX_TAREFAS_POR_CICLO - tarefasEmProcessamento;
      const tarefas = await reservarTarefas(vagas);

      if (tarefas.length === 0) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      // Processar tarefas em paralelo (limitado)
      const promessas = tarefas.map((tarefa) => processarTarefaWrapper(tarefa));
      await Promise.allSettled(promessas);
    } catch (erro) {
      logger.error("Erro no loop principal do worker", { erro: String(erro) });
      await sleep(POLL_INTERVAL_MS * 2); // Backoff em erro geral
    }
  }

  // Aguardar tarefas em andamento finalizarem (com timeout)
  const timeoutFinalizacao = 30000;
  const inicioEspera = Date.now();
  while (tarefasEmProcessamento > 0 && Date.now() - inicioEspera < timeoutFinalizacao) {
    logger.info("Aguardando tarefas em andamento...", { restantes: tarefasEmProcessamento });
    await sleep(1000);
  }

  // Parar agendador e heartbeat e limpar
  pararScheduler();
  pararHeartbeat(heartbeatInterval);
  await desregistrarWorker();

  logger.info("Worker encerrado", { workerId: WORKER_ID });
  process.exit(0);
}

// ============================================================
// Funções auxiliares
// ============================================================

async function registrarWorker() {
  try {
    // Status válido na tabela: 'online' | 'ocupado' | 'parado'.
    const { error } = await supabaseAdmin.rpc("agente_registrar_heartbeat", {
      _worker_id: WORKER_ID,
      _status: "online",
      _versao: process.env["npm_package_version"] ?? "1.0.0",
      _hostname: os.hostname(),
      _processos: 1,
    });
    if (error) throw new Error(error.message);
    logger.info("Worker registrado no banco");
  } catch (e) {
    logger.warn("Falha ao registrar worker (pode ser primeira execução)", { erro: String(e) });
  }
}

async function desregistrarWorker() {
  try {
    const { error } = await supabaseAdmin.rpc("agente_registrar_heartbeat", {
      _worker_id: WORKER_ID,
      _status: "parado",
      _versao: process.env["npm_package_version"] ?? "1.0.0",
      _hostname: os.hostname(),
      _processos: 0,
    });
    if (error) throw new Error(error.message);
    logger.info("Worker desregistrado");
  } catch (e) {
    logger.warn("Falha ao desregistrar worker", { erro: String(e) });
  }
}

async function expirarLeases() {
  try {
    const { data, error } = await supabaseAdmin.rpc("agente_expirar_leases");
    if (error) throw new Error(error.message);
    const total = Number(data ?? 0);
    if (total > 0) logger.info("Leases expirados devolvidos à fila", { total });
  } catch (e) {
    logger.warn("Falha ao expirar leases", { erro: String(e) });
  }
}

async function reservarTarefas(limite: number): Promise<TarefaReservada[]> {
  try {
    const { data, error } = await supabaseAdmin.rpc("agente_reservar_tarefas", {
      _worker_id: WORKER_ID,
      _limite: limite,
      _lease_segundos: LEASE_SEGUNDOS,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as TarefaReservada[];
  } catch (e) {
    logger.error("Falha ao reservar tarefas", { erro: String(e) });
    return [];
  }
}

async function processarTarefaWrapper(tarefa: TarefaReservada) {
  tarefasEmProcessamento++;
  const inicio = Date.now();

  try {
    logger.info("Processando tarefa", { tarefaId: tarefa.id, tipo: tarefa.tipo, agenteId: tarefa.agente_id });

    if (tarefa.tipo === "retomar_execucao") {
      await retomarExecucaoAposAprovacao(supabaseAdmin, WORKER_ID, tarefa);
    } else {
      await processarTarefa(supabaseAdmin, WORKER_ID, tarefa);
    }

    logger.info("Tarefa concluída", { tarefaId: tarefa.id, duracaoMs: Date.now() - inicio });
  } catch (e) {
    logger.error("Falha ao processar tarefa", { tarefaId: tarefa.id, erro: String(e) });
    // Garante que a tarefa não fique presa em execução: devolve à fila/erro
    // conforme as tentativas restantes.
    try {
      await supabaseAdmin.rpc("agente_concluir_tarefa", {
        _tarefa_id: tarefa.id,
        _status: "falha",
        _erro: `Exceção no processamento: ${e instanceof Error ? e.message : String(e)}`,
      });
    } catch (erroConclusao) {
      logger.error("Falha ao concluir tarefa com erro", {
        tarefaId: tarefa.id,
        erro: String(erroConclusao),
      });
    }
  } finally {
    tarefasEmProcessamento--;
  }
}

function handleShutdown(sinal: NodeJS.Signals) {
  if (encerrando) return;
  encerrando = true;
  logger.info(`Sinal ${sinal} recebido. Iniciando encerramento gracioso...`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Iniciar
main().catch((e) => {
  console.error("CATCH BLOCK - logger type:", typeof logger);
  logger.error("Erro fatal no worker", { erro: String(e) });
  process.exit(1);
});
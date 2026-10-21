/**
 * Logger simples para o worker.
 * Usa console com prefixo de timestamp e nível.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  meta?: Record<string, any>;
  timestamp: string;
  workerId?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const nivelAtual = (process.env.WORKER_LOG_LEVEL as LogLevel) ?? "info";
const nivelMinimo = LOG_LEVELS[nivelAtual];

function formatLog(entry: LogEntry): string {
  const partes = [
    entry.timestamp,
    `[${entry.level.toUpperCase()}]`,
    entry.workerId ? `[${entry.workerId}]` : "",
    entry.message,
  ].filter(Boolean);

  if (entry.meta && Object.keys(entry.meta).length > 0) {
    partes.push(JSON.stringify(entry.meta));
  }

  return partes.join(" ");
}

function log(level: LogLevel, message: string, meta?: Record<string, any>, workerId?: string) {
  if (LOG_LEVELS[level] < nivelMinimo) return;

  const entry: LogEntry = {
    level,
    message,
    meta,
    timestamp: new Date().toISOString(),
    workerId,
  };

  const formatted = formatLog(entry);

  switch (level) {
    case "debug":
    case "info":
      console.log(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "error":
      console.error(formatted);
      break;
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, any>, workerId?: string) =>
    log("debug", message, meta, workerId),
  info: (message: string, meta?: Record<string, any>, workerId?: string) =>
    log("info", message, meta, workerId),
  warn: (message: string, meta?: Record<string, any>, workerId?: string) =>
    log("warn", message, meta, workerId),
  error: (message: string, meta?: Record<string, any>, workerId?: string) =>
    log("error", message, meta, workerId),
};
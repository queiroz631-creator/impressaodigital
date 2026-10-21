/**
 * Verificação pura de horário de atendimento do Agente de Atendimento WhatsApp.
 *
 * Extraída do `task-processor.ts` para permitir testes determinísticos (o
 * "agora" é injetável). Mantém exatamente a semântica original do worker:
 * - dias 0-based (0 = Domingo, igual a `Date.getDay()`);
 * - intervalo tratado como [início, fim) em minutos desde a meia-noite;
 * - sem configuração (`cfg` nulo) considera-se dentro do horário.
 *
 * Os valores `HH:MM` vindos do banco recebem `:00` (segundos) antes do parse,
 * como o worker já fazia. `dias_semana` ausente usa Seg–Sex.
 */

export interface ConfigHorarioAtendimento {
  agente_atendimento_horario_inicio?: string | null;
  agente_atendimento_horario_fim?: string | null;
  agente_atendimento_dias_semana?: number[] | null;
}

/** Dias padrão quando a conexão não define `agente_atendimento_dias_semana`. */
export const DIAS_PADRAO: number[] = [1, 2, 3, 4, 5];

const HORARIO_INICIO_PADRAO = "08:00";
const HORARIO_FIM_PADRAO = "18:00";

function minutosDesdeMeiaNoite(valor: string | null | undefined, padrao: string): number {
  const horario = valor ? `${valor}:00` : padrao;
  const [h = 0, m = 0] = horario.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Indica se o instante `agora` está FORA do horário de atendimento.
 * Retorna `false` quando não há configuração (atende sempre).
 */
export function estaForaDoHorario(
  cfg: ConfigHorarioAtendimento | null | undefined,
  agora: Date = new Date(),
): boolean {
  if (!cfg) return false;

  const diaSemana = agora.getDay();
  const horaAtual = agora.getHours() * 60 + agora.getMinutes();

  const diasPermitidos = cfg.agente_atendimento_dias_semana ?? DIAS_PADRAO;
  const inicioMin = minutosDesdeMeiaNoite(
    cfg.agente_atendimento_horario_inicio,
    HORARIO_INICIO_PADRAO,
  );
  const fimMin = minutosDesdeMeiaNoite(cfg.agente_atendimento_horario_fim, HORARIO_FIM_PADRAO);

  return !diasPermitidos.includes(diaSemana) || horaAtual < inicioMin || horaAtual >= fimMin;
}

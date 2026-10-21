import { z } from "zod";

/**
 * Regras puras das automações da Central de Agentes (sem I/O).
 * Usado pela UI, pelas server functions e pelo worker.
 *
 * O cálculo da próxima execução NÃO é feito aqui: a fonte única é a função SQL
 * `agente_proxima_execucao` (gatilho `agente_automacoes_preparar`).
 */

export const TIPOS_AUTOMACAO = ["manual", "agendado", "recorrente", "evento"] as const;
export type TipoAutomacao = (typeof TIPOS_AUTOMACAO)[number];

export const FREQUENCIAS = ["intervalo", "diaria", "semanal"] as const;
export type FrequenciaAutomacao = (typeof FREQUENCIAS)[number];

/** Eventos internos autorizados (espelha `agente_eventos_permitidos()` no banco). */
export const EVENTOS_AUTORIZADOS = [
  { chave: "agente.alerta_criado", nome: "Alerta criado na Central de Agentes" },
] as const;

export const ROTULOS_TIPO_AUTOMACAO: Record<TipoAutomacao, string> = {
  manual: "Manual",
  agendado: "Agendada (uma vez)",
  recorrente: "Recorrente",
  evento: "Por evento",
};

export const ROTULOS_FREQUENCIA: Record<FrequenciaAutomacao, string> = {
  intervalo: "A cada N minutos",
  diaria: "Diariamente",
  semanal: "Semanalmente",
};

export const ROTULOS_STATUS_AUTOMACAO: Record<string, string> = {
  enfileirada: "Enfileirada",
  concluida: "Concluída",
  falha: "Falha",
  cancelada: "Cancelada",
  perdida: "Execução perdida",
  ignorada: "Ignorada",
  desativada_por_erro: "Desativada por erro",
};

/** 0 = domingo … 6 = sábado (igual a `extract(dow)` do Postgres e `Date.getDay()`). */
export const DIAS_SEMANA = [
  { valor: 0, curto: "Dom", longo: "Domingo" },
  { valor: 1, curto: "Seg", longo: "Segunda" },
  { valor: 2, curto: "Ter", longo: "Terça" },
  { valor: 3, curto: "Qua", longo: "Quarta" },
  { valor: 4, curto: "Qui", longo: "Quinta" },
  { valor: 5, curto: "Sex", longo: "Sexta" },
  { valor: 6, curto: "Sáb", longo: "Sábado" },
] as const;

export const FUSOS_COMUNS = [
  "America/Sao_Paulo",
  "America/Bahia",
  "America/Fortaleza",
  "America/Recife",
  "America/Manaus",
  "America/Cuiaba",
  "America/Rio_Branco",
  "America/Noronha",
  "UTC",
] as const;

const horaRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export const automacaoSchema = z
  .object({
    nome: z.string().trim().min(3, "Informe um nome (mín. 3 caracteres).").max(120),
    descricao: z.string().trim().max(500).nullable().optional(),
    agente_id: z.string().uuid("Selecione o agente."),
    tipo_gatilho: z.enum(TIPOS_AUTOMACAO),
    frequencia: z.enum(FREQUENCIAS).nullable().optional(),
    intervalo_minutos: z.number().int().min(5).max(10080).nullable().optional(),
    hora_local: z.string().regex(horaRegex, "Horário inválido (HH:MM).").nullable().optional(),
    dias_semana: z.array(z.number().int().min(0).max(6)).max(7).default([]),
    executar_em: z.string().datetime({ offset: true }).nullable().optional(),
    fuso: z.string().min(3).max(60).default("America/Sao_Paulo"),
    evento: z.string().max(80).nullable().optional(),
    mensagem: z.string().trim().min(5, "Descreva o que o agente deve fazer.").max(2000),
    ferramentas_permitidas: z.array(z.string().min(1).max(100)).max(50).default([]),
    max_tentativas: z.number().int().min(1).max(10).default(3),
    desativar_apos_falhas: z.number().int().min(1).max(50).default(5),
    tolerancia_minutos: z.number().int().min(1).max(1440).default(15),
  })
  .superRefine((v, ctx) => {
    const erro = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });

    if (v.tipo_gatilho === "agendado") {
      if (!v.executar_em) erro("executar_em", "Informe a data e hora da execução.");
      else if (new Date(v.executar_em).getTime() <= Date.now()) {
        erro("executar_em", "A data da execução deve ser futura.");
      }
    }
    if (v.tipo_gatilho === "recorrente") {
      if (!v.frequencia) erro("frequencia", "Informe a frequência.");
      if (v.frequencia === "intervalo" && !v.intervalo_minutos) {
        erro("intervalo_minutos", "Informe o intervalo em minutos (mín. 5).");
      }
      if ((v.frequencia === "diaria" || v.frequencia === "semanal") && !v.hora_local) {
        erro("hora_local", "Informe o horário.");
      }
      if (v.frequencia === "semanal" && v.dias_semana.length === 0) {
        erro("dias_semana", "Selecione ao menos um dia da semana.");
      }
    }
    if (v.tipo_gatilho === "evento") {
      if (!v.evento || !EVENTOS_AUTORIZADOS.some((e) => e.chave === v.evento)) {
        erro("evento", "Selecione um evento autorizado.");
      }
    }
  });

export type AutomacaoInput = z.infer<typeof automacaoSchema>;

// ---------------------------------------------------------------------------
// Contexto de autorização das automações
// ---------------------------------------------------------------------------

/**
 * Contexto EXPLÍCITO com que uma automação executa. Substitui o "contexto de
 * sistema" genérico: a automação nunca amplia as permissões do agente.
 *
 * - Só ferramentas de consulta, não sensíveis e sem exigência de aprovação.
 * - Só as vinculadas ao agente E marcadas na própria automação.
 */
export interface ContextoAutorizacaoAutomacao {
  automacaoId: string;
  agenteId: string;
  origem: "manual" | "agendado" | "recorrente" | "evento";
  ferramentasPermitidas: string[];
  modo: "somente_consulta";
}

export interface FerramentaMinima {
  chave: string;
  tipo: "consulta" | "acao";
  sensivel: boolean;
  requerAprovacao?: boolean;
}

export function ferramentaPermitidaEmAutomacao(f: FerramentaMinima): boolean {
  return f.tipo === "consulta" && !f.sensivel && f.requerAprovacao !== true;
}

/**
 * Interseção: ferramentas vinculadas ao agente ∩ marcadas na automação ∩ seguras.
 * Lista vazia na automação = nenhuma ferramenta (nunca "todas").
 */
export function ferramentasAutorizadasAutomacao<T extends FerramentaMinima>(
  vinculadasAoAgente: T[],
  permitidasNaAutomacao: string[],
): T[] {
  const permitidas = new Set(permitidasNaAutomacao);
  return vinculadasAoAgente.filter((f) => permitidas.has(f.chave) && ferramentaPermitidaEmAutomacao(f));
}

export function montarMensagemAutomacao(
  acao: unknown,
  nome: string,
  eventoPayload?: unknown,
): string {
  const base =
    acao && typeof acao === "object" && typeof (acao as { mensagem?: unknown }).mensagem === "string"
      ? ((acao as { mensagem: string }).mensagem.trim() || `Executar automação: ${nome}`)
      : `Executar automação: ${nome}`;
  if (eventoPayload && typeof eventoPayload === "object" && Object.keys(eventoPayload).length > 0) {
    return `${base}\n\nDados do evento: ${JSON.stringify(eventoPayload).slice(0, 1000)}`;
  }
  return base;
}

export interface AgendamentoResumivel {
  tipo_gatilho: string;
  frequencia: string | null;
  intervalo_minutos: number | null;
  hora_local: string | null;
  dias_semana: number[];
  executar_em: string | null;
  evento: string | null;
  fuso: string;
}

export function descreverAgendamento(a: AgendamentoResumivel): string {
  switch (a.tipo_gatilho) {
    case "manual":
      return "Somente sob solicitação";
    case "agendado":
      return a.executar_em
        ? `Uma vez em ${new Date(a.executar_em).toLocaleString("pt-BR")}`
        : "Data não definida";
    case "evento":
      return `Evento: ${EVENTOS_AUTORIZADOS.find((e) => e.chave === a.evento)?.nome ?? a.evento ?? "-"}`;
    case "recorrente": {
      const hora = a.hora_local ? a.hora_local.slice(0, 5) : "";
      if (a.frequencia === "intervalo") return `A cada ${a.intervalo_minutos ?? "?"} min`;
      if (a.frequencia === "diaria") return `Diariamente às ${hora} (${a.fuso})`;
      if (a.frequencia === "semanal") {
        const dias = DIAS_SEMANA.filter((d) => a.dias_semana.includes(d.valor))
          .map((d) => d.curto)
          .join(", ");
        return `${dias} às ${hora} (${a.fuso})`;
      }
      return "Recorrência incompleta";
    }
    default:
      return "-";
  }
}

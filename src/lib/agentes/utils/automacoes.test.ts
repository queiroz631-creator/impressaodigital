import { describe, expect, it } from "vitest";
import { FERRAMENTAS_SISTEMA } from "../tools/sistema";
import {
  automacaoSchema,
  descreverAgendamento,
  ferramentaPermitidaEmAutomacao,
  ferramentasAutorizadasAutomacao,
  montarMensagemAutomacao,
} from "./automacoes";

const AGENTE = "11111111-1111-4111-8111-111111111111";
const base = {
  nome: "Resumo diário",
  agente_id: AGENTE,
  mensagem: "Liste os orçamentos de hoje.",
};
const futuro = () => new Date(Date.now() + 3600_000).toISOString();

describe("automacaoSchema", () => {
  it("aceita automação manual mínima e aplica padrões", () => {
    const r = automacaoSchema.parse({ ...base, tipo_gatilho: "manual" });
    expect(r.fuso).toBe("America/Sao_Paulo");
    expect(r.max_tentativas).toBe(3);
    expect(r.tolerancia_minutos).toBe(15);
    expect(r.ferramentas_permitidas).toEqual([]);
  });

  it("agendada exige data futura", () => {
    expect(automacaoSchema.safeParse({ ...base, tipo_gatilho: "agendado" }).success).toBe(false);
    const passado = new Date(Date.now() - 60_000).toISOString();
    expect(automacaoSchema.safeParse({ ...base, tipo_gatilho: "agendado", executar_em: passado }).success).toBe(false);
    expect(automacaoSchema.safeParse({ ...base, tipo_gatilho: "agendado", executar_em: futuro() }).success).toBe(true);
  });

  it("recorrente por intervalo exige no mínimo 5 minutos", () => {
    const r = (m: number) =>
      automacaoSchema.safeParse({ ...base, tipo_gatilho: "recorrente", frequencia: "intervalo", intervalo_minutos: m });
    expect(r(4).success).toBe(false);
    expect(r(5).success).toBe(true);
  });

  it("recorrente diária e semanal exigem horário; semanal exige dias", () => {
    expect(automacaoSchema.safeParse({ ...base, tipo_gatilho: "recorrente", frequencia: "diaria" }).success).toBe(false);
    expect(
      automacaoSchema.safeParse({ ...base, tipo_gatilho: "recorrente", frequencia: "diaria", hora_local: "08:00" }).success,
    ).toBe(true);
    expect(
      automacaoSchema.safeParse({ ...base, tipo_gatilho: "recorrente", frequencia: "semanal", hora_local: "08:00" }).success,
    ).toBe(false);
    expect(
      automacaoSchema.safeParse({
        ...base,
        tipo_gatilho: "recorrente",
        frequencia: "semanal",
        hora_local: "08:00",
        dias_semana: [1, 3],
      }).success,
    ).toBe(true);
  });

  it("rejeita horário inválido e dia fora de 0–6", () => {
    expect(
      automacaoSchema.safeParse({ ...base, tipo_gatilho: "recorrente", frequencia: "diaria", hora_local: "25:00" }).success,
    ).toBe(false);
    expect(
      automacaoSchema.safeParse({
        ...base,
        tipo_gatilho: "recorrente",
        frequencia: "semanal",
        hora_local: "08:00",
        dias_semana: [7],
      }).success,
    ).toBe(false);
  });

  it("evento só aceita eventos da lista autorizada", () => {
    expect(automacaoSchema.safeParse({ ...base, tipo_gatilho: "evento", evento: "pedido.excluido" }).success).toBe(false);
    expect(automacaoSchema.safeParse({ ...base, tipo_gatilho: "evento" }).success).toBe(false);
    expect(automacaoSchema.safeParse({ ...base, tipo_gatilho: "evento", evento: "agente.alerta_criado" }).success).toBe(true);
  });

  it("valida nome, agente e mensagem", () => {
    expect(automacaoSchema.safeParse({ ...base, nome: "ab", tipo_gatilho: "manual" }).success).toBe(false);
    expect(automacaoSchema.safeParse({ ...base, agente_id: "x", tipo_gatilho: "manual" }).success).toBe(false);
    expect(automacaoSchema.safeParse({ ...base, mensagem: "oi", tipo_gatilho: "manual" }).success).toBe(false);
  });
});

describe("contexto de autorização das automações", () => {
  const todas = FERRAMENTAS_SISTEMA;

  it("sem marcação na automação, nenhuma ferramenta é liberada (nunca 'todas')", () => {
    expect(ferramentasAutorizadasAutomacao(todas, [])).toEqual([]);
  });

  it("libera somente consultas não sensíveis marcadas e vinculadas", () => {
    const r = ferramentasAutorizadasAutomacao(todas, ["sistema.cliente_buscar", "sistema.pedido_buscar"]);
    expect(r.map((f) => f.chave).sort()).toEqual(["sistema.cliente_buscar", "sistema.pedido_buscar"]);
  });

  it("nunca libera ferramenta sensível ou de ação, mesmo se marcada", () => {
    const r = ferramentasAutorizadasAutomacao(todas, ["whatsapp.encaminhar_humano", "sistema.cliente_buscar"]);
    expect(r.map((f) => f.chave)).toEqual(["sistema.cliente_buscar"]);
    expect(
      todas.filter((f) => f.tipo === "acao" || f.sensivel).every((f) => !ferramentaPermitidaEmAutomacao(f)),
    ).toBe(true);
  });

  it("não amplia o agente: ferramenta marcada mas não vinculada é ignorada", () => {
    const vinculadas = todas.filter((f) => f.chave === "sistema.cliente_buscar");
    const r = ferramentasAutorizadasAutomacao(vinculadas, ["sistema.cliente_buscar", "sistema.pedido_buscar"]);
    expect(r.map((f) => f.chave)).toEqual(["sistema.cliente_buscar"]);
  });

  it("ferramenta que exige aprovação é bloqueada", () => {
    expect(ferramentaPermitidaEmAutomacao({ chave: "x", tipo: "consulta", sensivel: false, requerAprovacao: true })).toBe(false);
  });
});

describe("mensagem e descrição", () => {
  it("monta a mensagem da ação e anexa dados do evento", () => {
    expect(montarMensagemAutomacao({ mensagem: "  Faça X " }, "Auto")).toBe("Faça X");
    expect(montarMensagemAutomacao({}, "Auto")).toBe("Executar automação: Auto");
    expect(montarMensagemAutomacao({ mensagem: "Y" }, "Auto", { alerta_id: "a1" })).toContain("a1");
  });

  it("descreve o agendamento", () => {
    const b = { frequencia: null, intervalo_minutos: null, hora_local: null, dias_semana: [], executar_em: null, evento: null, fuso: "America/Sao_Paulo" };
    expect(descreverAgendamento({ ...b, tipo_gatilho: "manual" })).toMatch(/solicitação/);
    expect(descreverAgendamento({ ...b, tipo_gatilho: "recorrente", frequencia: "intervalo", intervalo_minutos: 30 })).toBe("A cada 30 min");
    expect(
      descreverAgendamento({ ...b, tipo_gatilho: "recorrente", frequencia: "semanal", hora_local: "09:30:00", dias_semana: [1, 3] }),
    ).toBe("Seg, Qua às 09:30 (America/Sao_Paulo)");
  });
});

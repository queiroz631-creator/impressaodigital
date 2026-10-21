import { describe, expect, it } from "vitest";
import { DIAS_PADRAO, estaForaDoHorario } from "./horario-atendimento";

/** Segunda-feira, 12/10/2026, 10:00 (hora local). */
const SEG_10H = new Date(2026, 9, 12, 10, 0);
/** Domingo, 11/10/2026, 10:00. */
const DOM_10H = new Date(2026, 9, 11, 10, 0);

describe("estaForaDoHorario", () => {
  it("sem configuração, atende sempre (não está fora)", () => {
    expect(estaForaDoHorario(null)).toBe(false);
    expect(estaForaDoHorario(undefined)).toBe(false);
  });

  it("usa Seg–Sex 08:00–18:00 por padrão", () => {
    expect(DIAS_PADRAO).toEqual([1, 2, 3, 4, 5]);
    const cfg = {};
    expect(estaForaDoHorario(cfg, SEG_10H)).toBe(false);
    expect(estaForaDoHorario(cfg, DOM_10H)).toBe(true);
  });

  it("trata o fim do intervalo como exclusivo", () => {
    const cfg = { agente_atendimento_horario_inicio: "08:00", agente_atendimento_horario_fim: "18:00" };
    expect(estaForaDoHorario(cfg, new Date(2026, 9, 12, 7, 59))).toBe(true);
    expect(estaForaDoHorario(cfg, new Date(2026, 9, 12, 8, 0))).toBe(false);
    expect(estaForaDoHorario(cfg, new Date(2026, 9, 12, 17, 59))).toBe(false);
    expect(estaForaDoHorario(cfg, new Date(2026, 9, 12, 18, 0))).toBe(true);
  });

  it("respeita dias da semana customizados (0-based)", () => {
    const cfg = { agente_atendimento_dias_semana: [0, 6] };
    expect(estaForaDoHorario(cfg, DOM_10H)).toBe(false); // Domingo permitido
    expect(estaForaDoHorario(cfg, SEG_10H)).toBe(true); // Segunda fora
  });

  it("respeita horário customizado com minutos", () => {
    const cfg = { agente_atendimento_horario_inicio: "09:30", agente_atendimento_horario_fim: "17:15" };
    expect(estaForaDoHorario(cfg, new Date(2026, 9, 12, 9, 29))).toBe(true);
    expect(estaForaDoHorario(cfg, new Date(2026, 9, 12, 9, 30))).toBe(false);
    expect(estaForaDoHorario(cfg, new Date(2026, 9, 12, 17, 14))).toBe(false);
    expect(estaForaDoHorario(cfg, new Date(2026, 9, 12, 17, 15))).toBe(true);
  });

  it("tolera horário já com segundos (HH:MM:SS)", () => {
    const cfg = { agente_atendimento_horario_inicio: "08:00:00", agente_atendimento_horario_fim: "18:00:00" };
    expect(estaForaDoHorario(cfg, new Date(2026, 9, 12, 10, 0))).toBe(false);
    expect(estaForaDoHorario(cfg, new Date(2026, 9, 12, 18, 0))).toBe(true);
  });
});

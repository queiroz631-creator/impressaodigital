import { describe, expect, it } from "vitest";
import {
  gerarCsv, intervaloPeriodo, mascararCpf, percentual, taxaPremiacao, taxaRetirada,
} from "../src/modules/numero-sorte/lib/indicadores";

describe("indicadores Nº da Sorte", () => {
  it("taxa de premiação: 25 premiados de 250 participantes = 10%", () => {
    expect(taxaPremiacao(25, 250)).toBe(10);
  });
  it("campanha sem dados não divide por zero", () => {
    expect(taxaPremiacao(0, 0)).toBe(0);
    expect(taxaRetirada({})).toBe(0);
  });
  it("taxa de retirada ignora canceladas e conta entregues/aguardando/vencidas", () => {
    expect(taxaRetirada({ entregue: 2, reservado: 1, vencido: 1 })).toBe(50);
  });
  it("percentual arredonda a uma casa", () => {
    expect(percentual(1, 3)).toBe(33.3);
  });
  it("CPF exportado sempre mascarado", () => {
    expect(mascararCpf("123.456.789-09")).toBe("***.456.789-**");
    expect(mascararCpf("123")).toBe("");
  });
  it("período usa horário de Brasília e inclui o dia final", () => {
    const p = intervaloPeriodo("2026-10-01", "2026-10-01");
    expect(p.de).toBe("2026-10-01T03:00:00.000Z");
    expect(p.ate).toBe("2026-10-02T03:00:00.000Z");
    expect(intervaloPeriodo("", "x")).toEqual({ de: null, ate: null });
  });
  it("CSV usa ; , escapa aspas e neutraliza fórmulas", () => {
    const csv = gerarCsv([{ chave: "a", titulo: "A" }, { chave: "b", titulo: "B" }], [{ a: 'x"y', b: "=SOMA(1)" }, { a: true, b: null }]);
    expect(csv).toBe('\uFEFFA;B\r\n"x""y";\'=SOMA(1)\r\nSim;');
  });
});

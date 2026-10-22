import { describe, expect, it } from "vitest";
import {
  cabeNoIntervalo,
  capacidadeIntervalo,
  montarCodigo,
  sufixoDoLimite,
  validarIntervalo,
} from "../src/modules/numero-sorte/lib/codigo";

describe("intervalo do número da sorte", () => {
  it("prefixo de 1 dígito", () => expect(sufixoDoLimite("300000", 3)).toBe(0));
  it("prefixo de 2 dígitos", () => expect(sufixoDoLimite("1209999", 12)).toBe(9999));
  it("prefixo de 3 dígitos", () => expect(sufixoDoLimite("10099999", 100)).toBe(99999));
  it("preserva zeros à esquerda", () => expect(montarCodigo(12, 0)).toBe("1200000"));
  it("recusa prefixo de outra campanha", () => expect(() => sufixoDoLimite("1300000", 12)).toThrow());
  it("recusa menos de 5 dígitos após o prefixo", () => expect(() => sufixoDoLimite("120000", 12)).toThrow());
  it("capacidade 1200000–1209999 é 10.000", () => expect(capacidadeIntervalo(0, 9999)).toBe(10000));
  it("inicial maior que final é recusado", () =>
    expect(validarIntervalo({ inicial: 0, final: 9999 }, { inicial: 500, final: 100 }, false)).not.toBeNull());
  it("ampliação do final é aceita com números gerados", () =>
    expect(validarIntervalo({ inicial: 0, final: 9999 }, { inicial: 0, final: 19999 }, true)).toBeNull());
  it("redução é recusada com números gerados", () =>
    expect(validarIntervalo({ inicial: 0, final: 19999 }, { inicial: 0, final: 9999 }, true)).not.toBeNull());
  it("alterar inicial é recusado com números gerados", () =>
    expect(validarIntervalo({ inicial: 0, final: 9999 }, { inicial: 1, final: 9999 }, true)).not.toBeNull());
  it("sem capacidade suficiente", () => expect(cabeNoIntervalo(0, 9, 8, 3)).toBe(false));
  it("após ampliação volta a caber", () => expect(cabeNoIntervalo(0, 19, 8, 3)).toBe(true));
});

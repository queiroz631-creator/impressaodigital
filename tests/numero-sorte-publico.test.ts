import { describe, expect, it } from "vitest";
import { codigoPertenceCampanha, LIMITE_PADRAO_CONSULTAS } from "@/modules/numero-sorte/lib/codigo";
import { validarCpf } from "@/modules/sorteios/validations/cliente";

describe("Nº da Sorte — consulta pública", () => {
  it("aceita 6 dígitos na campanha 1", () => expect(codigoPertenceCampanha("158394", 1)).toBe(true));
  it("aceita 7 dígitos na campanha 12", () => expect(codigoPertenceCampanha("1258394", 12)).toBe(true));
  it("aceita 8 dígitos na campanha 100", () => expect(codigoPertenceCampanha("10058394", 100)).toBe(true));
  it("preserva zeros no sufixo", () => expect(codigoPertenceCampanha("1200001", 12)).toBe(true));
  it("recusa número de outra campanha", () => expect(codigoPertenceCampanha("1358394", 12)).toBe(false));
  it("recusa número curto demais", () => expect(codigoPertenceCampanha("12345", 1)).toBe(false));
  it("recusa letras", () => expect(codigoPertenceCampanha("12a8394", 12)).toBe(false));
  it("limite padrão de consultas é 10", () => expect(LIMITE_PADRAO_CONSULTAS).toBe(10));
  it("CPF inválido é recusado", () => expect(validarCpf("111.111.111-11").ok).toBe(false));
});

import { describe, expect, it } from "vitest";
import {
  decomporCodigo,
  montarCodigo,
  proximasSituacoes,
} from "../src/modules/numero-sorte/lib/codigo";

describe("número da sorte", () => {
  it("campanha 1 gera 6 dígitos", () => expect(montarCodigo(1, 58394)).toBe("158394"));
  it("campanha 10 gera 7 dígitos", () => expect(montarCodigo(10, 58394)).toBe("1058394"));
  it("campanha 100 gera 8 dígitos", () => expect(montarCodigo(100, 58394)).toBe("10058394"));
  it("sufixo 00001 preserva zeros", () => expect(montarCodigo(3, 1)).toBe("300001"));
  it("rejeita sufixo fora de 0..99999", () => expect(() => montarCodigo(1, 100000)).toThrow());
  it("decompõe 1258394 em campanha 12 e sufixo 58394", () =>
    expect(decomporCodigo("1258394")).toEqual({ campanha: 12, sufixo: "58394" }));
  it("rejeita código curto demais", () => expect(decomporCodigo("12345")).toBeNull());
  it("campanha encerrada não muda de situação", () =>
    expect(proximasSituacoes("encerrada")).toEqual([]));
});

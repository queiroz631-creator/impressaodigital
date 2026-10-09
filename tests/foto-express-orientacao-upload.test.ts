import { describe, expect, it } from "vitest";
import { orientacaoInicialDaImagem, orientacaoDaImagem } from "../src/modules/foto-express/lib/transformacaoFoto";

describe("orientação inicial das fotos enviadas", () => {
  it("usa retrato para fotos verticais", () => {
    expect(orientacaoInicialDaImagem(3000, 4000)).toBe("RETRATO");
  });
  it("usa paisagem para fotos horizontais", () => {
    expect(orientacaoInicialDaImagem(4000, 3000)).toBe("PAISAGEM");
  });
  it("usa automática para fotos quadradas", () => {
    expect(orientacaoInicialDaImagem(3000, 3000)).toBe("AUTOMATICA");
  });
  it("preserva a regra existente ao trocar formatos", () => {
    expect(orientacaoDaImagem(3000, 3000)).toBe("PAISAGEM");
  });
});
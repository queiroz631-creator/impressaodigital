import { describe, expect, it } from "vitest";
import {
  acaoRetirada,
  codigoRetiradaValido,
  extrairTokenQr,
  formatarCodigoRetirada,
  justificativaValida,
  situacaoEfetiva,
} from "../src/modules/numero-sorte/lib/retirada";

const futuro = "2999-01-01T00:00:00Z";
const passado = "2000-01-01T00:00:00Z";

describe("código curto de retirada", () => {
  it("formata em dois blocos", () => expect(formatarCodigoRetirada("k7m9p2q4")).toBe("K7M9-P2Q4"));
  it("aceita com hífen e minúsculas", () => expect(codigoRetiradaValido("k7m9-p2q4")).toBe(true));
  it("recusa caracteres ambíguos (0, O, 1, I, L)", () => expect(codigoRetiradaValido("K7M9P2Q0")).toBe(false));
  it("recusa tamanho errado", () => expect(codigoRetiradaValido("K7M9P2Q")).toBe(false));
});

describe("QR Code", () => {
  const token = "a".repeat(43);
  it("lê o token da URL", () => expect(extrairTokenQr(`https://x.app/numero-da-sorte/validar/${token}`)).toBe(token));
  it("recusa URL de campanha", () => expect(extrairTokenQr("https://x.app/numero-da-sorte/12")).toBeNull());
  it("recusa texto qualquer", () => expect(extrairTokenQr("1258394")).toBeNull());
});

describe("situação e entrega", () => {
  it("reservado no prazo pode ser entregue", () => expect(acaoRetirada("reservado", futuro, false)).toBe("entregar"));
  it("reservado fora do prazo é vencido", () => expect(situacaoEfetiva("reservado", passado)).toBe("vencido"));
  it("vencido sem permissão não entrega", () => expect(acaoRetirada("reservado", passado, false)).toBe("nenhuma"));
  it("vencido com permissão de exceção", () => expect(acaoRetirada("vencido", passado, true)).toBe("excecao"));
  it("entregue não entrega de novo", () => expect(acaoRetirada("entregue", futuro, true)).toBe("nenhuma"));
  it("cancelado não entrega", () => expect(acaoRetirada("cancelado", futuro, true)).toBe("nenhuma"));
  it("justificativa exige 10 caracteres", () => {
    expect(justificativaValida("curta")).toBe(false);
    expect(justificativaValida("Cliente hospitalizado")).toBe(true);
  });
});

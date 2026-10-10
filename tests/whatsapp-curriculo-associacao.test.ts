import { describe, expect, it } from "vitest";
import { identificarClienteCurriculo } from "../src/lib/whatsapp-curriculo-associacao";

describe("associação de currículo ao cliente", () => {
  it("prioriza o cliente vinculado à conversa", () => {
    expect(identificarClienteCurriculo("vinculado", [{ id: "outro" }])).toEqual({ clienteId: "vinculado", ambiguo: false });
  });
  it("usa o único cadastro correspondente ao telefone", () => {
    expect(identificarClienteCurriculo(null, [{ id: "cliente" }])).toEqual({ clienteId: "cliente", ambiguo: false });
  });
  it("não escolhe entre cadastros ambíguos", () => {
    expect(identificarClienteCurriculo(null, [{ id: "a" }, { id: "b" }])).toEqual({ clienteId: null, ambiguo: true });
  });
  it("não inventa associação quando não há cadastro", () => {
    expect(identificarClienteCurriculo(null, [])).toEqual({ clienteId: null, ambiguo: false });
  });
});
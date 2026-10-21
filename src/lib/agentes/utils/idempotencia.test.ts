import { describe, expect, it } from "vitest";
import { montarChaveIdempotencia } from "./idempotencia";

describe("montarChaveIdempotencia", () => {
  it("monta a chave com escopo e partes na ordem", () => {
    expect(montarChaveIdempotencia("whatsapp", "conv-1", "msg-1")).toBe("whatsapp:conv-1:msg-1");
  });

  it("remove partes nulas, indefinidas ou vazias", () => {
    expect(montarChaveIdempotencia("whatsapp", "conv-1", null, undefined, "", "msg-1")).toBe(
      "whatsapp:conv-1:msg-1",
    );
  });

  it("faz trim das partes", () => {
    expect(montarChaveIdempotencia("whatsapp", "  conv-1  ", " msg-1 ")).toBe(
      "whatsapp:conv-1:msg-1",
    );
  });

  it("converte números para texto", () => {
    expect(montarChaveIdempotencia("pedido", 42, "item", 7)).toBe("pedido:42:item:7");
  });

  it("retorna só o escopo quando não há partes válidas", () => {
    expect(montarChaveIdempotencia("whatsapp")).toBe("whatsapp");
    expect(montarChaveIdempotencia("whatsapp", null, undefined, "")).toBe("whatsapp");
  });

  it("produz a mesma chave para chamadas equivalentes (estável)", () => {
    const a = montarChaveIdempotencia("whatsapp", "conv-1", "msg-1");
    const b = montarChaveIdempotencia("whatsapp", "conv-1", "msg-1");
    expect(a).toBe(b);
  });
});

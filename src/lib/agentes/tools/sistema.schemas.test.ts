import { describe, expect, it } from "vitest";
import {
  ClienteBuscarSchema,
  ClienteBuscarWhatsAppSchema,
  ClienteDetalharSchema,
  EncaminharHumanoWhatsAppSchema,
  OrcamentoBuscarSchema,
  PedidoBuscarSchema,
} from "./sistema";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("validação de parâmetros (Zod)", () => {
  it("ClienteBuscarSchema aplica limite padrão 10 e rejeita termos vazios", () => {
    const ok = ClienteBuscarSchema.parse({ termo: "Maria" });
    expect(ok.limite).toBe(10);
    expect(ClienteBuscarSchema.safeParse({ termo: "" }).success).toBe(false);
  });

  it("ClienteBuscarSchema rejeita limite fora de 1..50", () => {
    expect(ClienteBuscarSchema.safeParse({ termo: "Maria", limite: 0 }).success).toBe(false);
    expect(ClienteBuscarSchema.safeParse({ termo: "Maria", limite: 51 }).success).toBe(false);
    expect(ClienteBuscarSchema.safeParse({ termo: "Maria", limite: 50 }).success).toBe(true);
  });

  it("ClienteDetalharSchema exige UUID válido", () => {
    expect(ClienteDetalharSchema.safeParse({ clienteId: UUID }).success).toBe(true);
    expect(ClienteDetalharSchema.safeParse({ clienteId: "abc" }).success).toBe(false);
  });

  it("PedidoBuscar/OrcamentoBuscar aplicam defaults de paginação", () => {
    const pedido = PedidoBuscarSchema.parse({});
    expect(pedido.limite).toBe(10);
    expect(pedido.offset).toBe(0);
    const orcamento = OrcamentoBuscarSchema.parse({});
    expect(orcamento.limite).toBe(10);
    expect(orcamento.offset).toBe(0);
    expect(OrcamentoBuscarSchema.safeParse({ offset: -1 }).success).toBe(false);
  });

  it("ClienteBuscarWhatsAppSchema exige telefone (10..20) e default criarSeNaoExistir=false", () => {
    const ok = ClienteBuscarWhatsAppSchema.parse({ telefone: "5573999990001" });
    expect(ok.criarSeNaoExistir).toBe(false);
    expect(ClienteBuscarWhatsAppSchema.safeParse({ telefone: "123" }).success).toBe(false);
  });

  it("EncaminharHumanoWhatsAppSchema exige telefone e limita motivo a 300", () => {
    expect(EncaminharHumanoWhatsAppSchema.safeParse({ telefone: "5573999990001" }).success).toBe(
      true,
    );
    expect(EncaminharHumanoWhatsAppSchema.safeParse({ telefone: "123" }).success).toBe(false);
    const longo = "x".repeat(301);
    expect(
      EncaminharHumanoWhatsAppSchema.safeParse({ telefone: "5573999990001", motivo: longo })
        .success,
    ).toBe(false);
  });
});

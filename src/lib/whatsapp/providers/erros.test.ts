import { describe, expect, it } from "vitest";
import { classificarFalha, erroNaoSuportado, falhaNaoSuportada } from "./erros";

describe("classificarFalha", () => {
  it.each([
    [401, "nao_autenticado", false],
    [403, "nao_autenticado", false],
    [404, "nao_encontrado", false],
    [408, "timeout", true],
    [429, "rate_limit", true],
    [500, "servidor", true],
    [503, "servidor", true],
    [400, "invalido", false],
    [422, "invalido", false],
  ])("HTTP %i → %s (retentável=%s)", (status, codigo, retentavel) => {
    const e = classificarFalha(status, "x");
    expect(e.codigo).toBe(codigo);
    expect(e.retentavel).toBe(retentavel);
    expect(e.httpStatus).toBe(status);
  });

  it("status 0 distingue credenciais ausentes, timeout e rede", () => {
    expect(classificarFalha(0, "Credenciais da Z-API não configuradas.")).toMatchObject({
      codigo: "nao_configurado",
      retentavel: false,
      httpStatus: null,
    });
    expect(classificarFalha(0, "The operation timed out")).toMatchObject({ codigo: "timeout", retentavel: true });
    expect(classificarFalha(0, "ECONNRESET")).toMatchObject({ codigo: "rede", retentavel: true });
  });

  it("preserva a mensagem original e usa texto padrão quando vazia", () => {
    expect(classificarFalha(400, "Client-Token inválido").mensagem).toBe("Client-Token inválido");
    expect(classificarFalha(500, "").mensagem).toMatch(/Falha na comunicação/);
    expect(classificarFalha(500, null).mensagem).toMatch(/Falha na comunicação/);
  });
});

describe("não suportado", () => {
  it("devolve erro padronizado, nunca sucesso", () => {
    const e = erroNaoSuportado("zapi", "editarMensagem");
    expect(e).toMatchObject({ codigo: "nao_suportado", retentavel: false, httpStatus: null });
    expect(e.mensagem).toContain("editarMensagem");
    const r = falhaNaoSuportada("evolution", "x", "motivo");
    expect(r).toEqual({ ok: false, erro: expect.objectContaining({ codigo: "nao_suportado", mensagem: "motivo" }) });
  });
});

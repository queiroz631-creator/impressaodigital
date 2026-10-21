import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { executarFerramenta, type ToolContext, type ToolDefinition } from "./sistema";

/** Chave cujo nome para function calling troca ponto por underscore. */
const CHAVE = "teste.acao";
const NOME = "teste_acao";

function criarContexto(contextoSistema: boolean, podeAcao: boolean) {
  const rpc = vi.fn(async () => ({ data: podeAcao, error: null }));
  const ctx = {
    supabase: { rpc },
    supabaseAdmin: {},
    userId: "user-1",
    agenteId: "ag-1",
    execucaoId: "exec-1",
    passoId: "passo-1",
    contextoSistema,
  } as unknown as ToolContext;
  return { ctx, rpc };
}

function ferramentaFalsa(over: Partial<ToolDefinition<any, any>> = {}): ToolDefinition<any, any> {
  return {
    chave: CHAVE,
    nome: "Ação de teste",
    descricao: "ferramenta de teste",
    categoria: "teste",
    tipo: "acao",
    risco: "alto",
    sensivel: true,
    efeito_externo: true,
    idempotente: false,
    parametrosSchema: z.object({ valor: z.string() }),
    executar: async (_ctx, params) => ({ ok: true, data: params }),
    ...over,
  };
}

describe("executarFerramenta — resolução e validação", () => {
  it("retorna erro para ferramenta desconhecida", async () => {
    const { ctx } = criarContexto(true, true);
    const r = await executarFerramenta(ctx, [ferramentaFalsa()], {
      name: "nao_existe",
      arguments: {},
      id: "c1",
    });
    expect(r.ok).toBe(false);
    expect(r.erro).toContain("não encontrada");
  });

  it("rejeita parâmetros inválidos sem executar", async () => {
    const executar = vi.fn(async () => ({ ok: true }));
    const { ctx } = criarContexto(true, true);
    const r = await executarFerramenta(ctx, [ferramentaFalsa({ executar })], {
      name: NOME,
      arguments: { valor: 123 },
      id: "c1",
    });
    expect(r.ok).toBe(false);
    expect(r.erro).toContain("Parâmetros inválidos");
    expect(executar).not.toHaveBeenCalled();
  });

  it("captura exceção da execução e devolve erro", async () => {
    const { ctx } = criarContexto(true, true);
    const r = await executarFerramenta(
      ctx,
      [
        ferramentaFalsa({
          executar: async () => {
            throw new Error("falha simulada");
          },
        }),
      ],
      { name: NOME, arguments: { valor: "x" }, id: "c1" },
    );
    expect(r.ok).toBe(false);
    expect(r.erro).toBe("falha simulada");
  });
});

describe("executarFerramenta — política de permissão e contexto de sistema", () => {
  it("ferramenta sensível SEM permissão (usuário) é bloqueada", async () => {
    const { ctx, rpc } = criarContexto(false, false);
    const r = await executarFerramenta(ctx, [ferramentaFalsa()], {
      name: NOME,
      arguments: { valor: "x" },
      id: "c1",
    });
    expect(r.ok).toBe(false);
    expect(r.erro).toContain("Sem permissão");
    expect(rpc).toHaveBeenCalledWith("agente_pode_acao", { _chave: "agentes.executar" });
  });

  it("ferramenta sensível COM permissão (usuário) executa", async () => {
    const { ctx, rpc } = criarContexto(false, true);
    const r = await executarFerramenta(ctx, [ferramentaFalsa()], {
      name: NOME,
      arguments: { valor: "x" },
      id: "c1",
    });
    expect(r.ok).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("contexto de sistema (worker) dispensa o gate por usuário", async () => {
    const { ctx, rpc } = criarContexto(true, false);
    const r = await executarFerramenta(ctx, [ferramentaFalsa()], {
      name: NOME,
      arguments: { valor: "x" },
      id: "c1",
    });
    expect(r.ok).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("ferramenta não sensível executa sem consultar permissão", async () => {
    const { ctx, rpc } = criarContexto(false, false);
    const r = await executarFerramenta(ctx, [ferramentaFalsa({ sensivel: false })], {
      name: NOME,
      arguments: { valor: "x" },
      id: "c1",
    });
    expect(r.ok).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });
});

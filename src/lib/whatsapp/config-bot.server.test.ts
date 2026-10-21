import { beforeEach, describe, expect, it, vi } from "vitest";
import { BancoFalso } from "./testes/banco-falso";

const ref = vi.hoisted(() => ({ banco: null as unknown as BancoFalso }));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (n: string) => ref.banco.from(n),
    rpc: (n: string, a: Record<string, unknown>) => ref.banco.rpc(n, a),
  },
}));

import "@/integrations/supabase/client.server";
import { garantirConfiguracaoDaConexao, horarioPadrao } from "./config-bot.server";

const CONEXAO = "f22e6c29-cc79-49e9-b0ad-c591814be496";

const config = () => ref.banco.tabela("whatsapp_config");
const horarios = () => ref.banco.tabela("bot_horarios");

beforeEach(() => {
  ref.banco = new BancoFalso();
});

describe("horarioPadrao", () => {
  it("domingo começa fechado e os demais abertos", () => {
    expect(horarioPadrao(CONEXAO, 0)).toEqual({ conexao_id: CONEXAO, dia_semana: 0, fechado: true });
    expect(horarioPadrao(CONEXAO, 1)).toEqual({ conexao_id: CONEXAO, dia_semana: 1, fechado: false });
  });
});

describe("garantirConfiguracaoDaConexao", () => {
  it("cria a configuração e os sete dias quando não existe nada", async () => {
    const criada = await garantirConfiguracaoDaConexao(CONEXAO, "Eduardo");

    expect(criada).toBe(true);
    expect(config()).toHaveLength(1);
    expect(config()[0]?.["conexao_id"]).toBe(CONEXAO);
    expect(config()[0]?.["conexao_nome"]).toBe("Eduardo");
    // Nunca liga o atendimento automático por conta própria.
    expect(config()[0]?.["bot_ativo"]).toBe(false);
    expect(horarios()).toHaveLength(7);
    expect(horarios().filter((h) => h["fechado"] === true)).toHaveLength(1);
  });

  it("é idempotente: não recria nem duplica", async () => {
    await garantirConfiguracaoDaConexao(CONEXAO, "Eduardo");
    const segunda = await garantirConfiguracaoDaConexao(CONEXAO, "Eduardo");

    expect(segunda).toBe(false);
    expect(config()).toHaveLength(1);
    expect(horarios()).toHaveLength(7);
  });

  it("configuração existente não é alterada", async () => {
    ref.banco.semear("whatsapp_config", [
      { id: "cfg1", conexao_id: CONEXAO, conexao_nome: "Eduardo", bot_ativo: true },
    ]);

    const criada = await garantirConfiguracaoDaConexao(CONEXAO, "Eduardo");

    expect(criada).toBe(false);
    expect(config()).toHaveLength(1);
    // Bot já ligado pelo usuário permanece ligado.
    expect(config()[0]?.["bot_ativo"]).toBe(true);
  });

  it("não mexe nos horários quando a conexão já tem algum dia cadastrado", async () => {
    ref.banco.semear("whatsapp_config", [{ id: "cfg1", conexao_id: CONEXAO, bot_ativo: false }]);
    ref.banco.semear("bot_horarios", [{ id: "h1", conexao_id: CONEXAO, dia_semana: 0, fechado: false }]);

    await garantirConfiguracaoDaConexao(CONEXAO, "Eduardo");

    expect(horarios()).toHaveLength(1);
  });

  it("duas chamadas concorrentes não geram configuração duplicada", async () => {
    const [a, b] = await Promise.all([
      garantirConfiguracaoDaConexao(CONEXAO, "Eduardo"),
      garantirConfiguracaoDaConexao(CONEXAO, "Eduardo"),
    ]);

    expect(config()).toHaveLength(1);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });
});

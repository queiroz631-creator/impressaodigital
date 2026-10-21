import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BancoFalso } from "@/lib/whatsapp/testes/banco-falso";

/**
 * Envio do agente/worker por conexões de provedores diferentes: cada conversa
 * deve sair pelo provedor da PRÓPRIA conexão, sem misturar credenciais.
 */

const ref = vi.hoisted(() => ({ banco: null as unknown as BancoFalso }));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (n: string) => ref.banco.from(n), rpc: (n: string, a: Record<string, unknown>) => ref.banco.rpc(n, a) },
}));
vi.mock("node:dns/promises", () => ({
  lookup: async () => [{ address: "8.8.8.8", family: 4 }],
}));

import { limparCacheEvolution } from "@/lib/whatsapp/providers/evolution-cliente.server";
import { enviarTextoDaConversa } from "./whatsapp-envio.server";

const CX_EVO = "11111111-1111-4111-8111-111111111111";
const CX_ZAPI = "33333333-3333-4333-8333-333333333333";
const SERVIDOR = "22222222-2222-4222-8222-222222222222";
const ENV_ORIGINAL = { ...process.env };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env["EVOLUTION_API_KEY"] = "chave-evolution";
  limparCacheEvolution();
  ref.banco = new BancoFalso();
  ref.banco.semear("whatsapp_servidores", [
    { id: SERVIDOR, provedor: "evolution", base_url: "https://evo.exemplo.com", segredo_ref: "EVOLUTION_API_KEY", ativo: true },
  ]);
  ref.banco.semear("whatsapp_conexoes", [
    { id: CX_EVO, provedor: "evolution", servidor_id: SERVIDOR, id_externo: "inst-1" },
    { id: CX_ZAPI, provedor: "zapi", base_url: "", instance_id: "ZID", instance_token: "ZTOK", client_token: "ZCLI" },
  ]);
  ref.banco.semear("whatsapp_conversas", [
    { id: "c-evo", telefone: "5511999990000", conexao_id: CX_EVO },
    { id: "c-zapi", telefone: "5511888880000", conexao_id: CX_ZAPI },
  ]);
  ref.banco.semear("whatsapp_mensagens", []);
  fetchMock = vi.fn(async (url: unknown) =>
    String(url).includes("evo.exemplo.com")
      ? new Response(JSON.stringify({ key: { id: "3EB0A" } }), { status: 200 })
      : new Response(JSON.stringify({ messageId: "ZID-1" }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  process.env = { ...ENV_ORIGINAL };
  vi.unstubAllGlobals();
});

describe("enviarTextoDaConversa por provedor", () => {
  it("conversa de conexão Evolution sai pela Evolution e grava o id prefixado", async () => {
    const r = await enviarTextoDaConversa({ conversaId: "c-evo", texto: "Olá" });

    expect(r).toEqual({ ok: true, mensagemId: `evo:${CX_EVO}:3EB0A`, erro: null });
    expect(String(fetchMock.mock.calls[0]![0])).toBe("https://evo.exemplo.com/message/sendText/inst-1");
    const gravada = ref.banco.tabela("whatsapp_mensagens")[0]!;
    expect(gravada).toMatchObject({
      conversa_id: "c-evo",
      direcao: "saida",
      whatsapp_message_id: `evo:${CX_EVO}:3EB0A`,
      status: "enviada",
    });
  });

  it("conversa de conexão Z-API continua saindo pela Z-API com as credenciais da própria conexão", async () => {
    const r = await enviarTextoDaConversa({ conversaId: "c-zapi", texto: "Oi" });

    expect(r).toEqual({ ok: true, mensagemId: "ZID-1", erro: null });
    expect(String(fetchMock.mock.calls[0]![0])).toBe("https://api.z-api.io/instances/ZID/token/ZTOK/send-text");
  });

  it("falha da Evolution é registrada como erro, sem cair na Z-API", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: "instância offline" }), { status: 500 }));
    const r = await enviarTextoDaConversa({ conversaId: "c-evo", texto: "Olá" });

    expect(r.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toContain("evo.exemplo.com");
    expect(ref.banco.tabela("whatsapp_mensagens")[0]).toMatchObject({ status: "erro" });
  });
});

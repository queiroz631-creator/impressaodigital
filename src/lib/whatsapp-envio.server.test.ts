import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Caracterização de `enviarTextoDaConversa` (envio do agente/worker).
 * Deve continuar idêntico depois que o envio passar pela camada de provedor.
 */

const estado = vi.hoisted(() => ({
  conversa: null as Record<string, unknown> | null,
  conexao: null as Record<string, unknown> | null,
  insercoes: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (tabela: string) => {
      const b: Record<string, unknown> = {};
      b["select"] = () => b;
      b["eq"] = () => b;
      b["maybeSingle"] = async () => ({
        data: tabela === "whatsapp_conexoes" ? estado.conexao : estado.conversa,
      });
      b["insert"] = async (linha: Record<string, unknown>) => {
        if (tabela === "whatsapp_mensagens") estado.insercoes.push(linha);
        return { error: null };
      };
      return b;
    },
  },
}));

import { enviarTextoDaConversa } from "./whatsapp-envio.server";

const ENV_ORIGINAL = { ...process.env };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env["ZAPI_INSTANCE_ID"] = "ENV_ID";
  process.env["ZAPI_INSTANCE_TOKEN"] = "ENV_TOKEN";
  process.env["ZAPI_CLIENT_TOKEN"] = "ENV_CLIENT";
  estado.conversa = { id: "conv-1", telefone: "5511999990000", conexao_id: "conn-1" };
  estado.conexao = { base_url: "", instance_id: "CID", instance_token: "CTOK", client_token: "CCLI" };
  estado.insercoes = [];
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ messageId: "WID-1" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  process.env = { ...ENV_ORIGINAL };
  vi.unstubAllGlobals();
});

describe("enviarTextoDaConversa", () => {
  it("envia pela conexão da conversa e registra a saída no histórico", async () => {
    const r = await enviarTextoDaConversa({ conversaId: "conv-1", texto: "  Olá!  " });

    expect(r).toEqual({ ok: true, mensagemId: "WID-1", erro: null });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.z-api.io/instances/CID/token/CTOK/send-text");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ phone: "5511999990000", message: "Olá!" });

    expect(estado.insercoes).toHaveLength(1);
    expect(estado.insercoes[0]).toMatchObject({
      conversa_id: "conv-1",
      direcao: "saida",
      tipo: "texto",
      texto: "Olá!",
      autor: "Agente IA",
      whatsapp_message_id: "WID-1",
      status: "enviada",
      erro: null,
    });
  });

  it("usa zaapId quando messageId não vem", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ zaapId: "ZAAP-7" }), { status: 200 }));
    const r = await enviarTextoDaConversa({ conversaId: "conv-1", texto: "oi" });
    expect(r.mensagemId).toBe("ZAAP-7");
  });

  it("autor personalizado e registrar=false (não grava no histórico)", async () => {
    await enviarTextoDaConversa({ conversaId: "conv-1", texto: "oi", autor: "Sistema", registrar: false });
    expect(estado.insercoes).toHaveLength(0);
    await enviarTextoDaConversa({ conversaId: "conv-1", texto: "oi", autor: "Sistema" });
    expect(estado.insercoes[0]).toMatchObject({ autor: "Sistema" });
  });

  it("falha do provedor: devolve erro, grava status `erro` e nunca lança", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "instância desconectada" }), { status: 400 }));
    const r = await enviarTextoDaConversa({ conversaId: "conv-1", texto: "oi" });
    expect(r).toEqual({ ok: false, mensagemId: null, erro: "instância desconectada" });
    expect(estado.insercoes[0]).toMatchObject({ status: "erro", erro: "instância desconectada", whatsapp_message_id: null });
  });

  it("texto vazio é recusado sem chamar a rede", async () => {
    const r = await enviarTextoDaConversa({ conversaId: "conv-1", texto: "   " });
    expect(r).toEqual({ ok: false, mensagemId: null, erro: "Mensagem vazia" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("conversa sem telefone é recusada sem chamar a rede", async () => {
    estado.conversa = { id: "conv-1", telefone: "", conexao_id: "conn-1" };
    const r = await enviarTextoDaConversa({ conversaId: "conv-1", texto: "oi" });
    expect(r).toEqual({ ok: false, mensagemId: null, erro: "Conversa sem telefone" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

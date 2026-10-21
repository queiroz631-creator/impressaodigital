import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O adaptador Z-API deve produzir EXATAMENTE as mesmas requisições que o
 * sistema já faz hoje (mesma URL, método e corpo). Estes testes comparam com
 * os valores literais usados em produção.
 */

const estado = vi.hoisted(() => ({
  conexao: null as Record<string, unknown> | null,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => {
      const b: Record<string, unknown> = {};
      b["select"] = () => b;
      b["eq"] = () => b;
      b["maybeSingle"] = async () => ({ data: estado.conexao });
      return b;
    },
  },
}));

import {
  apagarMensagemPelaConexao,
  consultarStatusDaConexao,
  enviarMidiaPelaConexao,
  enviarPresencaPelaConexao,
  enviarTextoPelaConexao,
} from "../provedor.server";
import { definirResolvedorDeProvedor, obterProvedorDaConexao, obterProvedorPorId, provedoresRegistrados } from "./registro.server";
import { zapiAdapter } from "./zapi-adapter.server";

const BASE = "https://api.z-api.io/instances/ENV_ID/token/ENV_TOKEN";
const ENV_ORIGINAL = { ...process.env };
let fetchMock: ReturnType<typeof vi.fn>;

function chamada(i = 0) {
  const [url, init] = fetchMock.mock.calls[i] as [string, RequestInit];
  return { url, metodo: init.method, corpo: init.body ? JSON.parse(String(init.body)) : undefined };
}

beforeEach(() => {
  process.env["ZAPI_INSTANCE_ID"] = "ENV_ID";
  process.env["ZAPI_INSTANCE_TOKEN"] = "ENV_TOKEN";
  process.env["ZAPI_CLIENT_TOKEN"] = "ENV_CLIENT";
  delete process.env["ZAPI_BASE_URL"];
  estado.conexao = null;
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ messageId: "WID-1" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  definirResolvedorDeProvedor(null);
});

afterEach(() => {
  process.env = { ...ENV_ORIGINAL };
  vi.unstubAllGlobals();
  definirResolvedorDeProvedor(null);
});

describe("Z-API via camada de provedor — paridade de requisições", () => {
  it("texto: POST send-text {phone, message}", async () => {
    const r = await enviarTextoPelaConexao(null, { telefone: "5511999990000", texto: "oi" });
    expect(r).toEqual({ ok: true, dados: { mensagemId: "WID-1" } });
    expect(chamada()).toEqual({
      url: `${BASE}/send-text`,
      metodo: "POST",
      corpo: { phone: "5511999990000", message: "oi" },
    });
  });

  it("id da mensagem: messageId, depois zaapId, senão null", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ zaapId: "Z1" }), { status: 200 }));
    expect(await enviarTextoPelaConexao(null, { telefone: "1", texto: "a" })).toEqual({ ok: true, dados: { mensagemId: "Z1" } });
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    expect(await enviarTextoPelaConexao(null, { telefone: "1", texto: "a" })).toEqual({ ok: true, dados: { mensagemId: null } });
  });

  it("imagem, áudio e vídeo", async () => {
    await enviarMidiaPelaConexao(null, { telefone: "55", tipo: "imagem", url: "https://u/i.jpg", legenda: "leg" });
    await enviarMidiaPelaConexao(null, { telefone: "55", tipo: "audio", url: "https://u/a.ogg" });
    await enviarMidiaPelaConexao(null, { telefone: "55", tipo: "video", url: "https://u/v.mp4", legenda: "v" });
    expect(chamada(0)).toMatchObject({ url: `${BASE}/send-image`, corpo: { phone: "55", image: "https://u/i.jpg", caption: "leg" } });
    expect(chamada(1)).toMatchObject({ url: `${BASE}/send-audio`, corpo: { phone: "55", audio: "https://u/a.ogg" } });
    expect(chamada(2)).toMatchObject({ url: `${BASE}/send-video`, corpo: { phone: "55", video: "https://u/v.mp4", caption: "v" } });
  });

  it("documento usa a extensão do arquivo na rota (padrão pdf)", async () => {
    await enviarMidiaPelaConexao(null, { telefone: "55", tipo: "documento", url: "data:x", nomeArquivo: "Relatorio.XLSX", legenda: "l" });
    await enviarMidiaPelaConexao(null, { telefone: "55", tipo: "documento", url: "data:x" });
    expect(chamada(0)).toMatchObject({
      url: `${BASE}/send-document/xlsx`,
      corpo: { phone: "55", document: "data:x", fileName: "Relatorio.XLSX", caption: "l" },
    });
    expect(chamada(1)).toMatchObject({
      url: `${BASE}/send-document/pdf`,
      corpo: { fileName: "documento.pdf", caption: "" },
    });
  });

  it("presença: send-presence composing com atraso limitado", async () => {
    await enviarPresencaPelaConexao(null, "5511", 99_999);
    expect(chamada()).toEqual({
      url: `${BASE}/send-presence`,
      metodo: "POST",
      corpo: { phone: "5511", presence: "composing", delay: 15000 },
    });
  });

  it("apagar mensagem: DELETE messages?messageId&phone&owner=true (com encode)", async () => {
    const r = await apagarMensagemPelaConexao(null, { telefone: "5511", mensagemId: "A/B C" });
    expect(r).toEqual({ ok: true, dados: null });
    expect(chamada()).toMatchObject({
      url: `${BASE}/messages?messageId=A%2FB%20C&phone=5511&owner=true`,
      metodo: "DELETE",
    });
  });

  it("publicar status: texto e imagem", async () => {
    await zapiAdapter.publicarStatus({ conexaoId: null }, { tipo: "texto", texto: "Promo", corFundo: "#fff" });
    await zapiAdapter.publicarStatus({ conexaoId: null }, { tipo: "imagem", imagemUrl: "https://u/i.jpg", legenda: "x" });
    expect(chamada(0)).toMatchObject({ url: `${BASE}/send-text-status`, corpo: { message: "Promo", backgroundColor: "#fff" } });
    expect(chamada(1)).toMatchObject({ url: `${BASE}/send-image-status`, corpo: { image: "https://u/i.jpg", caption: "x" } });
  });

  it("status da conexão: conectado e desconectado, com as mesmas mensagens atuais", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ connected: true }), { status: 200 }));
    expect(await consultarStatusDaConexao(null)).toEqual({ ok: true, dados: { conectado: true, detalhe: "Número conectado." } });
    expect(chamada(0)).toMatchObject({ url: `${BASE}/status`, metodo: "GET" });

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ connected: false }), { status: 200 }));
    expect(await consultarStatusDaConexao(null)).toEqual({
      ok: true,
      dados: { conectado: false, detalhe: "Número desconectado — leia o QR Code na Z-API." },
    });

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ connected: false, error: "You are not connected." }), { status: 200 }));
    expect((await consultarStatusDaConexao(null)) as { dados: { detalhe: string } }).toMatchObject({
      dados: { detalhe: "You are not connected." },
    });
  });

  it("webhook: 4 PUT update-webhook-* + update-notify-sent-by-me", async () => {
    const r = await zapiAdapter.configurarWebhook({ conexaoId: null }, { url: "https://site/api/public/whatsapp/webhook/TOK" });
    expect(r).toEqual({
      ok: true,
      dados: { configurados: ["Ao receber", "Ao enviar", "Status da mensagem", "Ao desconectar"], falhas: [] },
    });
    const urls = fetchMock.mock.calls.map((c) => (c as [string])[0].replace(BASE, ""));
    expect(urls).toEqual([
      "/update-webhook-received",
      "/update-webhook-delivery",
      "/update-webhook-message-status",
      "/update-webhook-disconnected",
      "/update-notify-sent-by-me",
    ]);
    expect(chamada(0)).toMatchObject({ metodo: "PUT", corpo: { value: "https://site/api/public/whatsapp/webhook/TOK" } });
    expect(chamada(4)).toMatchObject({ metodo: "PUT", corpo: { notifySentByMe: true } });
  });

  it("webhook: falha parcial lista os rótulos; falha total vira erro", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 500 }))
      .mockImplementation(async () => new Response("{}", { status: 200 }));
    const parcial = await zapiAdapter.configurarWebhook({ conexaoId: null }, { url: "https://x" });
    expect(parcial).toMatchObject({ ok: true, dados: { falhas: ["Ao enviar"] } });

    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ error: "token" }), { status: 401 }));
    const total = await zapiAdapter.configurarWebhook({ conexaoId: null }, { url: "https://x" });
    expect(total).toMatchObject({ ok: false, erro: { codigo: "nao_autenticado" } });
  });

  it("usa as credenciais da conexão informada (isolamento entre conexões)", async () => {
    estado.conexao = { base_url: "", instance_id: "CID", instance_token: "CTOK", client_token: "CCLI" };
    await enviarTextoPelaConexao("conn-1", { telefone: "55", texto: "x" });
    expect(chamada().url).toBe("https://api.z-api.io/instances/CID/token/CTOK/send-text");
  });
});

describe("Z-API via camada de provedor — erros padronizados", () => {
  it("HTTP 401 → nao_autenticado com a mensagem original do provedor", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Client-Token inválido" }), { status: 401 }));
    expect(await enviarTextoPelaConexao(null, { telefone: "1", texto: "a" })).toEqual({
      ok: false,
      erro: { codigo: "nao_autenticado", mensagem: "Client-Token inválido", httpStatus: 401, retentavel: false },
    });
  });

  it("HTTP 500 e falha de rede são retentáveis", async () => {
    fetchMock.mockResolvedValueOnce(new Response("x", { status: 502 }));
    expect(await enviarTextoPelaConexao(null, { telefone: "1", texto: "a" })).toMatchObject({
      ok: false,
      erro: { codigo: "servidor", retentavel: true, mensagem: "HTTP 502" },
    });
    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET"));
    expect(await enviarTextoPelaConexao(null, { telefone: "1", texto: "a" })).toMatchObject({
      ok: false,
      erro: { codigo: "rede", retentavel: true },
    });
  });

  it("sem credenciais: nao_configurado e nenhuma chamada de rede", async () => {
    delete process.env["ZAPI_INSTANCE_ID"];
    const r = await enviarTextoPelaConexao(null, { telefone: "1", texto: "a" });
    expect(r).toMatchObject({ ok: false, erro: { codigo: "nao_configurado", retentavel: false } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("operações sem suporte retornam nao_suportado e NÃO chamam a rede", async () => {
    for (const r of [
      await zapiAdapter.editarMensagem({ conexaoId: null }, { telefone: "5511", mensagemId: "X", texto: "y" }),
      await zapiAdapter.obterQrCode({ conexaoId: null }),
      await zapiAdapter.criarInstancia({ conexaoId: null }, "x"),
      await zapiAdapter.desconectar({ conexaoId: null }),
    ]) {
      expect(r).toMatchObject({ ok: false, erro: { codigo: "nao_suportado" } });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("capacidades refletem o que o adaptador realmente implementa", () => {
    expect(zapiAdapter.capacidades).toMatchObject({
      enviarTexto: true,
      enviarDocumento: true,
      configurarWebhook: true,
      editarMensagem: false,
      obterQrCode: false,
      criarInstancia: false,
    });
  });
});

describe("registro de provedores", () => {
  it("Z-API é o padrão de qualquer conexão; Z-API e Evolution estão registradas", async () => {
    expect(provedoresRegistrados()).toEqual(["zapi", "evolution"]);
    const p = await obterProvedorDaConexao("qualquer-conexao");
    expect(p).toMatchObject({ ok: true });
    expect(obterProvedorPorId("zapi")).toBe(zapiAdapter);
    expect(obterProvedorPorId("evolution")?.id).toBe("evolution");
    expect(obterProvedorPorId("baileys")).toBeNull();
  });

  it("provedor desconhecido/indisponível: nao_configurado, sem cair em outro provedor", async () => {
    definirResolvedorDeProvedor(async () => "baileys");
    const r = await enviarTextoPelaConexao("c", { telefone: "1", texto: "a" });
    expect(r).toMatchObject({ ok: false, erro: { codigo: "nao_configurado" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falha ao resolver o provedor é devolvida como erro (não lança)", async () => {
    definirResolvedorDeProvedor(async () => {
      throw new Error("banco indisponível");
    });
    const r = await enviarTextoPelaConexao("c", { telefone: "1", texto: "a" });
    expect(r).toMatchObject({ ok: false, erro: { mensagem: "banco indisponível", retentavel: true } });
  });
});

describe("resolvedor de provedor lendo o banco", () => {
  it("lê `whatsapp_conexoes.provedor` e usa cache curto (1 consulta para várias operações)", async () => {
    estado.conexao = { provedor: "evolution" };
    const r1 = await obterProvedorDaConexao("conn-x");
    expect(r1).toMatchObject({ ok: true, dados: { id: "evolution" } });

    // Provedor sem adaptador: erro explícito, sem cair em outro provedor.
    estado.conexao = { provedor: "baileys" };
    const r2 = await obterProvedorDaConexao("conn-w");
    expect(r2).toMatchObject({ ok: false, erro: { codigo: "nao_configurado" } });
    expect((r2 as { erro: { mensagem: string } }).erro.mensagem).toContain("baileys");
  });

  it("coluna ausente, valor nulo ou conexão inexistente → zapi", async () => {
    for (const conexao of [{ base_url: "x" }, { provedor: null }, null]) {
      estado.conexao = conexao;
      definirResolvedorDeProvedor(null);
      expect(await obterProvedorDaConexao("conn-y")).toMatchObject({ ok: true });
    }
  });

  it("sem conexão (null) → zapi, sem consultar o banco", async () => {
    estado.conexao = { provedor: "evolution" };
    expect(await obterProvedorDaConexao(null)).toMatchObject({ ok: true });
  });

  it("o cache evita nova leitura dentro do TTL e `definirResolvedorDeProvedor(null)` o limpa", async () => {
    estado.conexao = { provedor: "zapi" };
    expect(await obterProvedorDaConexao("conn-z")).toMatchObject({ ok: true });
    estado.conexao = { provedor: "baileys" }; // mudou no banco, mas o cache ainda vale
    expect(await obterProvedorDaConexao("conn-z")).toMatchObject({ ok: true, dados: { id: "zapi" } });
    definirResolvedorDeProvedor(null); // limpa o cache
    expect(await obterProvedorDaConexao("conn-z")).toMatchObject({ ok: false, erro: { codigo: "nao_configurado" } });
  });
});
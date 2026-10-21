import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BancoFalso } from "../testes/banco-falso";

const ref = vi.hoisted(() => ({ banco: null as unknown as BancoFalso }));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (n: string) => ref.banco.from(n), rpc: (n: string, a: Record<string, unknown>) => ref.banco.rpc(n, a) },
}));

// DNS controlado: o servidor de teste resolve para IP público (ou privado, quando o teste pede).
const dns = vi.hoisted(() => ({ ips: ["8.8.8.8"] as string[] }));
vi.mock("node:dns/promises", () => ({
  lookup: async () => dns.ips.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })),
}));

import "@/integrations/supabase/client.server";
import { evolutionAdapter, CABECALHO_SEGREDO_WEBHOOK, derivarSegredoWebhook } from "./evolution-adapter.server";
import { limparCacheEvolution } from "./evolution-cliente.server";
import { obterProvedorDaConexao } from "./registro.server";

const CONEXAO = "11111111-1111-4111-8111-111111111111";
const SERVIDOR = "22222222-2222-4222-8222-222222222222";
const CHAVE = "chave-secreta-do-servidor-evolution";
const ctx = { conexaoId: CONEXAO };
const ENV_ORIGINAL = { ...process.env };
let fetchMock: ReturnType<typeof vi.fn>;

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status });
}

function req(i = 0) {
  const [url, init] = fetchMock.mock.calls[i] as [URL, RequestInit];
  return {
    url: String(url),
    metodo: init.method,
    headers: init.headers as Record<string, string>,
    corpo: init.body ? JSON.parse(String(init.body)) : undefined,
  };
}

beforeEach(() => {
  process.env["EVOLUTION_API_KEY"] = CHAVE;
  process.env["WHATSAPP_WEBHOOK_SEGREDO"] = "segredo-de-webhook-com-mais-de-16";
  delete process.env["WHATSAPP_HOSTS_PERMITIDOS"];
  dns.ips = ["8.8.8.8"];
  limparCacheEvolution();

  ref.banco = new BancoFalso();
  ref.banco.semear("whatsapp_servidores", [
    { id: SERVIDOR, provedor: "evolution", base_url: "https://evo.exemplo.com/", segredo_ref: "EVOLUTION_API_KEY", ativo: true },
  ]);
  ref.banco.semear("whatsapp_conexoes", [
    { id: CONEXAO, provedor: "evolution", servidor_id: SERVIDOR, id_externo: "inst-1", webhook_token: "tok-conexao" },
  ]);

  fetchMock = vi.fn(async () => json({}));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  process.env = { ...ENV_ORIGINAL };
  vi.unstubAllGlobals();
});

describe("envio de texto", () => {
  it("POST message/sendText/{instância} com apikey no cabeçalho e número só com dígitos", async () => {
    fetchMock.mockResolvedValueOnce(json({ key: { remoteJid: "5511999990000@s.whatsapp.net", fromMe: true, id: "3EB0XYZ" }, status: "PENDING" }));
    const r = await evolutionAdapter.enviarTexto(ctx, { telefone: "+55 (11) 99999-0000", texto: "Olá" });

    expect(r).toEqual({ ok: true, dados: { mensagemId: `evo:${CONEXAO}:3EB0XYZ` } });
    const q = req();
    expect(q.url).toBe("https://evo.exemplo.com/message/sendText/inst-1");
    expect(q.metodo).toBe("POST");
    expect(q.headers).toMatchObject({ apikey: CHAVE, "Content-Type": "application/json" });
    expect(q.corpo).toEqual({ number: "5511999990000", text: "Olá" });
  });

  it("nome de instância com caracteres especiais é codificado na URL", async () => {
    ref.banco.tabela("whatsapp_conexoes")[0]!["id_externo"] = "inst/../x";
    await evolutionAdapter.enviarTexto(ctx, { telefone: "5511", texto: "a" });
    expect(req().url).toBe("https://evo.exemplo.com/message/sendText/inst%2F..%2Fx");
  });

  it("sem id na resposta: sucesso com mensagemId nulo", async () => {
    expect(await evolutionAdapter.enviarTexto(ctx, { telefone: "5511", texto: "a" })).toEqual({ ok: true, dados: { mensagemId: null } });
  });
});

describe("envio de mídia", () => {
  it("imagem por URL", async () => {
    await evolutionAdapter.enviarMidia(ctx, { telefone: "5511", tipo: "imagem", url: "https://x/i.jpg", legenda: "leg" });
    expect(req()).toMatchObject({
      url: "https://evo.exemplo.com/message/sendMedia/inst-1",
      corpo: { number: "5511", mediatype: "image", media: "https://x/i.jpg", caption: "leg" },
    });
  });

  it("documento: mediatype document, nome e mimetype pela extensão", async () => {
    await evolutionAdapter.enviarMidia(ctx, { telefone: "5511", tipo: "documento", url: "https://x/r.pdf", nomeArquivo: "Relatório.PDF" });
    expect(req().corpo).toMatchObject({ mediatype: "document", fileName: "Relatório.PDF", mimetype: "application/pdf" });
  });

  it("data URL base64: separa o mimetype e envia só o conteúdo", async () => {
    await evolutionAdapter.enviarMidia(ctx, { telefone: "5511", tipo: "documento", url: "data:application/pdf;base64,QUJDRA==", nomeArquivo: "a.pdf" });
    expect(req().corpo).toMatchObject({ media: "QUJDRA==", mimetype: "application/pdf" });
  });

  it("áudio usa sendWhatsAppAudio", async () => {
    await evolutionAdapter.enviarMidia(ctx, { telefone: "5511", tipo: "audio", url: "https://x/a.ogg" });
    expect(req()).toMatchObject({ url: "https://evo.exemplo.com/message/sendWhatsAppAudio/inst-1", corpo: { number: "5511", audio: "https://x/a.ogg" } });
  });
});

describe("demais operações", () => {
  it("presença: composing com atraso limitado; falha é silenciosa", async () => {
    await evolutionAdapter.enviarPresenca(ctx, "5511", 99_999);
    expect(req()).toMatchObject({ url: "https://evo.exemplo.com/chat/sendPresence/inst-1", corpo: { number: "5511", presence: "composing", delay: 15000 } });
    fetchMock.mockRejectedValueOnce(new Error("boom"));
    expect(await evolutionAdapter.enviarPresenca(ctx, "5511", 1000)).toEqual({ ok: true, dados: null });
  });

  it("apagar para todos: DELETE com id ORIGINAL (sem prefixo)", async () => {
    const r = await evolutionAdapter.apagarMensagem(ctx, { telefone: "5511999990000", mensagemId: `evo:${CONEXAO}:3EB0XYZ` });
    expect(r).toEqual({ ok: true, dados: null });
    expect(req()).toMatchObject({
      metodo: "DELETE",
      url: "https://evo.exemplo.com/chat/deleteMessageForEveryone/inst-1",
      corpo: { id: "3EB0XYZ", remoteJid: "5511999990000@s.whatsapp.net", fromMe: true },
    });
  });

  it("editar mensagem: POST chat/updateMessage com a chave da mensagem original", async () => {
    await evolutionAdapter.editarMensagem(ctx, { telefone: "5511999990000", mensagemId: `evo:${CONEXAO}:3EB0XYZ`, texto: "corrigido" });
    expect(req()).toMatchObject({
      url: "https://evo.exemplo.com/chat/updateMessage/inst-1",
      corpo: { number: "5511999990000", text: "corrigido", key: { id: "3EB0XYZ", fromMe: true } },
    });
  });

  it("status: open / connecting / close", async () => {
    fetchMock.mockResolvedValueOnce(json({ instance: { instanceName: "inst-1", state: "open" } }));
    expect(await evolutionAdapter.consultarStatus(ctx)).toEqual({ ok: true, dados: { conectado: true, detalhe: "Número conectado." } });
    expect(req().url).toBe("https://evo.exemplo.com/instance/connectionState/inst-1");
    fetchMock.mockResolvedValueOnce(json({ instance: { state: "connecting" } }));
    expect(await evolutionAdapter.consultarStatus(ctx)).toMatchObject({ ok: true, dados: { conectado: false, detalhe: expect.stringContaining("Conectando") } });
    fetchMock.mockResolvedValueOnce(json({ instance: { state: "close" } }));
    expect(await evolutionAdapter.consultarStatus(ctx)).toMatchObject({ ok: true, dados: { conectado: false } });
  });

  it("QR Code: remove o prefixo data:, devolve o código de pareamento e o estado", async () => {
    fetchMock.mockResolvedValueOnce(json({ pairingCode: "ABCD1234", code: "2@xyz", base64: "data:image/png;base64,iVBORw0KGgo=", count: 1 }));
    expect(await evolutionAdapter.obterQrCode(ctx)).toEqual({
      ok: true,
      dados: { qrCodeBase64: "iVBORw0KGgo=", codigoPareamento: "ABCD1234", estado: "connecting" },
    });
    expect(req()).toMatchObject({ metodo: "GET", url: "https://evo.exemplo.com/instance/connect/inst-1" });
  });

  it("QR Code com instância já conectada: sem QR e estado open", async () => {
    fetchMock.mockResolvedValueOnce(json({ instance: { instanceName: "inst-1", state: "open" } }));
    expect(await evolutionAdapter.obterQrCode(ctx)).toEqual({ ok: true, dados: { qrCodeBase64: null, codigoPareamento: null, estado: "open" } });
  });

  it("desconectar: DELETE instance/logout", async () => {
    await evolutionAdapter.desconectar(ctx);
    expect(req()).toMatchObject({ metodo: "DELETE", url: "https://evo.exemplo.com/instance/logout/inst-1" });
  });

  it("publicar status não é suportado (sem chamar a rede)", async () => {
    expect(await evolutionAdapter.publicarStatus(ctx, { tipo: "texto", texto: "x" })).toMatchObject({ ok: false, erro: { codigo: "nao_suportado" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("criar instância", () => {
  const novo = { conexaoId: null, servidorId: SERVIDOR };

  it("cria com Baileys e QR, devolve só o nome e NÃO expõe a chave da instância", async () => {
    fetchMock.mockResolvedValueOnce(json({ instance: { instanceName: "loja-1", status: "created" }, hash: "CHAVE-DA-INSTANCIA", qrcode: { base64: "x" } }, 201));
    const r = await evolutionAdapter.criarInstancia(novo, "loja-1");
    expect(r).toEqual({ ok: true, dados: { idExterno: "loja-1" } });
    expect(JSON.stringify(r)).not.toContain("CHAVE-DA-INSTANCIA");
    expect(req()).toMatchObject({
      metodo: "POST",
      url: "https://evo.exemplo.com/instance/create",
      corpo: { instanceName: "loja-1", qrcode: true, integration: "WHATSAPP-BAILEYS" },
    });
  });

  it.each(["", "ab", "com espaço", "../etc", "x".repeat(41), "-comeca-com-hifen"])("rejeita o nome %j sem chamar a rede", async (nome) => {
    expect(await evolutionAdapter.criarInstancia(novo, nome)).toMatchObject({ ok: false, erro: { codigo: "invalido" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("nome já em uso: erro explícito e não retentável", async () => {
    fetchMock.mockResolvedValueOnce(json({ status: 403, error: "Forbidden", response: { message: ['This name "loja-1" is already in use.'] } }, 403));
    const r = await evolutionAdapter.criarInstancia(novo, "loja-1");
    expect(r).toMatchObject({ ok: false, erro: { retentavel: false, mensagem: expect.stringContaining("already in use") } });
  });

  it("exige servidor informado", async () => {
    expect(await evolutionAdapter.criarInstancia({ conexaoId: null }, "loja-1")).toMatchObject({ ok: false, erro: { codigo: "nao_configurado" } });
  });
});

describe("webhook por instância", () => {
  const entrada = { url: "https://site.exemplo/api/public/whatsapp/webhook/tok-conexao", segredo: "SEGREDO123" };

  it("grava no formato aninhado, com cabeçalho secreto e eventos; confere pela leitura", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ webhook: {} }, 201))
      .mockResolvedValueOnce(json({ enabled: true, url: entrada.url }));
    const r = await evolutionAdapter.configurarWebhook(ctx, entrada);
    expect(r).toMatchObject({ ok: true, dados: { falhas: [] } });

    expect(req(0)).toMatchObject({ metodo: "POST", url: "https://evo.exemplo.com/webhook/set/inst-1" });
    expect(req(0).corpo.webhook).toMatchObject({ enabled: true, url: entrada.url, byEvents: false, base64: false });
    expect(req(0).corpo.webhook.headers[CABECALHO_SEGREDO_WEBHOOK]).toBe("SEGREDO123");
    expect(req(0).corpo.webhook.events).toEqual(expect.arrayContaining(["MESSAGES_UPSERT", "CONNECTION_UPDATE", "MESSAGES_DELETE"]));
    expect(req(1)).toMatchObject({ metodo: "GET", url: "https://evo.exemplo.com/webhook/find/inst-1" });
  });

  it("se o servidor recusa o formato aninhado (400), tenta o formato plano", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ status: 400, response: { message: ["instance requires property \"url\""] } }, 400))
      .mockResolvedValueOnce(json({}, 201))
      .mockResolvedValueOnce(json({ enabled: true, url: entrada.url }));
    const r = await evolutionAdapter.configurarWebhook(ctx, entrada);
    expect(r).toMatchObject({ ok: true });
    expect(req(1).corpo).toMatchObject({ enabled: true, url: entrada.url, webhookByEvents: false, webhookBase64: false });
    expect(req(1).corpo.webhook).toBeUndefined();
  });

  it("conferência que não encontra o endereço gravado é erro (não finge sucesso)", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 201)).mockResolvedValueOnce(json({ enabled: true, url: "https://outro" }));
    expect(await evolutionAdapter.configurarWebhook(ctx, entrada)).toMatchObject({ ok: false, erro: { retentavel: true } });
  });

  it("recusa do servidor (não 400) é erro padronizado", async () => {
    fetchMock.mockResolvedValueOnce(json({ response: { message: ["Unauthorized"] } }, 401));
    expect(await evolutionAdapter.configurarWebhook(ctx, entrada)).toMatchObject({ ok: false, erro: { codigo: "nao_autenticado" } });
  });
});

describe("baixar mídia", () => {
  it("POST getBase64FromMediaMessage com o id original e devolve os bytes", async () => {
    fetchMock.mockResolvedValueOnce(json({ mediaType: "documentMessage", fileName: "a.pdf", mimetype: "application/pdf", base64: "QUJD" }));
    const r = await evolutionAdapter.baixarMidia(ctx, { idMensagem: `evo:${CONEXAO}:3EB0XYZ` });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Buffer.from(r.dados.bytes).toString()).toBe("ABC");
      expect(r.dados).toMatchObject({ mime: "application/pdf", nome: "a.pdf" });
    }
    expect(req()).toMatchObject({
      url: "https://evo.exemplo.com/chat/getBase64FromMediaMessage/inst-1",
      corpo: { message: { key: { id: "3EB0XYZ" } }, convertToMp4: false },
    });
  });

  it("sem conteúdo na resposta é erro explícito", async () => {
    fetchMock.mockResolvedValueOnce(json({ mediaType: "x" }));
    expect(await evolutionAdapter.baixarMidia(ctx, { idMensagem: "X" })).toMatchObject({ ok: false, erro: { codigo: "nao_encontrado" } });
  });
});

describe("erros padronizados e segurança", () => {
  it("mensagem do servidor é preservada e classificada (instância inexistente → 404)", async () => {
    fetchMock.mockResolvedValueOnce(json({ status: 404, error: "Not Found", response: { message: ['The "inst-1" instance does not exist'] } }, 404));
    expect(await evolutionAdapter.enviarTexto(ctx, { telefone: "5511", texto: "a" })).toEqual({
      ok: false,
      erro: { codigo: "nao_encontrado", mensagem: 'The "inst-1" instance does not exist', httpStatus: 404, retentavel: false },
    });
  });

  it("401 → nao_autenticado; 500 e falha de rede → retentáveis", async () => {
    fetchMock.mockResolvedValueOnce(json({ response: { message: ["Unauthorized"] } }, 401));
    expect(await evolutionAdapter.enviarTexto(ctx, { telefone: "5511", texto: "a" })).toMatchObject({ erro: { codigo: "nao_autenticado", retentavel: false } });
    fetchMock.mockResolvedValueOnce(json({}, 502));
    expect(await evolutionAdapter.enviarTexto(ctx, { telefone: "5511", texto: "a" })).toMatchObject({ erro: { codigo: "servidor", retentavel: true } });
    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET"));
    expect(await evolutionAdapter.enviarTexto(ctx, { telefone: "5511", texto: "a" })).toMatchObject({ erro: { codigo: "rede", retentavel: true } });
  });

  it("tempo esgotado → timeout retentável", async () => {
    const e = new Error("The operation was aborted due to timeout");
    e.name = "TimeoutError";
    fetchMock.mockRejectedValueOnce(e);
    expect(await evolutionAdapter.enviarTexto(ctx, { telefone: "5511", texto: "a" })).toMatchObject({ erro: { codigo: "timeout", retentavel: true } });
  });

  it("sem a chave no ambiente: nao_configurado, sem chamar a rede", async () => {
    delete process.env["EVOLUTION_API_KEY"];
    expect(await evolutionAdapter.enviarTexto(ctx, { telefone: "5511", texto: "a" })).toMatchObject({ ok: false, erro: { retentavel: false, mensagem: expect.stringContaining("não configurada") } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a chave nunca aparece em erros, na URL nem nos resultados", async () => {
    fetchMock.mockResolvedValueOnce(json({ response: { message: ["falhou"] } }, 500));
    const r = await evolutionAdapter.enviarTexto(ctx, { telefone: "5511", texto: "a" });
    expect(JSON.stringify(r)).not.toContain(CHAVE);
    expect(req().url).not.toContain(CHAVE);
  });

  it("segredo_ref fora do padrão EVOLUTION_API_KEY* nunca lê o ambiente", async () => {
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "ultra-secreta";
    ref.banco.tabela("whatsapp_servidores")[0]!["segredo_ref"] = "SUPABASE_SERVICE_ROLE_KEY";
    const r = await evolutionAdapter.enviarTexto(ctx, { telefone: "5511", texto: "a" });
    expect(r).toMatchObject({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.stringify(r)).not.toContain("ultra-secreta");
  });

  it("SSRF: servidor que resolve para rede interna é bloqueado sem chamar a rede", async () => {
    dns.ips = ["10.0.0.5"];
    const r = await evolutionAdapter.enviarTexto(ctx, { telefone: "5511", texto: "a" });
    expect(r).toMatchObject({ ok: false, erro: { retentavel: false, mensagem: expect.stringContaining("rede interna") } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("SSRF: redirecionamento do servidor não é seguido", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } }));
    const r = await evolutionAdapter.enviarTexto(ctx, { telefone: "5511", texto: "a" });
    expect(r).toMatchObject({ ok: false, erro: { retentavel: false, mensagem: expect.stringContaining("redirecionamento") } });
  });

  it("servidor desativado ou de outro provedor não é usado", async () => {
    ref.banco.tabela("whatsapp_servidores")[0]!["ativo"] = false;
    expect(await evolutionAdapter.enviarTexto(ctx, { telefone: "5511", texto: "a" })).toMatchObject({ ok: false, erro: { mensagem: expect.stringContaining("desativado") } });
    limparCacheEvolution();
    ref.banco.tabela("whatsapp_servidores")[0]!["ativo"] = true;
    ref.banco.tabela("whatsapp_conexoes")[0]!["provedor"] = "zapi";
    expect(await evolutionAdapter.enviarTexto(ctx, { telefone: "5511", texto: "a" })).toMatchObject({ ok: false, erro: { codigo: "nao_configurado" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("conexão inexistente", async () => {
    expect(await evolutionAdapter.enviarTexto({ conexaoId: "33333333-3333-4333-8333-333333333333" }, { telefone: "5511", texto: "a" })).toMatchObject({
      ok: false,
      erro: { codigo: "nao_encontrado" },
    });
  });

  it("o resolvedor de provedor devolve o adaptador Evolution para conexões Evolution", async () => {
    const p = await obterProvedorDaConexao(CONEXAO);
    expect(p).toMatchObject({ ok: true, dados: { id: "evolution" } });
  });
});

describe("autenticação do webhook por cabeçalho secreto", () => {
  const webhookCtx = { conexaoId: CONEXAO, webhookToken: "tok-conexao" };
  const comSegredo = (v: string | null) => new Headers(v ? { [CABECALHO_SEGREDO_WEBHOOK]: v } : {});

  it("aceita somente o segredo derivado do token da conexão", () => {
    const certo = derivarSegredoWebhook("tok-conexao")!;
    expect(evolutionAdapter.autenticarWebhook!(comSegredo(certo), webhookCtx)).toBe(true);
    expect(evolutionAdapter.autenticarWebhook!(comSegredo("errado"), webhookCtx)).toBe(false);
    expect(evolutionAdapter.autenticarWebhook!(comSegredo(null), webhookCtx)).toBe(false);
  });

  it("o segredo de uma conexão não vale para outra", () => {
    const deOutra = derivarSegredoWebhook("tok-outra-conexao")!;
    expect(evolutionAdapter.autenticarWebhook!(comSegredo(deOutra), webhookCtx)).toBe(false);
    expect(derivarSegredoWebhook("a")).not.toBe(derivarSegredoWebhook("b"));
    expect(derivarSegredoWebhook("a")).toBe(derivarSegredoWebhook("a"));
  });

  it("sem WHATSAPP_WEBHOOK_SEGREDO no ambiente, tudo é recusado (falha fechada)", () => {
    const certo = derivarSegredoWebhook("tok-conexao")!;
    delete process.env["WHATSAPP_WEBHOOK_SEGREDO"];
    expect(derivarSegredoWebhook("tok-conexao")).toBeNull();
    expect(evolutionAdapter.autenticarWebhook!(comSegredo(certo), webhookCtx)).toBe(false);
    process.env["WHATSAPP_WEBHOOK_SEGREDO"] = "curto";
    expect(derivarSegredoWebhook("tok-conexao")).toBeNull();
  });

  it("sem token da conexão não autentica", () => {
    expect(evolutionAdapter.autenticarWebhook!(comSegredo("x"), { conexaoId: CONEXAO })).toBe(false);
  });
});

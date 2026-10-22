import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Testes de CARACTERIZAÇÃO do cliente Z-API atual (zapi.server.ts).
 * Fixam o comportamento existente (URL, headers, corpo, fallback de
 * credenciais, tratamento de erro) para que a camada multiprovedor não
 * altere nada do que já funciona em produção.
 */

const estado = vi.hoisted(() => ({
  conexao: null as Record<string, unknown> | null,
  conversa: null as Record<string, unknown> | null,
  consultas: [] as Array<{ tabela: string; filtros: Array<[string, unknown]> }>,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (tabela: string) => {
      const reg = { tabela, filtros: [] as Array<[string, unknown]> };
      estado.consultas.push(reg);
      const b: Record<string, unknown> = {};
      b["select"] = () => b;
      b["eq"] = (campo: string, valor: unknown) => {
        reg.filtros.push([campo, valor]);
        return b;
      };
      b["maybeSingle"] = async () => ({
        data: tabela === "whatsapp_conexoes" ? estado.conexao : estado.conversa,
      });
      return b;
    },
  },
}));

import { chamarZapi, conexaoPorTelefone, credenciaisDaConexao, enviarPresencaDigitando } from "./zapi.server";

const ENV_ORIGINAL = { ...process.env };
let fetchMock: ReturnType<typeof vi.fn>;

function resposta(corpo: unknown, status = 200) {
  const texto = typeof corpo === "string" ? corpo : JSON.stringify(corpo);
  return new Response(texto, { status });
}

beforeEach(() => {
  process.env["ZAPI_INSTANCE_ID"] = "ENV_ID";
  process.env["ZAPI_INSTANCE_TOKEN"] = "ENV_TOKEN";
  process.env["ZAPI_CLIENT_TOKEN"] = "ENV_CLIENT";
  delete process.env["ZAPI_BASE_URL"];
  estado.conexao = null;
  estado.conversa = null;
  estado.consultas = [];
  fetchMock = vi.fn(async () => resposta({ messageId: "MSG1" }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  process.env = { ...ENV_ORIGINAL };
  vi.unstubAllGlobals();
});

describe("chamarZapi — requisição", () => {
  it("monta a URL com instance/token das variáveis de ambiente e envia Client-Token", async () => {
    await chamarZapi("send-text", { metodo: "POST", corpo: { phone: "5511999990000", message: "oi" } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.z-api.io/instances/ENV_ID/token/ENV_TOKEN/send-text");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json", "Client-Token": "ENV_CLIENT" });
    expect(JSON.parse(String(init.body))).toEqual({ phone: "5511999990000", message: "oi" });
  });

  it("usa GET por padrão e não envia corpo quando não informado", async () => {
    await chamarZapi("status");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("GET");
    expect("body" in init).toBe(false);
  });

  it("aceita PUT e DELETE", async () => {
    await chamarZapi("update-webhook-received", { metodo: "PUT", corpo: { value: "https://x" } });
    await chamarZapi("messages?messageId=A&phone=B&owner=true", { metodo: "DELETE" });
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].method).toBe("PUT");
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
    expect(url.endsWith("/messages?messageId=A&phone=B&owner=true")).toBe(true);
  });

  it("remove barras duplicadas do ZAPI_BASE_URL e a barra inicial do caminho", async () => {
    process.env["ZAPI_BASE_URL"] = "https://z.example.com///";
    await chamarZapi("/send-text");
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      "https://z.example.com/instances/ENV_ID/token/ENV_TOKEN/send-text",
    );
  });
});

describe("credenciais", () => {
  it("sem credenciais em lugar nenhum: não chama a rede e devolve erro padronizado", async () => {
    delete process.env["ZAPI_INSTANCE_ID"];
    const r = await chamarZapi("send-text", { metodo: "POST", corpo: {} });
    expect(r).toEqual({ ok: false, status: 0, dados: null, erro: "Credenciais da Z-API não configuradas." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("conexão com credenciais próprias usa as da conexão (e não as do ambiente)", async () => {
    estado.conexao = {
      base_url: "https://api.z-api.io/",
      instance_id: "CONN_ID",
      instance_token: "CONN_TOKEN",
      client_token: "CONN_CLIENT",
    };
    await chamarZapi("send-text", { metodo: "POST", corpo: {}, conexaoId: "c1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.z-api.io/instances/CONN_ID/token/CONN_TOKEN/send-text");
    expect((init.headers as Record<string, string>)["Client-Token"]).toBe("CONN_CLIENT");
    expect(estado.consultas[0]?.tabela).toBe("whatsapp_conexoes");
    expect(estado.consultas[0]?.filtros).toContainEqual(["id", "c1"]);
  });

  it("duas conexões usam credenciais diferentes (isolamento)", async () => {
    estado.conexao = { base_url: "", instance_id: "A", instance_token: "TA", client_token: "CA" };
    await chamarZapi("send-text", { conexaoId: "a" });
    estado.conexao = { base_url: "", instance_id: "B", instance_token: "TB", client_token: "CB" };
    await chamarZapi("send-text", { conexaoId: "b" });
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain("/instances/A/token/TA/");
    expect((fetchMock.mock.calls[1] as [string])[0]).toContain("/instances/B/token/TB/");
  });

  it("conexão com credenciais incompletas cai no ambiente (conexão principal)", async () => {
    estado.conexao = { base_url: "", instance_id: "", instance_token: "", client_token: "" };
    const c = await credenciaisDaConexao("c1");
    expect(c).toEqual({
      baseUrl: "https://api.z-api.io",
      instanceId: "ENV_ID",
      instanceToken: "ENV_TOKEN",
      clientToken: "ENV_CLIENT",
    });
  });

  it("conexão inexistente cai no ambiente; sem conexaoId nem consulta o banco", async () => {
    estado.conexao = null;
    expect((await credenciaisDaConexao("nao-existe"))?.instanceId).toBe("ENV_ID");
    estado.consultas = [];
    expect((await credenciaisDaConexao(null))?.instanceId).toBe("ENV_ID");
    expect(estado.consultas).toHaveLength(0);
  });

  it("conexão de OUTRO provedor sem credenciais próprias NÃO usa o ambiente (evita enviar pelo número errado)", async () => {
    estado.conexao = {
      provedor: "evolution",
      base_url: "",
      instance_id: "",
      instance_token: "",
      client_token: "",
    };
    expect(await credenciaisDaConexao("c-evo")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("conexão Z-API sem credenciais próprias mantém o fallback do ambiente", async () => {
    estado.conexao = {
      provedor: "zapi",
      base_url: "",
      instance_id: "",
      instance_token: "",
      client_token: "",
    };
    expect((await credenciaisDaConexao("c-zapi"))?.instanceId).toBe("ENV_ID");
  });
});

describe("chamarZapi — resposta", () => {
  it("sucesso: devolve ok, status e dados JSON", async () => {
    fetchMock.mockResolvedValueOnce(resposta({ messageId: "X", zaapId: "Z" }));
    const r = await chamarZapi("send-text", { metodo: "POST", corpo: {} });
    expect(r).toEqual({ ok: true, status: 200, dados: { messageId: "X", zaapId: "Z" } });
  });

  it("corpo vazio vira dados null; corpo não-JSON é preservado como texto", async () => {
    fetchMock.mockResolvedValueOnce(resposta("", 200));
    expect((await chamarZapi("x")).dados).toBeNull();
    fetchMock.mockResolvedValueOnce(resposta("texto puro", 200));
    expect((await chamarZapi("x")).dados).toBe("texto puro");
  });

  it("HTTP de erro: usa o campo `error` do corpo, senão `HTTP <status>`", async () => {
    fetchMock.mockResolvedValueOnce(resposta({ error: "Client-Token inválido" }, 401));
    expect(await chamarZapi("x")).toMatchObject({ ok: false, status: 401, erro: "Client-Token inválido" });
    fetchMock.mockResolvedValueOnce(resposta("falhou", 500));
    expect(await chamarZapi("x")).toMatchObject({ ok: false, status: 500, erro: "HTTP 500" });
  });

  it("falha de rede: status 0 com a mensagem do erro (nunca lança)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET"));
    expect(await chamarZapi("x")).toEqual({ ok: false, status: 0, dados: null, erro: "ECONNRESET" });
    fetchMock.mockRejectedValueOnce("estranho");
    expect((await chamarZapi("x")).erro).toBe("Falha de conexão");
  });
});

describe("enviarPresencaDigitando", () => {
  it("envia presença `composing` e limita o atraso entre 500 e 15000 ms", async () => {
    await enviarPresencaDigitando("5511999990000", 100);
    await enviarPresencaDigitando("5511999990000", 99_999);
    await enviarPresencaDigitando("5511999990000", 4000);
    const delays = fetchMock.mock.calls.map((c) => JSON.parse(String((c as [string, RequestInit])[1].body)).delay);
    expect(delays).toEqual([500, 15000, 4000]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url.endsWith("/send-presence")).toBe(true);
    expect(JSON.parse(String(init.body))).toMatchObject({ phone: "5511999990000", presence: "composing" });
  });

  it("falha silenciosa: nunca interrompe quem chamou", async () => {
    fetchMock.mockRejectedValueOnce(new Error("boom"));
    await expect(enviarPresencaDigitando("5511", 1000)).resolves.toBeUndefined();
  });
});

describe("conexaoPorTelefone", () => {
  it("normaliza para dígitos e devolve a conexão da conversa", async () => {
    estado.conversa = { conexao_id: "conn-9" };
    expect(await conexaoPorTelefone("+55 (11) 99999-0000")).toBe("conn-9");
    expect(estado.consultas[0]?.filtros).toContainEqual(["telefone", "5511999990000"]);
  });

  it("telefone sem dígitos: null sem consultar o banco", async () => {
    expect(await conexaoPorTelefone("abc")).toBeNull();
    expect(estado.consultas).toHaveLength(0);
  });
});

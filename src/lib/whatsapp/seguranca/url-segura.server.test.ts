import { afterEach, describe, expect, it, vi } from "vitest";
import { ErroUrlInsegura, fetchSeguro, hostsPermitidosDoAmbiente, ipNaoPublico, validarUrlDoServidor } from "./url-segura.server";

const publico = async () => ["203.0.114.10"].map((x) => x.replace("203.0.114", "8.8.8")); // 8.8.8.10 (público)

describe("ipNaoPublico", () => {
  it.each([
    "127.0.0.1", "127.1.2.3", "10.0.0.1", "10.255.255.255", "172.16.0.1", "172.31.255.255", "192.168.1.1",
    "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "198.18.0.1", "192.0.2.1",
    "::", "::1", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "2001:db8::1",
    "::ffff:127.0.0.1", "::ffff:10.0.0.5", "::ffff:169.254.169.254", "64:ff9b::7f00:1",
  ])("bloqueia %s", (ip) => {
    expect(ipNaoPublico(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "172.15.255.255", "172.32.0.1", "100.63.255.255", "198.20.0.1", "2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8"])(
    "permite %s",
    (ip) => {
      expect(ipNaoPublico(ip)).toBe(false);
    },
  );

  it("não parseável é tratado como inseguro", () => {
    expect(ipNaoPublico("não-é-ip")).toBe(true);
    expect(ipNaoPublico("999.1.1.1")).toBe(true);
  });
});

describe("validarUrlDoServidor", () => {
  const opc = { hostsPermitidos: [] as string[], resolver: publico };

  it("aceita https com host que resolve para IP público", async () => {
    const r = await validarUrlDoServidor("https://evo.exemplo.com", opc);
    expect(r).toMatchObject({ ok: true, ips: ["8.8.8.10"] });
  });

  it.each([
    ["http://evo.exemplo.com", /https/i],
    ["ftp://evo.exemplo.com", /Protocolo/],
    ["file:///etc/passwd", /Protocolo|sem endereço/],
    ["https://user:senha@evo.exemplo.com", /usuário ou senha/],
    ["não é url", /inválida/],
    ["https://localhost", /interno/],
    ["https://servidor", /interno/],
    ["https://app.localhost", /interno/],
    ["https://db.internal", /interno/],
    ["https://127.0.0.1", /interna/],
    ["https://169.254.169.254/latest/meta-data", /interna/],
    ["https://[::1]", /interna/],
    ["https://10.0.0.8:8080", /interna/],
  ])("rejeita %s", async (entrada, motivo) => {
    const r = await validarUrlDoServidor(entrada, opc);
    expect(r.ok).toBe(false);
    expect((r as { motivo: string }).motivo).toMatch(motivo);
  });

  it("rejeita host cujo DNS aponta para rede interna (qualquer um dos endereços)", async () => {
    const r = await validarUrlDoServidor("https://evil.exemplo.com", { ...opc, resolver: async () => ["8.8.8.8", "10.0.0.5"] });
    expect(r).toMatchObject({ ok: false });
  });

  it("falha de DNS é erro, não liberação", async () => {
    expect(await validarUrlDoServidor("https://x.exemplo.com", { ...opc, resolver: async () => { throw new Error("NXDOMAIN"); } })).toMatchObject({ ok: false });
    expect(await validarUrlDoServidor("https://x.exemplo.com", { ...opc, resolver: async () => [] })).toMatchObject({ ok: false });
  });

  it("host privado só passa se liberado explicitamente (inclusive http)", async () => {
    const liberado = { hostsPermitidos: ["evo.interno.empresa.com", "10.1.1.1"], resolver: async () => ["10.0.0.9"] };
    expect(await validarUrlDoServidor("https://evo.interno.empresa.com", liberado)).toMatchObject({ ok: true });
    expect(await validarUrlDoServidor("http://evo.interno.empresa.com:8080", liberado)).toMatchObject({ ok: true });
    expect(await validarUrlDoServidor("http://10.1.1.1:8080", liberado)).toMatchObject({ ok: true });
    // outro host privado continua bloqueado
    expect(await validarUrlDoServidor("https://outro.interno.empresa.com", liberado)).toMatchObject({ ok: false });
  });

  it("lê a lista de hosts liberados do ambiente", () => {
    const anterior = process.env["WHATSAPP_HOSTS_PERMITIDOS"];
    process.env["WHATSAPP_HOSTS_PERMITIDOS"] = " Evo.Local.Empresa.com , 10.0.0.5 ,, ";
    expect(hostsPermitidosDoAmbiente()).toEqual(["evo.local.empresa.com", "10.0.0.5"]);
    if (anterior === undefined) delete process.env["WHATSAPP_HOSTS_PERMITIDOS"];
    else process.env["WHATSAPP_HOSTS_PERMITIDOS"] = anterior;
  });
});

describe("fetchSeguro", () => {
  afterEach(() => vi.unstubAllGlobals());
  const opc = { hostsPermitidos: [] as string[], resolver: publico };

  it("não chama a rede quando a URL é insegura", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(fetchSeguro("https://127.0.0.1/x", {}, opc)).rejects.toBeInstanceOf(ErroUrlInsegura);
    expect(f).not.toHaveBeenCalled();
  });

  it("não segue redirecionamento (redirect: manual) e rejeita 3xx", async () => {
    const f = vi.fn(async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } }));
    vi.stubGlobal("fetch", f);
    await expect(fetchSeguro("https://evo.exemplo.com/a", {}, opc)).rejects.toThrow(/redirecionamento/);
    expect((f.mock.calls[0] as unknown as [URL, RequestInit])[1].redirect).toBe("manual");
  });

  it("aplica limite de tempo e repassa método/corpo", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", f);
    const r = await fetchSeguro("https://evo.exemplo.com/a", { method: "POST", body: "x" }, opc);
    expect(r.status).toBe(200);
    const init = (f.mock.calls[0] as unknown as [URL, RequestInit])[1];
    expect(init.method).toBe("POST");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

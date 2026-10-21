import { describe, expect, it } from "vitest";
import {
  BASE_WEBHOOK_PADRAO,
  instanciaConfere,
  montarUrlWebhook,
  resolverBaseWebhook,
  urlWebhookCorresponde,
  validarBaseWebhook,
} from "./webhook-url";

describe("validarBaseWebhook", () => {
  it("aceita origem HTTPS limpa", () => {
    expect(validarBaseWebhook("https://exemplo.com")).toBe("https://exemplo.com");
    // Porta padrão 443 é normalizada fora.
    expect(validarBaseWebhook("https://abc.trycloudflare.com:443/")).toBe("https://abc.trycloudflare.com");
    expect(validarBaseWebhook("https://exemplo.com:8443")).toBe("https://exemplo.com:8443");
  });

  it("remove a barra final", () => {
    expect(validarBaseWebhook("https://exemplo.com/")).toBe("https://exemplo.com");
    expect(validarBaseWebhook("https://exemplo.com///")).toBe("https://exemplo.com");
  });

  it("rejeita HTTP (o webhook precisa de HTTPS)", () => {
    expect(validarBaseWebhook("http://abc.trycloudflare.com")).toBeNull();
  });

  it("rejeita localhost/127.0.0.1 (a Evolution não alcança a sua máquina)", () => {
    expect(validarBaseWebhook("http://localhost:3000")).toBeNull();
    expect(validarBaseWebhook("https://localhost")).toBeNull();
  });

  it("rejeita base com caminho, query ou hash", () => {
    expect(validarBaseWebhook("https://exemplo.com/api")).toBeNull();
    expect(validarBaseWebhook("https://exemplo.com/api/public/whatsapp/webhook/abc")).toBeNull();
    expect(validarBaseWebhook("https://exemplo.com?q=1")).toBeNull();
    expect(validarBaseWebhook("https://exemplo.com/#topo")).toBeNull();
  });

  it("rejeita URL malformada ou vazia", () => {
    expect(validarBaseWebhook("")).toBeNull();
    expect(validarBaseWebhook("nada")).toBeNull();
    expect(validarBaseWebhook("exemplo.com")).toBeNull();
  });

  it("rejeita credenciais embutidas", () => {
    expect(validarBaseWebhook("https://user:senha@exemplo.com")).toBeNull();
  });
});

describe("resolverBaseWebhook", () => {
  it("prioriza WHATSAPP_WEBHOOK_BASE_URL", () => {
    const r = resolverBaseWebhook({
      variavelAmbiente: " https://tunel.test/ ",
      appUrl: "https://antigo.app/",
      siteUrl: "http://localhost:3000",
    });
    expect(r).toEqual({ base: "https://tunel.test", erro: null });
  });

  it("não cai no SITE_URL quando a variável existe mas é inválida", () => {
    const r = resolverBaseWebhook({ variavelAmbiente: "http://localhost:3000", siteUrl: "https://site.app" });
    expect(r.base).toBeNull();
    expect(r.erro).toMatch(/WHATSAPP_WEBHOOK_BASE_URL/);
  });

  it("sem a variável, mantém a ordem antiga (app_url → SITE_URL → fallback)", () => {
    expect(resolverBaseWebhook({ appUrl: "https://banco.app/", siteUrl: "http://localhost:3000" }).base).toBe("https://banco.app");
    expect(resolverBaseWebhook({ appUrl: null, siteUrl: "http://localhost:3000" }).base).toBe("http://localhost:3000");
    expect(resolverBaseWebhook({ appUrl: null, siteUrl: null }).base).toBe(BASE_WEBHOOK_PADRAO);
  });

  it("origem legada é passada adiante, como antes (sem validar)", () => {
    expect(resolverBaseWebhook({ appUrl: "sem-protocolo", siteUrl: null }).base).toBe("sem-protocolo");
  });
});

describe("montarUrlWebhook / urlWebhookCorresponde", () => {
  const token = "5cfbce64a1ce4ead9a0c07112d3c9c33";

  it("monta o caminho do webhook", () => {
    expect(montarUrlWebhook("https://tunel.test", token)).toBe(`https://tunel.test/api/public/whatsapp/webhook/${token}`);
    expect(montarUrlWebhook("https://tunel.test/", token)).toBe(`https://tunel.test/api/public/whatsapp/webhook/${token}`);
  });

  it("confere URL com o caminho e token corretos", () => {
    expect(urlWebhookCorresponde(montarUrlWebhook("https://tunel.test", token), token)).toBe(true);
  });

  it("rejeita caminho, token, protocolo ou query divergentes", () => {
    expect(urlWebhookCorresponde(`https://tunel.test/api/public/whatsapp/webhook/outro`, token)).toBe(false);
    expect(urlWebhookCorresponde(`https://tunel.test/api/public/whatsapp/webhook/${token}?x=1`, token)).toBe(false);
    expect(urlWebhookCorresponde(`http://tunel.test/api/public/whatsapp/webhook/${token}`, token)).toBe(false);
    expect(urlWebhookCorresponde(`https://tunel.test/outra/rota/${token}`, token)).toBe(false);
    expect(urlWebhookCorresponde("não é url", token)).toBe(false);
  });
});

describe("instanciaConfere", () => {
  it("aceita quando a conexão não tem instância esperada", () => {
    expect(instanciaConfere({ instance: { instanceName: "qualquer" } }, null)).toBe(true);
    expect(instanciaConfere({ instance: { instanceName: "qualquer" } }, undefined)).toBe(true);
  });

  it("aceita quando o corpo não traz a instância (autenticação pelo segredo já vale)", () => {
    expect(instanciaConfere({}, "idigital-teste")).toBe(true);
    expect(instanciaConfere({ event: "messages.upsert", data: {} }, "idigital-teste")).toBe(true);
  });

  it("aceita a instância correta no formato texto (Evolution v2)", () => {
    expect(instanciaConfere({ instance: "idigital-teste" }, "idigital-teste")).toBe(true);
  });

  it("aceita a instância correta no formato aninhado", () => {
    expect(instanciaConfere({ instance: { instanceName: "idigital-teste" } }, "idigital-teste")).toBe(true);
  });

  it("recusa a instância divergente nos dois formatos", () => {
    expect(instanciaConfere({ instance: "outra-instancia" }, "idigital-teste")).toBe(false);
    expect(instanciaConfere({ instance: { instanceName: "outra-instancia" } }, "idigital-teste")).toBe(false);
  });
});

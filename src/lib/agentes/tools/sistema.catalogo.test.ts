import { describe, expect, it } from "vitest";
import {
  FERRAMENTAS_SISTEMA,
  getFerramentaByChave,
  getFerramentasByCategoria,
  getTodasFerramentas,
} from "./sistema";

describe("catálogo de ferramentas (FERRAMENTAS_SISTEMA)", () => {
  it("contém as 10 ferramentas da Central (6 sistema + 4 WhatsApp)", () => {
    expect(FERRAMENTAS_SISTEMA).toHaveLength(10);
    expect(getTodasFerramentas()).toBe(FERRAMENTAS_SISTEMA);
  });

  it("tem chaves únicas e com namespace (ponto)", () => {
    const chaves = FERRAMENTAS_SISTEMA.map((f) => f.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
    for (const chave of chaves) {
      expect(chave).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });

  it("todas declaram metadados válidos", () => {
    for (const f of FERRAMENTAS_SISTEMA) {
      expect(["consulta", "acao"]).toContain(f.tipo);
      expect(["baixo", "medio", "alto"]).toContain(f.risco);
      expect(typeof f.sensivel).toBe("boolean");
      expect(typeof f.efeito_externo).toBe("boolean");
      expect(typeof f.idempotente).toBe("boolean");
      expect(f.parametrosSchema).toBeDefined();
      expect(typeof f.executar).toBe("function");
    }
  });

  it("getFerramentaByChave encontra por chave e retorna undefined para desconhecida", () => {
    const encontrada = getFerramentaByChave("whatsapp.encaminhar_humano");
    expect(encontrada?.chave).toBe("whatsapp.encaminhar_humano");
    expect(getFerramentaByChave("inexistente.x")).toBeUndefined();
  });

  it("getFerramentasByCategoria isola as ferramentas do WhatsApp", () => {
    const whatsapp = getFerramentasByCategoria("whatsapp");
    expect(whatsapp).toHaveLength(4);
    expect(whatsapp.every((f) => f.categoria === "whatsapp")).toBe(true);
    expect(getFerramentasByCategoria("clientes")).toHaveLength(2);
  });
});

describe("política de encaminhamento humano", () => {
  it("whatsapp.encaminhar_humano é sensível e auditada, mas não exige aprovação prévia", () => {
    const f = getFerramentaByChave("whatsapp.encaminhar_humano");
    expect(f).toBeDefined();
    expect(f?.tipo).toBe("acao");
    expect(f?.sensivel).toBe(true);
    expect(f?.efeito_externo).toBe(true);
    expect(f?.requerAprovacao).toBe(false);
  });

  it("as demais ferramentas não definem requerAprovacao (política padrão)", () => {
    for (const f of FERRAMENTAS_SISTEMA) {
      if (f.chave !== "whatsapp.encaminhar_humano") {
        expect(f.requerAprovacao).toBeUndefined();
      }
    }
  });

  it("nenhuma ferramenta de sistema é sensível ou tem efeito externo", () => {
    for (const f of FERRAMENTAS_SISTEMA.filter((x) => x.categoria !== "whatsapp")) {
      expect(f.tipo).toBe("consulta");
      expect(f.sensivel).toBe(false);
      expect(f.efeito_externo).toBe(false);
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  normalizarEstado,
  normalizarProvedor,
  rotuloEstado,
  rotuloProvedor,
  rotuloStatusEvento,
  segredoRefValido,
  srcQrCode,
  usaQrCode,
} from "./rotulos";

describe("rótulos de conexões WhatsApp", () => {
  it("trata provedor ausente ou desconhecido como Z-API", () => {
    expect(normalizarProvedor(null)).toBe("zapi");
    expect(normalizarProvedor(undefined)).toBe("zapi");
    expect(normalizarProvedor("outro")).toBe("zapi");
    expect(normalizarProvedor("evolution")).toBe("evolution");
    expect(rotuloProvedor("evolution")).toBe("Evolution API");
    expect(rotuloProvedor(undefined)).toBe("Z-API");
  });

  it("só a Evolution usa QR Code", () => {
    expect(usaQrCode("evolution")).toBe(true);
    expect(usaQrCode("zapi")).toBe(false);
    expect(usaQrCode(null)).toBe(false);
  });

  it("normaliza o estado da conexão", () => {
    expect(normalizarEstado("conectado")).toBe("conectado");
    expect(normalizarEstado("qualquer")).toBe("desconhecido");
    expect(normalizarEstado(null)).toBe("desconhecido");
    expect(rotuloEstado("conectando")).toBe("Aguardando QR Code");
    expect(rotuloEstado(null)).toBe("Sem verificação");
  });

  it("rotula o status dos eventos", () => {
    expect(rotuloStatusEvento("processado")).toBe("Processado");
    expect(rotuloStatusEvento("erro")).toBe("Erro");
    expect(rotuloStatusEvento("x")).toBe("x");
  });

  it("valida o nome da variável de ambiente do servidor", () => {
    expect(segredoRefValido("EVOLUTION_API_KEY")).toBe(true);
    expect(segredoRefValido(" EVOLUTION_API_KEY_2 ")).toBe(true);
    expect(segredoRefValido("evolution_api_key")).toBe(false);
    expect(segredoRefValido("SUPABASE_SERVICE_ROLE_KEY")).toBe(false);
    expect(segredoRefValido("")).toBe(false);
  });

  it("monta a origem da imagem do QR", () => {
    expect(srcQrCode(null)).toBeNull();
    expect(srcQrCode("  ")).toBeNull();
    expect(srcQrCode("AAAA")).toBe("data:image/png;base64,AAAA");
    expect(srcQrCode("data:image/png;base64,BBBB")).toBe("data:image/png;base64,BBBB");
  });
});

import { describe, expect, it } from "vitest";
import { ferramentasParaOpenAI, montarPromptSistema } from "./orchestrator";
import { getFerramentasByCategoria, getFerramentaByChave } from "./tools/sistema";

const ferramentas = getFerramentasByCategoria("whatsapp");

describe("montarPromptSistema", () => {
  it("inclui nome, chave e metadados de cada ferramenta", () => {
    const prompt = montarPromptSistema({
      nome: "Atendimento",
      descricao: "Atende clientes no WhatsApp",
      systemPrompt: null,
      ferramentas,
    });

    for (const f of ferramentas) {
      expect(prompt).toContain(f.nome);
      expect(prompt).toContain(f.chave);
    }
    expect(prompt).toContain("FERRAMENTAS DISPONÍVEIS:");
  });

  it("marca ferramentas sensíveis como SIM", () => {
    const encaminhar = getFerramentaByChave("whatsapp.encaminhar_humano");
    expect(encaminhar).toBeDefined();
    const prompt = montarPromptSistema({
      nome: "Atendimento",
      descricao: "d",
      systemPrompt: null,
      ferramentas: [encaminhar!],
    });
    expect(prompt).toContain("**Sensível:** SIM");
  });

  it("usa o systemPrompt customizado quando informado", () => {
    const prompt = montarPromptSistema({
      nome: "Atendimento",
      descricao: "d",
      systemPrompt: "PROMPT CUSTOMIZADO 123",
      ferramentas: [],
    });
    expect(prompt).toContain("PROMPT CUSTOMIZADO 123");
  });
});

describe("ferramentasParaOpenAI", () => {
  it("converte ponto da chave em underscore e gera parâmetros", () => {
    const convertidas = ferramentasParaOpenAI(ferramentas);
    expect(convertidas).toHaveLength(ferramentas.length);

    const nomes = convertidas.map((c) => c.function.name);
    expect(nomes).toContain("whatsapp_encaminhar_humano");
    expect(nomes).toContain("whatsapp_cliente_buscar");
    for (const nome of nomes) {
      expect(nome).not.toContain(".");
    }

    const encaminhar = convertidas.find((c) => c.function.name === "whatsapp_encaminhar_humano");
    expect(encaminhar?.type).toBe("function");
    expect(encaminhar?.function.parameters).toMatchObject({ type: "object" });
  });
});

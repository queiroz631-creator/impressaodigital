import { describe, expect, it } from "vitest";
import { ordenarConversas, type ConversaParaOrdem } from "../src/lib/whatsapp-ordem";

interface Conversa extends ConversaParaOrdem {
  id: string;
}

function conversa(
  id: string,
  ultima_mensagem_em: string | null,
  created_at = "2026-01-01T00:00:00Z",
): Conversa {
  return { id, ultima_mensagem_em, created_at };
}

const base = [
  conversa("antiga", "2026-01-15T10:00:00Z"),
  conversa("meia", "2026-03-01T10:00:00Z"),
  conversa("nova", "2026-05-02T10:00:00Z"),
];

describe("ordenarConversas", () => {
  it("coloca as conversas mais novas primeiro por padrão", () => {
    const ids = ordenarConversas(base, true).map((c) => c.id);
    expect(ids).toEqual(["nova", "meia", "antiga"]);
  });

  it("coloca as conversas mais antigas primeiro quando alternado", () => {
    const ids = ordenarConversas(base, false).map((c) => c.id);
    expect(ids).toEqual(["antiga", "meia", "nova"]);
  });

  it("usa a data de criação quando a conversa ainda não tem mensagem", () => {
    const semMensagem = conversa("sem-mensagem", null, "2026-04-01T10:00:00Z");
    const ids = ordenarConversas([...base, semMensagem], true).map((c) => c.id);
    // 2026-04-01 fica entre "nova" (05-02) e "meia" (03-01).
    expect(ids).toEqual(["nova", "sem-mensagem", "meia", "antiga"]);
  });

  it("trata data inválida como a conversa mais antiga", () => {
    const quebrada = conversa("quebrada", "não é data", "também não é data");
    const ids = ordenarConversas([...base, quebrada], true).map((c) => c.id);
    expect(ids[ids.length - 1]).toBe("quebrada");
    expect(ordenarConversas([...base, quebrada], false).map((c) => c.id)[0]).toBe("quebrada");
  });

  it("não muda a lista recebida", () => {
    const original = base.map((c) => c.id);
    ordenarConversas(base, false);
    expect(base.map((c) => c.id)).toEqual(original);
  });
});

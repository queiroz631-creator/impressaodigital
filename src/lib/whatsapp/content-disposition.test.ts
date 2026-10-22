import { describe, expect, it } from "vitest";
import {
  montarContentDisposition,
  nomeAsciiSeguro,
  sanitizarNomeArquivo,
} from "./content-disposition";

/** O Node exige ByteString (Latin-1) no valor do header: nada acima de U+00FF. */
function ehByteString(valor: string): boolean {
  return Array.from(valor).every((c) => (c.codePointAt(0) ?? 0) <= 0xff);
}

describe("sanitizarNomeArquivo", () => {
  it("normaliza para NFC (acento decomposto vira um caractere só)", () => {
    expect(sanitizarNomeArquivo("Co\u0301pia.pdf")).toBe("C\u00f3pia.pdf");
  });

  it("remove aspas, barras e caracteres de controle", () => {
    expect(sanitizarNomeArquivo('a"b\\c.pdf')).toBe("abc.pdf");
    expect(sanitizarNomeArquivo("a\r\nb.pdf")).toBe("ab.pdf");
  });

  it("aceita nulo/vazio", () => {
    expect(sanitizarNomeArquivo(null)).toBe("");
    expect(sanitizarNomeArquivo(undefined)).toBe("");
  });
});

describe("nomeAsciiSeguro", () => {
  it("translittera acentos", () => {
    expect(nomeAsciiSeguro("Cópia de Vinicius.pdf")).toBe("Copia de Vinicius.pdf");
    expect(nomeAsciiSeguro("Relatório Café.pdf")).toBe("Relatorio Cafe.pdf");
    expect(nomeAsciiSeguro("Ação nº 1.pdf")).toBe("Acao no 1.pdf");
  });

  it("substitui o que não tem tradução por underscore", () => {
    expect(nomeAsciiSeguro("emoji 😀.pdf")).toBe("emoji _.pdf");
  });

  it("nunca fica vazio", () => {
    expect(nomeAsciiSeguro("")).toBe("arquivo");
    expect(nomeAsciiSeguro("   ")).toBe("arquivo");
  });
});

describe("montarContentDisposition", () => {
  it("gera um header válido para nome com acento decomposto (NFD)", () => {
    const header = montarContentDisposition("inline", "Co\u0301pia de Vinicius.pdf.pdf");
    expect(ehByteString(header)).toBe(true);
    expect(header).toContain('filename="Copia de Vinicius.pdf.pdf"');
    expect(header).toContain("filename*=UTF-8''C%C3%B3pia%20de%20Vinicius.pdf.pdf");
  });

  it("gera um header válido para nome com acento composto (NFC)", () => {
    const header = montarContentDisposition("inline", "Cópia.pdf");
    expect(ehByteString(header)).toBe(true);
    expect(header).toContain('filename="Copia.pdf"');
    expect(header).toContain("filename*=UTF-8''C%C3%B3pia.pdf");
  });

  it("usa apenas `filename` quando o nome já é ASCII", () => {
    expect(montarContentDisposition("inline", "NF Ref. 12-2025.pdf")).toBe(
      'inline; filename="NF Ref. 12-2025.pdf"',
    );
  });

  it("respeita inline vs attachment", () => {
    expect(montarContentDisposition("attachment", "a.pdf")).toBe('attachment; filename="a.pdf"');
    expect(montarContentDisposition("inline", "a.pdf")).toBe('inline; filename="a.pdf"');
  });

  it("não deixa aspas nem quebra de linha escaparem do valor", () => {
    const header = montarContentDisposition("attachment", 'a";\r\nX-Evil: 1\r\n.pdf');
    expect(header).not.toContain("\r");
    expect(header).not.toContain("\n");
    // O nome dentro do parâmetro `filename` não pode conter aspas nem `;`.
    const nome = /filename="([^"]*)"/.exec(header)?.[1] ?? "";
    expect(nome).not.toContain('"');
    expect(nome).not.toContain(";");
    expect(header).toContain("filename*=UTF-8''a%3BX-Evil%3A%201.pdf");
  });

  it("cai em um nome padrão quando não há nome", () => {
    expect(montarContentDisposition("inline", null)).toBe('inline; filename="arquivo"');
    expect(montarContentDisposition("inline", "")).toBe('inline; filename="arquivo"');
  });

  it("nunca gera valor com caractere acima de Latin-1 (ByteString)", () => {
    const nomes = [
      "Co\u0301pia de Vinicius.pdf.pdf",
      "Cópia.pdf",
      "отчёт.pdf",
      "資料.pdf",
      "😀.pdf",
      "arquivo com ; ponto e vírgula.pdf",
    ];
    for (const nome of nomes) {
      const header = montarContentDisposition("attachment", nome);
      expect(ehByteString(header)).toBe(true);
    }
  });
});

import { describe, expect, it } from "vitest";
import { montarContentDisposition } from "../src/lib/content-disposition";

const nomes = [
  "Cópia de Vinicius.pdf",
  "Co\u0301pia de Vinicius.pdf",
  "Relatório financeiro.pdf",
  "Declaração João.pdf",
  "AÇÃO ENTRE AMIGOS.pdf",
  "Documento nº 01.pdf",
  "Arquivo com espaços.pdf",
  'Nome "com" aspas\\x.pdf',
  "Injeção\r\nX-Evil: 1.pdf",
];

describe("montarContentDisposition", () => {
  for (const n of nomes) {
    it(`gera cabeçalho válido para ${JSON.stringify(n)}`, () => {
      for (const modo of ["inline", "attachment"] as const) {
        const v = montarContentDisposition(n, modo);
        expect(() => new Headers({ "Content-Disposition": v })).not.toThrow();
        expect(v).toMatch(/^[\x20-\x7e]+$/);
        expect(v.startsWith(modo + ";")).toBe(true);
        expect(v).toContain(".pdf");
      }
    });
  }

  it("preserva o nome original no filename*", () => {
    const v = montarContentDisposition("Co\u0301pia de Vinicius.pdf", "inline");
    const enc = v.split("filename*=UTF-8''")[1];
    expect(decodeURIComponent(enc)).toBe("Cópia de Vinicius.pdf");
    expect(v).toContain('filename="Copia de Vinicius.pdf"');
  });

  it("remove CR/LF", () => {
    const v = montarContentDisposition("a\r\nb.pdf", "attachment");
    expect(v).not.toMatch(/[\r\n]/);
  });
});

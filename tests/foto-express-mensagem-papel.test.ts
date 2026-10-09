import { describe, expect, it } from "vitest";
import { calcularOrcamentoFotoExpress, ErroMontagemFoto } from "../src/modules/foto-express/lib/montagem";
import type { ItemGaleria, PapelFoto } from "../src/modules/foto-express/types";

const itens = [{ id: "foto-teste", quantidade: 1, orientacao: "RETRATO", arquivo: { largura_px: 330, altura_px: 430 }, formato: { nome: "Nome interno", nome_portal: "Foto documento", largura_cm: 3.3, altura_cm: 4.3, papel_padrao_id: "papel-teste" } }] as unknown as ItemGaleria[];
const papel = { id: "papel-teste", nome: "Papel teste", largura_mm: 17.2, altura_mm: 22.1, margem_esquerda_mm: 5, margem_direita_mm: 5, margem_superior_mm: 5, margem_inferior_mm: 5, espacamento_mm: 0, permitir_rotacao: true, valor_folha: 10, faixas_valor: [] } as unknown as PapelFoto;

describe("mensagem de papel incompatível", () => {
  it("identifica formato público, papel e medidas sem ruído decimal", () => {
    expect(() => calcularOrcamentoFotoExpress(itens, [papel])).toThrow(ErroMontagemFoto);
    expect(() => calcularOrcamentoFotoExpress(itens, [papel])).toThrow(/Foto documento.*33 × 43 mm.*Papel teste.*7,2 × 12,1 mm/);
  });
  it("explica quando as margens eliminam o espaço", () => {
    expect(() => calcularOrcamentoFotoExpress(itens, [{ ...papel, largura_mm: 10 }])).toThrow(/margens do papel “Papel teste” não deixam espaço/);
  });
  it("preserva o cálculo em papel compatível", () => {
    const resultado = calcularOrcamentoFotoExpress(itens, [{ ...papel, largura_mm: 43, altura_mm: 53 }]);
    expect(resultado.folhas).toBe(1);
    expect(resultado.valorTotal).toBe(10);
  });
});
import { describe, expect, it } from "vitest";
import { htmlComprovante, type DadosComprovante } from "../src/lib/whatsapp-comprovante";

const dados: DadosComprovante = {
  nome: "CLIENTE TESTE",
  telefone: "00000000000",
  data: "08/10/2026",
  pagamento: "parcial",
  valor: 20,
  valorServico: 70,
  valorPago: 50,
  descricao: "DESCRIÇÃO TESTE",
  usuario: "ATENDENTE TESTE",
};

describe("destaque de pagamento no comprovante térmico", () => {
  it("restaura o quadro e reduz somente a fonte do pagamento", () => {
    const html = htmlComprovante(dados);
    expect(html).toContain('<div class="pagamento"><p class="valores">');
    expect(html).toContain('<p class="valores">PAGAMENTO PARCIAL');
    expect(html.match(/<p class="separador">/g)).toHaveLength(2);
    expect(html).not.toContain('<hr');
    expect(html).not.toContain('<table');
    expect(html).toContain('border:1px solid #000;box-sizing:border-box');
    expect(html).toContain('.pagamento .valores{margin:8px 4px;font-size:16px');
    expect(html).toContain('font:14px Arial,sans-serif');
    expect(html).toContain('h1{font-size:18px');
    expect(html).toContain('font-weight:bold');
    expect(html).toContain('page-break-inside:avoid');
  });

  it("preserva os valores e os demais dados do pagamento parcial", () => {
    const html = htmlComprovante(dados);
    expect(html).toContain('PAGAMENTO PARCIAL');
    expect(html).toMatch(/VALOR DO SERVIÇO: R\$\s*70,00/);
    expect(html).toMatch(/VALOR PAGO: R\$\s*50,00/);
    expect(html).toMatch(/FALTA PAGAR: R\$\s*20,00/);
    for (const texto of [dados.nome, dados.telefone, dados.data, dados.descricao, dados.usuario]) {
      expect(html).toContain(texto);
    }
  });

  it.each(["total", "nao_pago"] as const)("preserva o valor no estado %s", (pagamento) => {
    const html = htmlComprovante({ ...dados, pagamento, valorServico: undefined, valorPago: undefined });
    expect(html).toMatch(pagamento === "total" ? /VALOR PAGO: R\$\s*20,00/ : /FALTA PAGAR: R\$\s*20,00/);
    expect(html).not.toContain('VALOR DO SERVIÇO');
  });
});
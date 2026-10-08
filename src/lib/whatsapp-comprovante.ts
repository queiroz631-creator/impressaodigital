import { normalizarNomePessoa } from "./nome-pessoa";
import { brl } from "./format";

export type PagamentoComprovante = "total" | "parcial" | "nao_pago";
export interface DadosComprovante {
  nome: string;
  telefone: string;
  data: string;
  pagamento: PagamentoComprovante;
  valor: number;
  valorServico?: number | undefined;
  valorPago?: number | undefined;
  descricao: string;
  usuario: string;
}

export function valorComprovante(texto: string): number {
  const limpo = texto.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(limpo)) return NaN;
  return Number(limpo.replace(",", "."));
}

export function saldoComprovante(valorServico: number, valorPago: number): number {
  return (Math.round(valorServico * 100) - Math.round(valorPago * 100)) / 100;
}

export function pagamentoComprovante(dados: DadosComprovante) {
  return {
    titulo:
      dados.pagamento === "total"
        ? "PAGAMENTO TOTAL"
        : dados.pagamento === "parcial"
          ? "PAGAMENTO PARCIAL"
          : "NÃO PAGO",
    valor: `${dados.pagamento === "total" ? "VALOR PAGO" : "FALTA PAGAR"}: ${brl(dados.valor)}`,
    detalhes:
      dados.pagamento === "parcial" && dados.valorServico !== undefined && dados.valorPago !== undefined
        ? [`VALOR DO SERVIÇO: ${brl(dados.valorServico)}`, `VALOR PAGO: ${brl(dados.valorPago)}`]
        : [],
  };
}

function escapar(valor: string) {
  return valor.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );
}

// Print-only ink values are intentionally independent from the application theme.
export function htmlComprovante(dados: DadosComprovante): string {
  const pagamento = pagamentoComprovante(dados);
  const separador = '<p class="separador">--------------------------------</p>';

  return `<html>
  <head>
    <meta charset="UTF-8">
    <style>
      @page {
        size: 80mm auto;
        margin: 0;
      }

      html, body {
        margin: 0;
        padding: 0;
        height: auto;
        min-height: 0;
      }

      body {
        width: 60mm;
        margin: 4mm;
        font: 14px Arial, sans-serif;
        color: #000;
        background: #fff;
        letter-spacing: 0;
        overflow-wrap: anywhere;
      }

      h1 {
        font-size: 18px;
        margin: 0 0 8px;
      }

      p {
        margin: 6px 0;
        white-space: pre-wrap;
      }

      .pagamento {
        width: 60mm;
        margin: 8px 0;
        border: 1px solid #000;
        box-sizing: border-box;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      .pagamento .valores {
        margin: 6px 4px;
        font-size: 16px;
        font-weight: bold;
        word-wrap: break-word;
      }

      .separador {
        margin: 0;
        font: 14px "Courier New", monospace;
        white-space: nowrap;
      }

      body > :last-child {
        margin-bottom: 0 !important;
      }
    </style>
  </head>

  <body>
    <h1>IMPRESSÃO DIGITAL</h1>
    ${separador}

    <p><b>CLIENTE</b><br>${escapar(normalizarNomePessoa(dados.nome))}</p>
    <p><b>TELEFONE</b><br>${escapar(dados.telefone)}</p>
    <p><b>DATA</b><br>${escapar(dados.data)}</p>

    <div class="pagamento">
      <p class="valores">
        ${pagamento.titulo}<br>
        ${pagamento.detalhes.map((linha) => `${escapar(linha)}<br>`).join("")}
        ${escapar(pagamento.valor)}
      </p>
    </div>

    <p><b>DESCRIÇÃO</b><br>${escapar(dados.descricao || "—")}</p>

    ${separador}

    <p><b>ATENDENTE</b><br>${escapar(dados.usuario)}</p>
  </body>
  </html>`;
}

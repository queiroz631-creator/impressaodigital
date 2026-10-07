import { normalizarNomePessoa } from "./nome-pessoa";
import { brl } from "./format";

export type PagamentoComprovante = "total" | "parcial" | "nao_pago";
export interface DadosComprovante {
  nome: string;
  telefone: string;
  data: string;
  pagamento: PagamentoComprovante;
  valor: number;
  descricao: string;
  usuario: string;
}

export function valorComprovante(texto: string): number {
  const limpo = texto.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(limpo)) return NaN;
  return Number(limpo.replace(",", "."));
}

export function pagamentoComprovante(dados: DadosComprovante) {
  return {
    titulo: dados.pagamento === "total" ? "PAGAMENTO TOTAL" : dados.pagamento === "parcial" ? "PAGAMENTO PARCIAL" : "NÃO PAGO",
    valor: `${dados.pagamento === "total" ? "VALOR PAGO" : "FALTA PAGAR"}: ${brl(dados.valor)}`,
  };
}

function escapar(valor: string) {
  return valor.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

// Print-only ink values are intentionally independent from the application theme.
export function htmlComprovante(dados: DadosComprovante): string {
  const pagamento = pagamentoComprovante(dados);
  return `<html><head><meta charset="UTF-8"><style>
    @page{size:80mm auto;margin:0}body{width:72mm;margin:4mm;font:14px Arial,sans-serif;color:#000;background:#fff;letter-spacing:0;overflow-wrap:anywhere}
    h1{font-size:18px;margin:0 0 12px}p{margin:8px 0;white-space:pre-wrap}.pagamento{width:100%;table-layout:fixed;border-collapse:collapse;margin:12px 0;page-break-inside:avoid;break-inside:avoid}.pagamento td{border:2px solid #000;padding:8px 4px;font-size:18px;font-weight:bold;word-wrap:break-word;page-break-inside:avoid;break-inside:avoid}hr{border:0;border-top:1px dashed #000}
    </style></head><body><h1>IMPRESSÃO DIGITAL</h1><hr><p><b>CLIENTE</b><br>${escapar(normalizarNomePessoa(dados.nome))}</p>
    <p><b>TELEFONE</b><br>${escapar(dados.telefone)}</p><p><b>DATA</b><br>${escapar(dados.data)}</p>
    <table class="pagamento" role="presentation"><tbody><tr><td>${pagamento.titulo}<br>${escapar(pagamento.valor)}</td></tr></tbody></table>
    <p><b>DESCRIÇÃO</b><br>${escapar(dados.descricao || "—")}</p><hr><p><b>ATENDENTE</b><br>${escapar(dados.usuario)}</p></body></html>`;
}
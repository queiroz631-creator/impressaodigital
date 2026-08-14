import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { brl, dataBR } from "./format";

export interface DadosOrcamentoPdf {
  numero: string;
  data: string;
  empresaNome: string;
  empresaTelefone?: string | null | undefined;
  empresaEmail?: string | null | undefined;
  empresaEndereco?: string | null | undefined;
  rodape: string;
  clienteNome: string;
  clienteTelefone?: string | null | undefined;
  quantidadeArquivos: number;
  paginasTotal: number;
  paginasPb: number;
  paginasColor: number;
  tipoImpressao: string;
  material: string;
  valorUnitario: number;
  valorTotal: number;
  validade?: string | null | undefined;
  observacao?: string | null | undefined;
}

const NAVY: [number, number, number] = [26, 26, 94];

export function gerarOrcamentoPdf(d: DadosOrcamentoPdf) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, width, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("CALCULADORA DE IMPRESSÃO DIGITAL", 40, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(d.empresaNome, 40, 60);
  const contato = [d.empresaTelefone, d.empresaEmail].filter(Boolean).join("  •  ");
  if (contato) doc.text(contato, 40, 75);

  doc.setFontSize(10);
  doc.text(`Orçamento ${d.numero}`, width - 40, 40, { align: "right" });
  doc.text(`Data: ${dataBR(d.data)}`, width - 40, 56, { align: "right" });
  if (d.validade) doc.text(`Validade: ${dataBR(d.validade)}`, width - 40, 72, { align: "right" });

  doc.setTextColor(20, 20, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("DADOS DO CLIENTE", 40, 125);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Nome: ${d.clienteNome || "-"}`, 40, 143);
  doc.text(`Telefone: ${d.clienteTelefone || "-"}`, 40, 158);

  autoTable(doc, {
    startY: 180,
    head: [["Descrição", "Valor"]],
    body: [
      ["Quantidade de arquivos", String(d.quantidadeArquivos)],
      ["Quantidade de páginas", String(d.paginasTotal)],
      ["Páginas PB", String(d.paginasPb)],
      ["Páginas coloridas", String(d.paginasColor)],
      ["Tipo de impressão", d.tipoImpressao],
      ["Material", d.material],
      ["Valor por página", brl(d.valorUnitario)],
      ["VALOR TOTAL", brl(d.valorTotal)],
    ],
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold" },
    bodyStyles: { fontSize: 10 },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });

  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 30;
  if (d.observacao) {
    doc.setFont("helvetica", "bold");
    doc.text("Observações", 40, y);
    doc.setFont("helvetica", "normal");
    const linhas = doc.splitTextToSize(d.observacao, width - 80);
    doc.text(linhas, 40, y + 16);
    y += 16 + linhas.length * 14;
  }

  doc.setFontSize(9);
  doc.setTextColor(110, 110, 130);
  doc.text(d.rodape, width / 2, doc.internal.pageSize.getHeight() - 40, { align: "center" });

  doc.save(`orcamento-${d.numero}.pdf`);
}
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { brl, dataBR } from "./format";
import type { DadosDocumento } from "./documento";

const NAVY: [number, number, number] = [26, 26, 94];

function finalY(doc: jsPDF) {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

export function gerarOrcamentoPdf(d: DadosDocumento, baixar = true) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, width, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("IMPRESSÃO DIGITAL", 40, 40);
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

  let y = 180;

  for (const item of d.itens) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`${item.titulo} — ${item.material}`, 40, y);
    y += 10;

    const resumo: string[][] = [
      ["Material utilizado", item.material],
      ["Tipo de impressão", item.tipoImpressao],
      ["Quantidade de arquivos", String(item.quantidadeArquivos)],
      ["Páginas adicionais", String(item.paginasAdicionais)],
      ["Cópias adicionais", String(item.copiasAdicionais)],
    ];
    if (item.tamanho) resumo.push(["Formato", item.tamanho]);
    if (item.frenteVerso) resumo.push(["Frente e verso", "Sim"]);
    if (item.copiaManual) resumo.push(["Cópia manual", "Sim"]);

    autoTable(doc, {
      startY: y,
      head: [["Descrição", "Valor"]],
      body: resumo,
      theme: "grid",
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold" },
      bodyStyles: { fontSize: 10 },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: 40, right: 40 },
    });
    y = finalY(doc) + 18;

    if (item.acabamentos.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Acabamento", "Qtd.", "Detalhe"]],
        body: item.acabamentos.map((a) =>
          a.incluso ? [a.nome, String(a.quantidade), "Incluso"] : [a.nome, "-", "Não incluso"],
        ),
        theme: "grid",
        headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: "bold" },
        bodyStyles: { fontSize: 10 },
        columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
        margin: { left: 40, right: 40 },
      });
      y = finalY(doc) + 18;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Total ${item.titulo}: ${brl(item.total)}`, width - 40, y, { align: "right" });
    y += 28;

    if (y > doc.internal.pageSize.getHeight() - 140 && item !== d.itens[d.itens.length - 1]) {
      doc.addPage();
      y = 60;
    }
  }

  if (d.mostrarTotal !== false) {
    autoTable(doc, {
      startY: y,
      body: [["VALOR TOTAL", brl(d.total)]],
      theme: "grid",
      bodyStyles: { fontSize: 12, fontStyle: "bold", fillColor: [235, 235, 245] },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: 40, right: 40 },
    });
    y = finalY(doc) + 30;
  }

  if (d.prazoTexto) {
    doc.setFont("helvetica", "bold");
    doc.text("Prazo de entrega", 40, y);
    doc.setFont("helvetica", "normal");
    const linhasPrazo = doc.splitTextToSize(d.prazoTexto, width - 80);
    doc.text(linhasPrazo, 40, y + 16);
    y += 16 + linhasPrazo.length * 14 + 10;
  }

  if (d.pix) {
    doc.setFont("helvetica", "bold");
    doc.text("PAGAMENTO VIA PIX", 40, y);
    doc.setFont("helvetica", "normal");
    const linhasPix = doc.splitTextToSize(d.pix, width - 80);
    doc.text(linhasPix, 40, y + 16);
    y += 16 + linhasPix.length * 14 + 10;
  }

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

  if (baixar) {
    doc.save(`orcamento-${d.numero}.pdf`);
  }
}

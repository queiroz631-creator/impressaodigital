import jsPDF from "jspdf";
import {
  formacaoFinal,
  formatarTelefone,
  informacoesAdicionais,
  objetivoFinal,
  type CurriculoCompleto,
} from "./curriculo";
import { dataBR } from "./format";

const MARGEM = 48;

export function gerarCurriculoPdf(dados: CurriculoCompleto): jsPDF {
  const c = dados.curriculo;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const util = largura - MARGEM * 2;
  let y = MARGEM;

  const quebra = (necessario = 16) => {
    if (y + necessario > altura - MARGEM) {
      doc.addPage();
      y = MARGEM;
    }
  };

  const paragrafo = (texto: string, tamanho = 10, negrito = false) => {
    doc.setFont("helvetica", negrito ? "bold" : "normal");
    doc.setFontSize(tamanho);
    doc.setTextColor(20, 20, 30);
    for (const linha of doc.splitTextToSize(texto, util) as string[]) {
      quebra(tamanho + 4);
      doc.text(linha, MARGEM, y);
      y += tamanho + 4;
    }
  };

  const secao = (titulo: string) => {
    quebra(34);
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(26, 26, 94);
    doc.text(titulo.toUpperCase(), MARGEM, y);
    y += 6;
    doc.setDrawColor(26, 26, 94);
    doc.setLineWidth(0.8);
    doc.line(MARGEM, y, largura - MARGEM, y);
    y += 14;
  };

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(26, 26, 94);
  doc.text((c.nome_completo || "Currículo").toUpperCase(), MARGEM, y);
  y += 20;

  const contatos: string[] = [];
  if (c.telefone_principal) contatos.push(formatarTelefone(c.telefone_principal));
  for (const t of dados.telefones) contatos.push(formatarTelefone(t.telefone));
  if (c.email) contatos.push(c.email);
  if (contatos.length) paragrafo(contatos.join("  •  "), 10);

  const pessoais: string[] = [];
  if (c.data_nascimento) pessoais.push(`Nascimento: ${dataBR(c.data_nascimento)}`);
  if (c.estado_civil) pessoais.push(c.estado_civil);
  if (pessoais.length) paragrafo(pessoais.join("  •  "), 10);

  const objetivo = objetivoFinal(c);
  if (objetivo) {
    secao("Objetivo");
    paragrafo(objetivo);
  }

  const formacao = formacaoFinal(c);
  if (formacao) {
    secao("Formação");
    paragrafo(formacao);
  }

  if (dados.cursos.length) {
    secao("Cursos complementares");
    for (const curso of dados.cursos) {
      paragrafo(curso.instituicao ? `${curso.nome_curso} — ${curso.instituicao}` : curso.nome_curso);
    }
  }

  if (dados.experiencias.length) {
    secao("Experiência profissional");
    for (const exp of dados.experiencias) {
      const titulo = [exp.empresa, exp.cargo].filter(Boolean).join(" — ");
      if (titulo) paragrafo(titulo, 10, true);
      if (exp.periodo) paragrafo(`Período: ${exp.periodo}`, 9);
      if (exp.atividades) paragrafo(exp.atividades, 10);
      y += 6;
    }
  }

  if (dados.habilidades.length) {
    secao("Habilidades");
    for (const h of dados.habilidades) paragrafo(`• ${h.descricao}`);
  }

  const adicionais = informacoesAdicionais(c);
  if (adicionais.length) {
    secao("Informações adicionais");
    for (const linha of adicionais) paragrafo(`• ${linha}`);
  }

  if (c.exibir_data_atualizacao) {
    quebra(30);
    y += 16;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 120);
    doc.text(`Atualizado em ${dataBR(c.updated_at)}`, MARGEM, y);
  }

  return doc;
}

export function nomeArquivoCurriculo(nome: string) {
  const limpo = (nome || "curriculo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `curriculo-${limpo || "cliente"}.pdf`;
}

export function baixarCurriculoPdf(dados: CurriculoCompleto) {
  gerarCurriculoPdf(dados).save(nomeArquivoCurriculo(dados.curriculo.nome_completo));
}

export function curriculoPdfBase64(dados: CurriculoCompleto) {
  return gerarCurriculoPdf(dados).output("datauristring");
}

/** Impressão A4 do currículo, isolando o conteúdo do restante da tela. */
export function imprimirCurriculo(elemento: HTMLElement | null) {
  if (!elemento) return;

  const anterior = document.getElementById("curriculo-print-area");
  anterior?.remove();

  const area = document.createElement("div");
  area.id = "curriculo-print-area";
  area.innerHTML = elemento.innerHTML;
  document.body.appendChild(area);

  const estilo = document.createElement("style");
  estilo.id = "curriculo-print-style";
  estilo.textContent = `
    @media print {
      @page { size: A4; margin: 14mm; }
      body * { visibility: hidden !important; }
      #curriculo-print-area, #curriculo-print-area * { visibility: visible !important; }
      #curriculo-print-area {
        position: absolute !important; left: 0 !important; top: 0 !important;
        width: 100% !important; max-width: 100% !important; margin: 0 !important;
        padding: 0 !important; box-shadow: none !important; border: 0 !important;
        background: #fff !important; color: #000 !important;
      }
      html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
    }
    #curriculo-print-area { position: fixed; left: -10000px; top: 0; width: 180mm; }
  `;
  document.head.appendChild(estilo);

  const limpar = () => {
    area.remove();
    estilo.remove();
    window.removeEventListener("afterprint", limpar);
  };
  window.addEventListener("afterprint", limpar);

  window.print();
  window.setTimeout(limpar, 3000);
}

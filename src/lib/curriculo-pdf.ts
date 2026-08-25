import jsPDF from "jspdf";
import {
  enderecoLinhas,
  formacaoFinal,
  formatarTelefone,
  informacoesAdicionais,
  objetivoFinal,
  type CurriculoCompleto,
  type FormacaoItem,
} from "./curriculo";
import { dataBR } from "./format";

const MARGEM = 40;
const NAVY: [number, number, number] = [26, 26, 94];
const TEXTO: [number, number, number] = [17, 17, 26];

export function gerarCurriculoPdf(dados: CurriculoCompleto): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const util = largura - MARGEM * 2;

  // Primeira passagem: mede a altura total do conteúdo com escala 1.
  const medida = renderizar(doc, dados, largura, altura, util, 1, 0);
  const disponivel = altura - MARGEM * 2;
  let escala = 1;
  if (medida.total > disponivel) {
    escala = Math.max(0.7, disponivel / medida.total);
  }
  const espacamentoExtra = medida.total < disponivel * 0.6 && escala === 1
    ? (disponivel - medida.total) / Math.max(1, medida.secoes)
    : 0;

  // Segunda passagem: desenha com a escala calculada.
  renderizar(doc, dados, largura, altura, util, escala, espacamentoExtra);
  return doc;
}

interface RenderResult {
  total: number;
  secoes: number;
}

function renderizar(
  doc: jsPDF,
  dados: CurriculoCompleto,
  largura: number,
  altura: number,
  util: number,
  escala: number,
  espacamentoExtra: number,
): RenderResult {
  const c = dados.curriculo;
  let y = MARGEM;
  let secoes = 0;

  const setFont = (negrito: boolean, tamanho: number) => {
    doc.setFont("helvetica", negrito ? "bold" : "normal");
    doc.setFontSize(tamanho * escala);
  };

  const texto = (linha: string, x: number, tamanho: number, negrito = false, cor: [number, number, number] = TEXTO) => {
    setFont(negrito, tamanho);
    doc.setTextColor(...cor);
    doc.text(linha, x, y);
    y += (tamanho + 4) * escala;
  };

  const paragrafo = (str: string, x: number, larguraDisp: number, tamanho: number, negrito = false) => {
    setFont(negrito, tamanho);
    doc.setTextColor(...TEXTO);
    for (const linha of doc.splitTextToSize(str, larguraDisp) as string[]) {
      texto(linha, x, tamanho, negrito);
    }
  };

  const secao = (titulo: string) => {
    secoes += 1;
    const h = 18 * escala;
    doc.setFillColor(...NAVY);
    doc.rect(MARGEM, y - 2, util, h, "F");
    setFont(true, 11);
    doc.setTextColor(255, 255, 255);
    doc.text(titulo.toUpperCase(), MARGEM + 8, y + h - 5);
    y += h + 8 * escala + espacamentoExtra / 2;
  };

  const centro = largura / 2;
  const centrado = (linha: string, tamanho: number, negrito = false, cor: [number, number, number] = TEXTO) => {
    setFont(negrito, tamanho);
    doc.setTextColor(...cor);
    doc.text(linha, centro, y, { align: "center" });
    y += (tamanho + 4) * escala;
  };

  // ===== Cabeçalho: faixa azul com título centralizado =====
  const hFaixa = 26 * escala;
  doc.setFillColor(...NAVY);
  doc.rect(MARGEM, y, util, hFaixa, "F");
  setFont(true, 16);
  doc.setTextColor(255, 255, 255);
  doc.text("CURRÍCULO VITAE", centro, y + hFaixa - 8 * escala, { align: "center" });
  y += hFaixa + 16 * escala;

  centrado((c.nome_completo || "").toUpperCase(), 15, true, NAVY);

  // Espaço reduzido entre o nome e os telefones
  y += 4 * escala;

  const telefones = [
    c.telefone_principal ? formatarTelefone(c.telefone_principal) : "",
    ...dados.telefones.map((t) => formatarTelefone(t.telefone)),
  ].filter(Boolean);
  if (telefones.length) centrado(telefones.join("  •  "), 12);
  if (c.email) centrado(c.email, 10);

  y += 6 * escala;

  // ===== Dados pessoais =====
  const pessoais: string[] = [];
  if (c.data_nascimento) pessoais.push(`Nascimento: ${dataBR(c.data_nascimento)}`);
  if (c.estado_civil) pessoais.push(c.estado_civil);
  pessoais.push(...enderecoLinhas(c));
  if (pessoais.length) {
    secao("Dados pessoais");
    for (const p of pessoais) paragrafo(p, MARGEM, util, 10);
    y += 4 * escala + espacamentoExtra / 2;
  }

  // ===== Informações adicionais =====
  const adicionais = informacoesAdicionais(c);
  if (adicionais.length) {
    secao("Informações adicionais");
    for (const linha of adicionais) paragrafo(`• ${linha}`, MARGEM, util, 10);
    y += 4 * escala + espacamentoExtra / 2;
  }

  // ===== Formação =====
  const formacao = formacaoFinal(c);
  if (formacao || dados.formacoes.length) {
    secao("Formação");
    if (formacao) paragrafo(formacao, MARGEM, util, 10);
    for (const f of dados.formacoes) {
      paragrafo(formatarFormacao(f), MARGEM, util, 10);
    }
    y += 4 * escala + espacamentoExtra / 2;
  }

  // ===== Cursos complementares =====
  if (dados.cursos.length) {
    secao("Cursos complementares");
    for (const curso of dados.cursos) {
      paragrafo(formatarCurso(curso), MARGEM, util, 10);
    }
    y += 4 * escala + espacamentoExtra / 2;
  }

  // ===== Experiência profissional =====
  if (!c.experiencia_possui) {
    secao("Experiência profissional");
    texto(fraseSemExperiencia(c), MARGEM, 12, true, NAVY);
    y += 4 * escala + espacamentoExtra / 2;
  } else if (dados.experiencias.length) {
    secao("Experiência profissional");
    for (const exp of dados.experiencias) {
      if (exp.empresa) texto(exp.empresa, MARGEM, 11, true, NAVY);
      if (exp.cargo) texto(`Cargo/Função: ${exp.cargo}`, MARGEM, 10);
      if (exp.periodo) texto(`Período: ${exp.periodo}`, MARGEM, 9);
      if (exp.atividades) paragrafo(`Atividade(s): ${exp.atividades}`, MARGEM, util, 10);
      y += 6 * escala + espacamentoExtra / 2;
    }
  }

  // ===== Habilidades =====
  const obsHabilidades = observacaoHabilidades(c);
  if (dados.habilidades.length || obsHabilidades) {
    secao("Habilidades");
    for (const h of dados.habilidades) paragrafo(`• ${h.descricao}`, MARGEM, util, 10);
    if (obsHabilidades) paragrafo(`OBS.: ${obsHabilidades}`, MARGEM, util, 10);
    y += 4 * escala + espacamentoExtra / 2;
  }

  // ===== Objetivo (por último) =====
  const objetivo = objetivoFinal(c);
  if (objetivo) {
    secao("Objetivo");
    paragrafo(objetivo, MARGEM, util, 10);
  }

  if (c.exibir_data_atualizacao) {
    y += 16 * escala + espacamentoExtra / 2;
    setFont(false, 9);
    doc.setTextColor(110, 110, 120);
    doc.text(`Atualizado em ${dataBR(c.updated_at)}`, MARGEM, y);
  }

  return { total: y - MARGEM, secoes };
}

function formatarCurso(curso: { nome_curso: string; instituicao: string | null; ano: string | null }) {
  const partes = [curso.nome_curso];
  if (curso.instituicao) partes.push(curso.instituicao);
  if (curso.ano) partes.push(curso.ano);
  return partes.join(" — ");
}

function formatarFormacao(f: FormacaoItem) {
  const partes = [];
  if (f.nivel) partes.push(f.nivel);
  if (f.nome_curso) partes.push(f.nome_curso);
  if (f.instituicao) partes.push(f.instituicao);
  if (f.ano) partes.push(f.ano);
  return partes.join(" — ");
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

/**
 * Impressão A4 do currículo em um iframe isolado, com os estilos da página
 * copiados — evita folha em branco e conteúdo oculto.
 */
export function imprimirCurriculo(elemento: HTMLElement | null) {
  if (!elemento) return;

  document.getElementById("curriculo-print-frame")?.remove();

  const frame = document.createElement("iframe");
  frame.id = "curriculo-print-frame";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }

  const estilos = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style'),
  )
    .map((n) => n.outerHTML)
    .join("\n");

  // Área útil A4 com margem de 10mm (96dpi).
  const MM = 96 / 25.4;
  const larguraUtil = Math.round(190 * MM);
  const alturaUtil = Math.round(277 * MM);

  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8">${estilos}
<style>
  @page { size: A4; margin: 10mm; }
  html, body { margin:0; padding:0; background:#fff; height:auto; overflow:visible; }
  /* Os estilos copiados da página incluem regras de impressão da etiqueta
     térmica (body * { visibility:hidden }) que deixariam a folha em branco. */
  @media print {
    @page { size: A4; margin: 10mm; }
    html, body, body *, #cv-escala, #cv-escala * { visibility: visible !important; }
    body { width:auto !important; }
  }
  #cv-escala { width:${larguraUtil}px; transform-origin: top left; }
  #cv-escala > .cv-print { width:100%; max-width:100%; margin:0; padding:0; box-shadow:none !important; border:0; background:#fff; }
  .cv-secao { background:#1a1a5e !important; color:#fff !important; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  .cv-empresa { color:#1a1a5e !important; font-weight:700 !important; }
  .cv-print, .cv-print * { color:#11111a; }
  .cv-secao, .cv-secao * { color:#fff !important; }
  .cv-print, .cv-print * { break-inside: avoid; page-break-inside: avoid; }
</style></head><body><div id="cv-escala"></div></body></html>`);
  doc.close();

  const clone = elemento.cloneNode(true) as HTMLElement;
  clone.classList.add("cv-print");
  clone.style.boxShadow = "none";
  const wrapper = doc.getElementById("cv-escala") as HTMLElement;
  wrapper.appendChild(clone);

  const limpar = () => window.setTimeout(() => frame.remove(), 500);

  const medirAltura = () => clone.getBoundingClientRect().height || clone.scrollHeight;

  const aplicarFator = (fator: number) => {
    // Usa zoom (e não transform) para o texto refluir e ocupar toda a largura útil,
    // igual à visualização e ao PDF.
    wrapper.style.width = `${larguraUtil / fator}px`;
    (wrapper.style as unknown as Record<string, string>)["zoom"] = String(fator);
    wrapper.style.transform = "none";
    wrapper.style.height = "auto";
  };

  const ajustarEscala = () => {
    let fator = 1;
    aplicarFator(fator);
    for (let i = 0; i < 12; i += 1) {
      // Com zoom, o retângulo medido já está na escala aplicada.
      const altura = medirAltura();

      if (altura <= alturaUtil - 2) break;
      const proximo = Math.max(0.5, fator * ((alturaUtil - 4) / altura));
      if (Math.abs(proximo - fator) < 0.005) {
        fator = proximo;
        aplicarFator(fator);
        break;
      }
      fator = proximo;
      aplicarFator(fator);
    }
  };


  const disparar = () => {
    ajustarEscala();
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    limpar();
  };

  // Aguarda as folhas de estilo/fontes carregarem antes de imprimir.
  const janela = frame.contentWindow;
  if (janela && "fonts" in janela.document) {
    janela.document.fonts.ready.then(() => window.setTimeout(disparar, 150));
  } else {
    window.setTimeout(disparar, 400);
  }
}


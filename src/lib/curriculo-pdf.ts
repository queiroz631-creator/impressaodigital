import jsPDF from "jspdf";
import {
  enderecoLinhas,
  formacaoFinal,
  telefoneComDescricao,
  fraseSemExperiencia,
  informacoesAdicionais,
  objetivoFinal,
  observacaoHabilidades,
  type CurriculoCompleto,
  type ExperienciaItem,
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

  // Primeira passagem: mede a altura total do conteúdo (documento descartável).
  const rascunho = new jsPDF({ unit: "pt", format: "a4" });
  const medida = renderizar(rascunho, dados, largura, altura, util, 1, { cabecalho: 0, secao: 0 });

  const disponivel = altura - MARGEM * 2;
  let escala = 1;
  if (medida.total > disponivel) {
    escala = Math.max(0.7, disponivel / medida.total);
  }

  // Distribui a folga da folha entre cabeçalho e respiros das seções.
  const sobra = Math.max(0, disponivel - medida.total);
  // 3 respiros no cabeçalho + 2 por seção (antes e depois do conteúdo).
  const pontos = 3 + medida.secoes * 2;
  const unidade = escala === 1 ? Math.min(18, sobra / Math.max(1, pontos)) : 0;
  const folga: Folga = {
    // O topo é o ponto mais comprimido: recebe uma fatia maior.
    cabecalho: Math.min(26, unidade * 1.4),
    secao: unidade,
  };

  // Segunda passagem: desenha com a escala calculada.
  renderizar(doc, dados, largura, altura, util, escala, folga);
  return doc;
}

interface RenderResult {
  total: number;
  secoes: number;
}

interface Folga {
  cabecalho: number;
  secao: number;
}

function renderizar(
  doc: jsPDF,
  dados: CurriculoCompleto,
  largura: number,
  altura: number,
  util: number,
  escala: number,
  folga: Folga,
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

  const paragrafo = (
    str: string,
    x: number,
    larguraDisp: number,
    tamanho: number,
    negrito = false,
    cor: [number, number, number] = TEXTO,
  ) => {
    setFont(negrito, tamanho);
    doc.setTextColor(...cor);
    for (const linha of doc.splitTextToSize(str, larguraDisp) as string[]) {
      texto(linha, x, tamanho, negrito, cor);
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
    y += h + 8 * escala + folga.secao;
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
  const topoFaixa = y;
  doc.setFillColor(...NAVY);
  doc.rect(MARGEM, y, util, hFaixa, "F");
  setFont(true, 16);
  doc.setTextColor(255, 255, 255);
  doc.text("CURRÍCULO VITAE", centro, y + hFaixa - 8 * escala, { align: "center" });
  y += hFaixa + 16 * escala + folga.cabecalho;

  centrado((c.nome_completo || "").toUpperCase(), 15, true, NAVY);

  // Espaço entre o nome e os telefones
  y += 4 * escala + folga.cabecalho;

  const telefones = [
    c.telefone_principal ? telefoneComDescricao(c.telefone_principal, c.telefone_principal_descricao) : "",
    ...dados.telefones.map((t) => telefoneComDescricao(t.telefone, t.tipo)),
  ].filter(Boolean);
  if (telefones.length) centrado(telefones.join("  •  "), 12);
  if (c.email) centrado(c.email, 10);

  y += 6 * escala + folga.cabecalho;

  // Foto 2,5cm x 3,5cm alinhada ao topo e à direita da faixa do cabeçalho.
  if (c.foto_exibir && c.foto_url) {
    const fotoL = 70.87;
    const fotoA = 99.21;
    try {
      doc.addImage(c.foto_url, "JPEG", MARGEM + util - fotoL, topoFaixa, fotoL, fotoA);
    } catch {
      /* imagem inválida: segue sem foto */
    }
    if (y < topoFaixa + fotoA + 8) y = topoFaixa + fotoA + 8;
  }


  // ===== Dados pessoais =====
  const pessoais: string[] = [];
  if (c.data_nascimento) pessoais.push(`Nascimento: ${dataBR(c.data_nascimento)}`);
  if (c.estado_civil) pessoais.push(c.estado_civil);
  pessoais.push(...enderecoLinhas(c));
  if (pessoais.length) {
    secao("Dados pessoais");
    for (const p of pessoais) paragrafo(p, MARGEM, util, 10);
    y += 8 * escala + folga.secao;
  }

  // ===== Informações adicionais =====
  const adicionais = informacoesAdicionais(c);
  if (adicionais.length) {
    secao("Informações adicionais");
    for (const linha of adicionais) paragrafo(`• ${linha}`, MARGEM, util, 10);
    y += 8 * escala + folga.secao;
  }

  // ===== Formação =====
  const formacao = formacaoFinal(c);
  if (formacao || dados.formacoes.length) {
    secao("Formação");
    if (formacao) paragrafo(formacao, MARGEM, util, 10);
    for (const f of dados.formacoes) {
      paragrafo(formatarFormacao(f), MARGEM, util, 10);
    }
    y += 8 * escala + folga.secao;
  }

  // ===== Cursos complementares =====
  if (dados.cursos.length) {
    secao("Cursos complementares");
    for (const curso of dados.cursos) {
      paragrafo(formatarCurso(curso), MARGEM, util, 10);
    }
    y += 8 * escala + folga.secao;
  }

  // ===== Experiência profissional =====
  if (!c.experiencia_possui) {
    secao("Experiência profissional");
    texto(fraseSemExperiencia(c), MARGEM, 12, true, NAVY);
    y += 8 * escala + folga.secao;
  } else if (dados.experiencias.length) {
    secao("Experiência profissional");
    if (dados.experiencias.length > 3) {
      // Com mais de 3 empresas: distribui em duas colunas para ocupar menos altura.
      const colW = util / 2 - 8;
      const xDir = MARGEM + util / 2 + 8;
      const metade = Math.ceil(dados.experiencias.length / 2);
      const esq = dados.experiencias.slice(0, metade);
      const dir = dados.experiencias.slice(metade);

      const renderExp = (exp: ExperienciaItem, x: number, yStart: number, larg: number): number => {
        let yi = yStart;
        if (exp.empresa) {
          setFont(true, 11);
          doc.setTextColor(...NAVY);
          doc.text(exp.empresa, x, yi);
          yi += (11 + 4) * escala;
        }
        if (exp.cargo) {
          setFont(false, 10);
          doc.setTextColor(...TEXTO);
          doc.text(`Cargo/Função: ${exp.cargo}`, x, yi);
          yi += (10 + 4) * escala;
        }
        if (exp.periodo) {
          setFont(false, 9);
          doc.setTextColor(...TEXTO);
          doc.text(`Período: ${exp.periodo}`, x, yi);
          yi += (9 + 4) * escala;
        }
        if (exp.atividades) {
          setFont(false, 10);
          doc.setTextColor(...TEXTO);
          for (const linha of doc.splitTextToSize(`Atividade(s): ${exp.atividades}`, larg) as string[]) {
            doc.text(linha, x, yi);
            yi += (10 + 4) * escala;
          }
        }
        return yi;
      };

      let yEsq = y;
      for (const exp of esq) {
        yEsq = renderExp(exp, MARGEM, yEsq, colW) + 6 * escala + folga.secao;
      }
      let yDir = y;
      for (const exp of dir) {
        yDir = renderExp(exp, xDir, yDir, colW) + 6 * escala + folga.secao;
      }
      y = Math.max(yEsq, yDir) + 8 * escala + folga.secao;
    } else {
      for (const exp of dados.experiencias) {
        if (exp.empresa) texto(exp.empresa, MARGEM, 11, true, NAVY);
        if (exp.cargo) texto(`Cargo/Função: ${exp.cargo}`, MARGEM, 10);
        if (exp.periodo) texto(`Período: ${exp.periodo}`, MARGEM, 9);
        if (exp.atividades) paragrafo(`Atividade(s): ${exp.atividades}`, MARGEM, util, 10);
        y += 6 * escala + folga.secao;
      }
    }
  }

  // ===== Habilidades =====
  if (dados.habilidades.length) {
    secao("Habilidades");
    for (const h of dados.habilidades) paragrafo(`• ${h.descricao}`, MARGEM, util, 10);
    y += 8 * escala + folga.secao;
  }

  // ===== Objetivo =====
  const objetivo = objetivoFinal(c);
  if (objetivo) {
    secao("Objetivo");
    paragrafo(objetivo, MARGEM, util, 10);
    y += 8 * escala + folga.secao;
  }

  // ===== Observação (destaque final, sem barra de seção) =====
  const obsHabilidades = observacaoHabilidades(c);
  if (obsHabilidades) {
    y += folga.secao;
    paragrafo(`OBS.: ${obsHabilidades}`, MARGEM, util, 12, true, NAVY);
  }


  if (c.exibir_data_atualizacao) {
    y += 16 * escala + folga.secao;
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
  /* Margem interna equivalente à do PDF (40pt), para que a faixa das seções
     tenha exatamente a mesma largura na impressão e no PDF. */
  #cv-escala > .cv-print { width:100%; max-width:100%; margin:0; padding:6mm 4.1mm; box-shadow:none !important; border:0; background:#fff; }
  .cv-secao { background:#1a1a5e !important; color:#fff !important; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  /* Todas as faixas (inclusive a do cabeçalho) com a mesma largura e altura. */
  .cv-print .cv-secao { display:block !important; width:100% !important; box-sizing:border-box !important; margin:0 !important; padding:1.4mm 3mm !important; font-size:10.5pt !important; }
  /* Centraliza e deixa em negrito o título "Currículo Vitae" e os dados do cliente, igual ao PDF. */
  .cv-print header .cv-secao { text-align:center !important; font-weight:bold !important; }
  .cv-print header h1,
  .cv-print header > div > p { text-align:center !important; }
  .cv-empresa { color:#1a1a5e !important; font-weight:700 !important; }
  .cv-print, .cv-print * { color:#11111a; }
  .cv-secao, .cv-secao * { color:#fff !important; }
  .cv-print, .cv-print * { break-inside: avoid; page-break-inside: avoid; }
  /* Fonte igual à do PDF (Helvetica), independente das folhas da página. */
  html, body, .cv-print, .cv-print * { font-family: Helvetica, Arial, sans-serif !important; }
  /* A folha é reduzida por zoom para caber em 1 página; a foto compensa esse
     fator para sair sempre em 2,5cm x 3,5cm reais. */
  #cv-escala { --cv-zoom: 1; }
  /* Posicionamento da foto no topo direito da faixa, sem depender do Tailwind. */
  .cv-print header { position: relative !important; }
  .cv-foto {
    position: absolute !important;
    top: 0 !important;
    right: 0 !important;
    left: auto !important;
    width: calc(2.5cm / var(--cv-zoom)) !important;
    height: calc(3.5cm / var(--cv-zoom)) !important;
    object-fit: cover !important;
    border: 1px solid #1a1a5e !important;
  }
  .cv-header-com-foto { padding-right: calc(2.7cm / var(--cv-zoom)) !important; }

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
    wrapper.style.setProperty("--cv-zoom", String(fator));
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


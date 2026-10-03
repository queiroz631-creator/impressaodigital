import type { Formato, ItemGaleria, PapelFoto, TextoFoto } from "../types";

export type OrientacaoPapel = "AUTOMATICA" | "RETRATO" | "PAISAGEM";
export type ConfiguracaoMontagem = {
  papelId: string; papelNome: string; larguraMm: number; alturaMm: number; orientacao: OrientacaoPapel;
  orientacaoFotos: OrientacaoPapel;
  margemSuperiorMm: number; margemInferiorMm: number; margemEsquerdaMm: number; margemDireitaMm: number;
  espacamentoMm: number; permitirRotacao: boolean;
};
export type OcorrenciaMontagem = { itemId: string; indiceCopia: number; xMm: number; yMm: number; larguraMm: number; alturaMm: number; rotacaoFolha: 0 | 90 };
export type FolhaMontagem = { numero: number; larguraMm: number; alturaMm: number; ocorrencias: OcorrenciaMontagem[]; papelId?: string; papelNome?: string };
export type PlanoMontagem = { folhas: FolhaMontagem[]; orientacaoEscolhida: Exclude<OrientacaoPapel, "AUTOMATICA">; areaUtilMm2: number; areaOcupadaMm2: number; aproveitamento: number };

export const cmParaMm = (cm: number) => cm * 10;
export const mmParaPixels = (mm: number, dpi: number) => mm / 25.4 * dpi;

type Peca = { itemId: string; indiceCopia: number; largura: number; altura: number; rotacaoBase: 0 | 90 };
type RetanguloLivre = { x: number; y: number; largura: number; altura: number };
type FolhaEmMontagem = FolhaMontagem & { livres: RetanguloLivre[] };
type CriterioEncaixe = "LADO_CURTO" | "LADO_LONGO" | "AREA" | "CANTO";
type CriterioOrdem = "AREA" | "LADO_LONGO" | "LARGURA" | "ALTURA" | "PROPORCAO" | "ALTERNADA";
type PreferenciaRotacao = "ORIGINAL" | "GIRADA" | "MAIOR_HORIZONTAL" | "MAIOR_VERTICAL" | "ALTERNADA";

function pecasDosItens(itens: ItemGaleria[], orientacaoFotos: OrientacaoPapel): Peca[] {
  return itens.flatMap((item) => {
    const larguraNatural = cmParaMm(Number(item.largura_personalizada_cm ?? item.formato?.largura_cm ?? 0));
    const alturaNatural = cmParaMm(Number(item.altura_personalizada_cm ?? item.formato?.altura_cm ?? 0));
    const paisagem = orientacaoFotos === "PAISAGEM" || (orientacaoFotos === "AUTOMATICA" && (item.orientacao === "PAISAGEM" || (item.orientacao === "AUTOMATICA" && item.arquivo.largura_px >= item.arquivo.altura_px)));
    const naturalPaisagem = larguraNatural > alturaNatural;
    const rotacaoBase = naturalPaisagem === paisagem ? 0 as const : 90 as const;
    const dimensoes = rotacaoBase === 90
      ? { largura: alturaNatural, altura: larguraNatural }
      : { largura: larguraNatural, altura: alturaNatural };
    return Array.from({ length: Math.max(0, item.quantidade) }, (_, i) => ({ itemId: item.id, indiceCopia: i + 1, rotacaoBase, ...dimensoes }));
  }).sort((a, b) => b.largura * b.altura - a.largura * a.altura || b.altura - a.altura || a.itemId.localeCompare(b.itemId) || a.indiceCopia - b.indiceCopia);
}

function sobrepoe(a: RetanguloLivre, b: RetanguloLivre) {
  return a.x < b.x + b.largura - 1e-6 && a.x + a.largura > b.x + 1e-6 && a.y < b.y + b.altura - 1e-6 && a.y + a.altura > b.y + 1e-6;
}

function contido(a: RetanguloLivre, b: RetanguloLivre) {
  return a.x >= b.x - 1e-6 && a.y >= b.y - 1e-6 && a.x + a.largura <= b.x + b.largura + 1e-6 && a.y + a.altura <= b.y + b.altura + 1e-6;
}

function atualizarLivres(livres: RetanguloLivre[], ocupado: RetanguloLivre) {
  const divididos: RetanguloLivre[] = [];
  for (const livre of livres) {
    if (!sobrepoe(livre, ocupado)) { divididos.push(livre); continue; }
    if (ocupado.x > livre.x + 1e-6) divididos.push({ x: livre.x, y: livre.y, largura: ocupado.x - livre.x, altura: livre.altura });
    if (ocupado.x + ocupado.largura < livre.x + livre.largura - 1e-6) divididos.push({ x: ocupado.x + ocupado.largura, y: livre.y, largura: livre.x + livre.largura - ocupado.x - ocupado.largura, altura: livre.altura });
    if (ocupado.y > livre.y + 1e-6) divididos.push({ x: livre.x, y: livre.y, largura: livre.largura, altura: ocupado.y - livre.y });
    if (ocupado.y + ocupado.altura < livre.y + livre.altura - 1e-6) divididos.push({ x: livre.x, y: ocupado.y + ocupado.altura, largura: livre.largura, altura: livre.y + livre.altura - ocupado.y - ocupado.altura });
  }
  return divididos.filter((livre, indice) => livre.largura > 1e-6 && livre.altura > 1e-6 && !divididos.some((outro, outroIndice) => indice !== outroIndice && contido(livre, outro)));
}

function pontuarEncaixe(livre: RetanguloLivre, largura: number, altura: number, criterio: CriterioEncaixe) {
  const sobraW = livre.largura - largura;
  const sobraH = livre.altura - altura;
  if (criterio === "AREA") return [livre.largura * livre.altura - largura * altura, Math.min(sobraW, sobraH), livre.y, livre.x];
  if (criterio === "LADO_LONGO") return [Math.max(sobraW, sobraH), Math.min(sobraW, sobraH), livre.y, livre.x];
  if (criterio === "CANTO") return [livre.y + altura, livre.x + largura, Math.min(sobraW, sobraH), Math.max(sobraW, sobraH)];
  return [Math.min(sobraW, sobraH), Math.max(sobraW, sobraH), livre.y, livre.x];
}

function compararPontuacao(a: number[], b: number[]) {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diferenca = (a[i] ?? 0) - (b[i] ?? 0);
    if (Math.abs(diferenca) > 1e-6) return diferenca;
  }
  return 0;
}

function ordenarPecas(pecas: Peca[], criterio: CriterioOrdem) {
  return [...pecas].sort((a, b) => {
    if (criterio === "LADO_LONGO") return Math.max(b.largura, b.altura) - Math.max(a.largura, a.altura) || b.largura * b.altura - a.largura * a.altura || a.itemId.localeCompare(b.itemId) || a.indiceCopia - b.indiceCopia;
    if (criterio === "LARGURA") return b.largura - a.largura || b.altura - a.altura || a.itemId.localeCompare(b.itemId) || a.indiceCopia - b.indiceCopia;
    if (criterio === "ALTURA") return b.altura - a.altura || b.largura - a.largura || a.itemId.localeCompare(b.itemId) || a.indiceCopia - b.indiceCopia;
    if (criterio === "PROPORCAO") return Math.max(b.largura / b.altura, b.altura / b.largura) - Math.max(a.largura / a.altura, a.altura / a.largura) || b.largura * b.altura - a.largura * a.altura || a.itemId.localeCompare(b.itemId) || a.indiceCopia - b.indiceCopia;
    if (criterio === "ALTERNADA") {
      const grupoA = a.itemId.charCodeAt(0) + a.indiceCopia; const grupoB = b.itemId.charCodeAt(0) + b.indiceCopia;
      return grupoA % 2 - grupoB % 2 || b.largura * b.altura - a.largura * a.altura || b.altura - a.altura || a.itemId.localeCompare(b.itemId) || a.indiceCopia - b.indiceCopia;
    }
    return b.largura * b.altura - a.largura * a.altura || b.altura - a.altura || a.itemId.localeCompare(b.itemId) || a.indiceCopia - b.indiceCopia;
  });
}

function opcoesDaPeca(peca: Peca, permitirRotacao: boolean, preferencia: PreferenciaRotacao) {
  const original = { w: peca.largura, h: peca.altura, r: peca.rotacaoBase };
  if (!permitirRotacao || Math.abs(peca.largura - peca.altura) < 1e-6) return [original];
  const girada = { w: peca.altura, h: peca.largura, r: (peca.rotacaoBase === 90 ? 0 : 90) as 0 | 90 };
  if (preferencia === "GIRADA") return [girada, original];
  if (preferencia === "MAIOR_HORIZONTAL") return original.w >= original.h ? [original, girada] : [girada, original];
  if (preferencia === "MAIOR_VERTICAL") return original.h >= original.w ? [original, girada] : [girada, original];
  if (preferencia === "ALTERNADA") return peca.indiceCopia % 2 === 0 ? [girada, original] : [original, girada];
  return [original, girada];
}

function montarComCriterio(pecas: Peca[], config: ConfiguracaoMontagem, orientacao: "RETRATO" | "PAISAGEM", criterio: CriterioEncaixe, ordem: CriterioOrdem, preferenciaRotacao: PreferenciaRotacao): PlanoMontagem {
  const larguraFolha = orientacao === "PAISAGEM" ? Math.max(config.larguraMm, config.alturaMm) : Math.min(config.larguraMm, config.alturaMm);
  const alturaFolha = orientacao === "PAISAGEM" ? Math.min(config.larguraMm, config.alturaMm) : Math.max(config.larguraMm, config.alturaMm);
  const utilW = larguraFolha - config.margemEsquerdaMm - config.margemDireitaMm;
  const utilH = alturaFolha - config.margemSuperiorMm - config.margemInferiorMm;
  if (utilW <= 0 || utilH <= 0) throw new Error("As margens eliminam a área útil do papel.");
  const larguraComFolga = utilW + config.espacamentoMm;
  const alturaComFolga = utilH + config.espacamentoMm;
  const folhas: FolhaEmMontagem[] = [];
  for (const peca of ordenarPecas(pecas, ordem)) {
    const opcoes = opcoesDaPeca(peca, config.permitirRotacao, preferenciaRotacao);
    if (!opcoes.some((o) => o.w <= utilW + 1e-6 && o.h <= utilH + 1e-6)) throw new Error(`Uma peça de ${peca.largura} × ${peca.altura} mm não cabe na área útil de ${utilW} × ${utilH} mm.`);
    let melhor: { folha: FolhaEmMontagem; livre: RetanguloLivre; opcao: (typeof opcoes)[number]; pontos: number[] } | null = null;
    for (const folha of folhas) for (const livre of folha.livres) for (const opcao of opcoes) {
      const larguraOcupada = opcao.w + config.espacamentoMm;
      const alturaOcupada = opcao.h + config.espacamentoMm;
      if (larguraOcupada > livre.largura + 1e-6 || alturaOcupada > livre.altura + 1e-6) continue;
      const pontos = pontuarEncaixe(livre, larguraOcupada, alturaOcupada, criterio);
       if (!melhor || compararPontuacao(pontos, melhor.pontos) < 0) melhor = { folha, livre, opcao, pontos };
    }
    if (!melhor) {
      const folha: FolhaEmMontagem = { numero: folhas.length + 1, larguraMm: larguraFolha, alturaMm: alturaFolha, ocorrencias: [], livres: [{ x: 0, y: 0, largura: larguraComFolga, altura: alturaComFolga }] };
      folhas.push(folha);
      for (const livre of folha.livres) for (const opcao of opcoes) {
        const larguraOcupada = opcao.w + config.espacamentoMm;
        const alturaOcupada = opcao.h + config.espacamentoMm;
        if (larguraOcupada > livre.largura + 1e-6 || alturaOcupada > livre.altura + 1e-6) continue;
        const pontos = pontuarEncaixe(livre, larguraOcupada, alturaOcupada, criterio);
         if (!melhor || compararPontuacao(pontos, melhor.pontos) < 0) melhor = { folha, livre, opcao, pontos };
      }
    }
    if (!melhor) throw new Error("Esta foto não cabe na área útil do papel selecionado.");
    const ocupado = { x: melhor.livre.x, y: melhor.livre.y, largura: melhor.opcao.w + config.espacamentoMm, altura: melhor.opcao.h + config.espacamentoMm };
    melhor.folha.ocorrencias.push({ itemId: peca.itemId, indiceCopia: peca.indiceCopia, xMm: round(config.margemEsquerdaMm + ocupado.x), yMm: round(config.margemSuperiorMm + ocupado.y), larguraMm: round(melhor.opcao.w), alturaMm: round(melhor.opcao.h), rotacaoFolha: melhor.opcao.r });
    melhor.folha.livres = atualizarLivres(melhor.folha.livres, ocupado);
  }
  const areaOcupadaMm2 = pecas.reduce((s, p) => s + p.largura * p.altura, 0);
  const areaUtilMm2 = utilW * utilH * folhas.length;
  return { folhas: folhas.map(({ livres: _livres, ...folha }) => folha), orientacaoEscolhida: orientacao, areaUtilMm2: round(areaUtilMm2), areaOcupadaMm2: round(areaOcupadaMm2), aproveitamento: areaUtilMm2 ? round(areaOcupadaMm2 / areaUtilMm2 * 100) : 0 };
}

function montarOrientacao(itens: ItemGaleria[], config: ConfiguracaoMontagem, orientacao: "RETRATO" | "PAISAGEM"): PlanoMontagem {
  const pecas = pecasDosItens(itens, config.orientacaoFotos);
  const resultados: PlanoMontagem[] = [];
  const criterios = ["LADO_CURTO", "LADO_LONGO", "AREA", "CANTO"] as const;
  const ordens = ["AREA", "LADO_LONGO", "LARGURA", "ALTURA", "PROPORCAO", "ALTERNADA"] as const;
  const permitirRotacaoDosFormatos = config.permitirRotacao && config.orientacaoFotos === "AUTOMATICA";
  const preferencias = permitirRotacaoDosFormatos ? ["ORIGINAL", "GIRADA", "MAIOR_HORIZONTAL", "MAIOR_VERTICAL", "ALTERNADA"] as const : ["ORIGINAL"] as const;
  const configEfetiva = { ...config, permitirRotacao: permitirRotacaoDosFormatos };
  for (const criterio of criterios) for (const ordem of ordens) for (const preferencia of preferencias) resultados.push(montarComCriterio(pecas, configEfetiva, orientacao, criterio, ordem, preferencia));
  const melhor = resultados.sort((a, b) => a.folhas.length - b.folhas.length || b.aproveitamento - a.aproveitamento || JSON.stringify(a.folhas).localeCompare(JSON.stringify(b.folhas)))[0];
  if (!melhor) throw new Error("Não foi possível calcular a montagem para este papel.");
  return melhor;
}
const round = (n: number) => Number(n.toFixed(3));

export function montarFolhas(itens: ItemGaleria[], config: ConfiguracaoMontagem): PlanoMontagem {
  if (!itens.length) return { folhas: [], orientacaoEscolhida: "RETRATO", areaUtilMm2: 0, areaOcupadaMm2: 0, aproveitamento: 0 };
  if (config.orientacao !== "AUTOMATICA") return montarOrientacao(itens, config, config.orientacao);
  const resultados: PlanoMontagem[] = [];
  let ultimoErro: unknown;
  for (const orientacao of ["RETRATO", "PAISAGEM"] as const) {
    try { resultados.push(montarOrientacao(itens, config, orientacao)); } catch (erro) { ultimoErro = erro; }
  }
  const melhor = resultados.sort((a, b) => a.folhas.length - b.folhas.length || b.aproveitamento - a.aproveitamento || a.orientacaoEscolhida.localeCompare(b.orientacaoEscolhida))[0];
  if (!melhor) throw ultimoErro instanceof Error ? ultimoErro : new Error("Esta foto não cabe na área útil do papel selecionado.");
  return melhor;
}

export async function assinaturaMontagem(itens: ItemGaleria[], textos: TextoFoto[], config: ConfiguracaoMontagem) {
  const dados = JSON.stringify({ config, itens: itens.map((i) => ({ id: i.id, formato: i.formato_id, largura: i.largura_personalizada_cm, altura: i.altura_personalizada_cm, quantidade: i.quantidade, orientacao: i.orientacao, atualizado: i.atualizado_em, configuracao: i.configuracao, formatoDados: i.formato })), textos: textos.map((t) => ({ id: t.id, item: t.item_id, versao: t.versao, atualizado: t.atualizado_em })) });
  const bytes = new TextEncoder().encode(dados); const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function assinaturaMontagemPorPapeis(itens: ItemGaleria[], textos: TextoFoto[], configs: ConfiguracaoMontagem[]) {
  const dados = JSON.stringify({ configs: [...configs].sort((a, b) => a.papelId.localeCompare(b.papelId)), itens: itens.map((i) => ({ id: i.id, formato: i.formato_id, largura: i.largura_personalizada_cm, altura: i.altura_personalizada_cm, quantidade: i.quantidade, orientacao: i.orientacao, atualizado: i.atualizado_em, configuracao: i.configuracao, formatoDados: i.formato })), textos: textos.map((t) => ({ id: t.id, item: t.item_id, versao: t.versao, atualizado: t.atualizado_em })) });
  const bytes = new TextEncoder().encode(dados); const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function capacidadeEstimadaFormato(formato: Pick<Formato, "largura_cm" | "altura_cm">, papel: PapelFoto) {
  const larguraPeca = cmParaMm(Number(formato.largura_cm)); const alturaPeca = cmParaMm(Number(formato.altura_cm));
  if (larguraPeca <= 0 || alturaPeca <= 0) return 0;
  const orientacoes = papel.orientacao === "AUTOMATICA" ? ["RETRATO", "PAISAGEM"] as const : [papel.orientacao as "RETRATO" | "PAISAGEM"];
  const capacidadeGrade = (larguraFolha: number, alturaFolha: number, largura: number, altura: number) => {
    const utilW = larguraFolha - Number(papel.margem_esquerda_mm) - Number(papel.margem_direita_mm);
    const utilH = alturaFolha - Number(papel.margem_superior_mm) - Number(papel.margem_inferior_mm);
    const espaco = Number(papel.espacamento_mm);
    return Math.max(0, Math.floor((utilW + espaco) / (largura + espaco)) * Math.floor((utilH + espaco) / (altura + espaco)));
  };
  return Math.max(...orientacoes.flatMap((orientacao) => {
    const larguraFolha = orientacao === "PAISAGEM" ? Math.max(Number(papel.largura_mm), Number(papel.altura_mm)) : Math.min(Number(papel.largura_mm), Number(papel.altura_mm));
    const alturaFolha = orientacao === "PAISAGEM" ? Math.min(Number(papel.largura_mm), Number(papel.altura_mm)) : Math.max(Number(papel.largura_mm), Number(papel.altura_mm));
    const normal = capacidadeGrade(larguraFolha, alturaFolha, larguraPeca, alturaPeca);
    return papel.permitir_rotacao ? [normal, capacidadeGrade(larguraFolha, alturaFolha, alturaPeca, larguraPeca)] : [normal];
  }));
}
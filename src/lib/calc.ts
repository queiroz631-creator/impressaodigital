/** Classificação do material / acabamento. */
export type TipoServico = "simples" | "especial";
export type TipoServicoAcabamento = TipoServico | "ambas";

/** Formato do papel utilizado na impressão. */
export type FormatoPapel = "A3" | "A4" | "A5";

export const FORMATOS: { valor: FormatoPapel; rotulo: string }[] = [
  { valor: "A3", rotulo: "Papel A3 (30x40cm)" },
  { valor: "A4", rotulo: "Papel A4 (20x30cm)" },
  { valor: "A5", rotulo: "Papel A5 (15x20cm)" },
];

export const rotuloFormato: Record<FormatoPapel, string> = {
  A3: "Papel A3 (30x40cm)",
  A4: "Papel A4 (20x30cm)",
  A5: "Papel A5 (15x20cm)",
};

export const FORMATO_PADRAO: FormatoPapel = "A4";

export const rotuloTipoServico: Record<TipoServicoAcabamento, string> = {
  simples: "Impressão Simples",
  especial: "Impressão Especial",
  ambas: "Ambas",
};

export interface Material {
  id: string;
  nome: string;
  descricao: string;
  preco_pb: number;
  preco_por_arquivo: number;
  faixas: FaixaPreco[];
  tipo_impressao: TipoServico;
  formato: FormatoPapel;
  ativo: boolean;
  ordem: number;
}

export interface FaixaPreco {
  min: number;
  preco: number;
}

export function normalizarFaixas(valor: unknown): FaixaPreco[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .map((f) => ({ min: Number((f as FaixaPreco)?.min) || 0, preco: Number((f as FaixaPreco)?.preco) || 0 }))
    .filter((f) => f.min > 0)
    .sort((a, b) => a.min - b.min);
}

/**
 * Preço unitário do material. Em cópia manual utiliza somente o preço unitário
 * cadastrado, ignorando as faixas por quantidade.
 */
export function precoPorQuantidade(
  material: Material,
  quantidade: number,
  copiaManual = false,
  usarFaixaCopiaManual = false,
) {
  const base = Number(material.preco_pb) || 0;
  // Cópia manual sem faixa: usa somente o preço base
  if (copiaManual && !usarFaixaCopiaManual) {
    return base;
  }
  let preco = base;
  for (const f of normalizarFaixas(material.faixas)) if (quantidade >= f.min) preco = f.preco;
  return preco;
}

/** Preço unitário de um acabamento considerando as faixas por quantidade. */
export function precoAcabamento(acabamento: Acabamento, quantidade: number) {
  const base = Number(acabamento.valor) || 0;
  const faixas = normalizarFaixas(acabamento.faixas);
  let preco = base;
  for (const f of faixas) if (quantidade >= f.min) preco = f.preco;
  return preco;
}

export function faixasParaTexto(faixas: FaixaPreco[]) {
  return normalizarFaixas(faixas)
    .map(
      (f) =>
        `${f.min} = ${f.preco.toLocaleString("pt-BR", {
          useGrouping: false,
          maximumFractionDigits: 10,
        })}`,
    )
    .join("\n");
}

function parsePreco(valor: string) {
  const texto = valor.trim();
  if (texto.includes(",")) {
    // vírgula é o separador decimal; pontos são separadores de milhar
    return Number(texto.replace(/\./g, "").replace(",", "."));
  }
  return Number(texto);
}

export function textoParaFaixas(texto: string): FaixaPreco[] {
  return normalizarFaixas(
    texto
      .split(/[\n;]+/)
      .map((linha) => linha.trim())
      .filter(Boolean)
      .map((linha) => {
        const partes = linha.split(/[=:\t]|\s{2,}|,(?=\s)/).map((p) => p.trim());
        const min = Number(String(partes[0] ?? "").replace(/\D/g, ""));
        const preco = parsePreco(String(partes[1] ?? ""));
        return { min, preco };
      }),
  );
}

export interface LinhaCalculo {
  material: Material;
  valorUnitario: number;
  paginas: number;
  totalPaginas: number;
  totalArquivos: number;
  total: number;
}

export interface EntradaCalculo {
  paginasTotal: number;
  arquivos?: number;
  /** Filtra os materiais pelo tipo de impressão. */
  tipoServico?: TipoServico;
  /** Filtra os materiais pelo formato do papel. */
  formato?: FormatoPapel;
  /** Cópia manual: cobra somente por página, com o preço unitário cadastrado. */
  copiaManual?: boolean;
  // Quando true, utiliza as faixas de quantidade mesmo na cópia manual
  usarFaixaCopiaManual?: boolean;
}

export function calcularLinhas(materiais: Material[], entrada: EntradaCalculo): LinhaCalculo[] {
  return materiais
    .filter((m) => m.ativo)
    .filter((m) => !entrada.tipoServico || (m.tipo_impressao ?? "simples") === entrada.tipoServico)
    .filter((m) => !entrada.formato || (m.formato ?? "A4") === entrada.formato)
    .sort((a, b) => a.ordem - b.ordem)
    .map((material) => {
      const preco = precoPorQuantidade(
        material,
        entrada.paginasTotal,
        entrada.copiaManual,
        entrada.usarFaixaCopiaManual,
      );
      const paginas = entrada.paginasTotal;
      const totalPaginas = paginas * preco;
      const totalArquivos = entrada.copiaManual
        ? 0
        : (entrada.arquivos ?? 0) * (Number(material.preco_por_arquivo) || 0);
      const total = totalPaginas + totalArquivos;
      return {
        material,
        valorUnitario: preco,
        paginas,
        totalPaginas,
        totalArquivos,
        total,
      };
    });
}

export function resumoLinhas(linhas: LinhaCalculo[]) {
  const ordenadas = [...linhas].sort((a, b) => a.total - b.total);
  const menor = ordenadas[0];
  const maior = ordenadas[ordenadas.length - 1];
  if (!menor || !maior) return null;
  const media = linhas.reduce((acc, l) => acc + l.total, 0) / linhas.length;
  return { menor, maior, media };
}

// ---------- Acabamentos ----------

export type CobrancaAcabamento = "quantidade" | "bloco" | "pagina" | "fixo";

export interface Acabamento {
  id: string;
  nome: string;
  cobranca: CobrancaAcabamento;
  valor: number;
  paginas_bloco: number;
  faixas: FaixaPreco[];
  tipo_impressao: TipoServicoAcabamento;
  mostrar_nao_incluso: boolean;
  mostrar_no_orcamento: boolean;
  ativo: boolean;
  ordem: number;
}

export interface SelecaoAcabamento {
  ativo: boolean;
  quantidade: number;
}

export interface LinhaAcabamento {
  acabamento: Acabamento;
  quantidade: number;
  valorUnitario: number;
  total: number;
}

export function calcularAcabamentos(
  acabamentos: Acabamento[],
  selecao: Record<string, SelecaoAcabamento>,
  ctx: { paginas: number },
): LinhaAcabamento[] {
  return acabamentos
    .filter((a) => a.ativo && selecao[a.id]?.ativo)
    .map((a) => {
      const qtdInformada = Math.max(0, Number(selecao[a.id]?.quantidade) || 0);
      const bloco = Math.max(1, Number(a.paginas_bloco) || 1);
      let quantidade = 1;
      if (a.cobranca === "quantidade") quantidade = qtdInformada;
      else if (a.cobranca === "bloco") quantidade = Math.ceil(ctx.paginas / bloco);
      else if (a.cobranca === "pagina") quantidade = ctx.paginas;
      const valor = precoAcabamento(a, quantidade);
      return { acabamento: a, quantidade, valorUnitario: valor, total: quantidade * valor };
    });
}

/** Acabamentos visíveis para o tipo de impressão selecionado. */
export function acabamentosDoTipo(acabamentos: Acabamento[], tipo?: TipoServico) {
  if (!tipo) return acabamentos;
  return acabamentos.filter((a) => {
    const t = a.tipo_impressao ?? "ambas";
    return t === "ambas" || t === tipo;
  });
}

export function totalAcabamentos(linhas: LinhaAcabamento[]) {
  return linhas.reduce((acc, l) => acc + l.total, 0);
}

export const rotuloCobranca: Record<CobrancaAcabamento, string> = {
  quantidade: "Por unidade",
  bloco: "Por bloco de páginas",
  pagina: "Por página",
  fixo: "Valor fixo",
};

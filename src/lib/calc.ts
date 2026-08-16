export type TipoImpressao = "pb" | "color" | "ambas";

/** Cor da impressão selecionada na calculadora. */
export type CorImpressao = "pb" | "color";
/** Classificação do material / acabamento. */
export type TipoServico = "simples" | "especial";
export type TipoServicoAcabamento = TipoServico | "ambas";

export const rotuloCor: Record<CorImpressao, string> = {
  pb: "Preto e Branco",
  color: "Colorido",
};

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
  preco_color: number;
  preco_por_arquivo: number;
  faixas: FaixaPreco[];
  tipo_impressao: TipoServico;
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

export function precoPorQuantidade(
  material: Material,
  quantidade: number,
  cor: CorImpressao = "pb",
) {
  const base = Number(cor === "color" ? material.preco_color : material.preco_pb) || 0;
  const faixas = normalizarFaixas(material.faixas);
  let preco = base;
  if (cor === "pb") {
    for (const f of faixas) if (quantidade >= f.min) preco = f.preco;
  }
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
  valorUnitarioPb: number;
  valorUnitarioColor: number;
  paginasPb: number;
  paginasColor: number;
  totalPb: number;
  totalColor: number;
  totalArquivos: number;
  total: number;
}

export interface EntradaCalculo {
  tipo: TipoImpressao;
  paginasTotal: number;
  paginasPb: number;
  paginasColor: number;
  arquivos?: number;
  /** Cor selecionada; quando informada, define qual preço será usado. */
  cor?: CorImpressao;
  /** Filtra os materiais pelo tipo de impressão. */
  tipoServico?: TipoServico;
  /** Cópia manual: cobra somente por página, ignorando o valor por arquivo. */
  copiaManual?: boolean;
}

export function paginasEfetivas(entrada: EntradaCalculo) {
  if (entrada.tipo === "pb") return { pb: entrada.paginasTotal, color: 0 };
  if (entrada.tipo === "color") return { pb: 0, color: entrada.paginasTotal };
  return { pb: entrada.paginasPb, color: entrada.paginasColor };
}

export function calcularLinhas(materiais: Material[], entrada: EntradaCalculo): LinhaCalculo[] {
  const cor: CorImpressao = entrada.cor ?? (entrada.tipo === "color" ? "color" : "pb");
  const pb = cor === "pb" ? entrada.paginasTotal : 0;
  const color = cor === "color" ? entrada.paginasTotal : 0;
  return materiais
    .filter((m) => m.ativo)
    .filter((m) => !entrada.tipoServico || (m.tipo_impressao ?? "simples") === entrada.tipoServico)
    .sort((a, b) => a.ordem - b.ordem)
    .map((material) => {
      const precoPb = precoPorQuantidade(material, entrada.paginasTotal, "pb");
      const precoColor = precoPorQuantidade(material, entrada.paginasTotal, "color");
      const totalPb = pb * precoPb;
      const totalColor = color * precoColor;
      const paginas = pb + color;
      const totalArquivos = entrada.copiaManual
        ? 0
        : (entrada.arquivos ?? 0) * (Number(material.preco_por_arquivo) || 0);
      const total = totalPb + totalColor + totalArquivos;
      return {
        material,
        valorUnitario: paginas > 0 ? total / paginas : cor === "color" ? precoColor : precoPb,
        valorUnitarioPb: precoPb,
        valorUnitarioColor: precoColor,
        paginasPb: pb,
        paginasColor: color,
        totalPb,
        totalColor,
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
      const valor = Number(a.valor) || 0;
      const qtdInformada = Math.max(0, Number(selecao[a.id]?.quantidade) || 0);
      const bloco = Math.max(1, Number(a.paginas_bloco) || 1);
      let quantidade = 1;
      if (a.cobranca === "quantidade") quantidade = qtdInformada;
      else if (a.cobranca === "bloco") quantidade = Math.ceil(ctx.paginas / bloco);
      else if (a.cobranca === "pagina") quantidade = ctx.paginas;
      return { acabamento: a, quantidade, total: quantidade * valor };
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

export const TAMANHOS = ["A4", "A5", "A6", "Outro"] as const;

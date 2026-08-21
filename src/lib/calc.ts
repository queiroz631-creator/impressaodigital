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

  /** Preço base por página. */
  preco_pb: number;

  /** Preço base por arquivo, utilizado quando não houver faixa. */
  preco_por_arquivo: number;

  /** Faixas de preço por quantidade de páginas. */
  faixas: FaixaPreco[];

  /** Faixas de preço por quantidade TOTAL de arquivos. */
  faixas_por_arquivo: FaixaPreco[];

  /** Faixas de preço por quantidade de CÓPIAS ADICIONAIS. */
  faixas_por_copia_adicional: FaixaPreco[];


  /**
   * Quantidade inicial de arquivos que utiliza o preço fixo.
   *
   * Exemplo:
   * quantidade_arquivos_fixo = 3
   */
  quantidade_arquivos_fixo: number;

  /**
   * Valor de cada um dos arquivos dentro da quantidade fixa.
   *
   * Exemplo:
   * preco_arquivos_fixo = 2.00
   */
  preco_arquivos_fixo: number;

  tipo_impressao: TipoServico;
  formato: FormatoPapel;
  ativo: boolean;
  ordem: number;
}

export interface FaixaPreco {
  min: number;
  preco: number;
}

/**
 * Normaliza as faixas de preço.
 *
 * Exemplo:
 *
 * [
 *   { min: 11, preco: 0.80 },
 *   { min: 1, preco: 1.00 }
 * ]
 *
 * vira:
 *
 * [
 *   { min: 1, preco: 1.00 },
 *   { min: 11, preco: 0.80 }
 * ]
 */
export function normalizarFaixas(valor: unknown): FaixaPreco[] {
  if (!Array.isArray(valor)) return [];

  return valor
    .map((f) => ({
      min: Number((f as FaixaPreco)?.min) || 0,
      preco: Number((f as FaixaPreco)?.preco) || 0,
    }))
    .filter((f) => f.min > 0)
    .sort((a, b) => a.min - b.min);
}

/**
 * Preço unitário das páginas.
 *
 * Em cópia manual:
 * - se usarFaixaCopiaManual = false:
 *   utiliza somente preco_pb;
 *
 * - se usarFaixaCopiaManual = true:
 *   utiliza as faixas por páginas.
 */
export function precoPorQuantidade(
  material: Material,
  quantidade: number,
  copiaManual = false,
  usarFaixaCopiaManual = false,
) {
  const base = Number(material.preco_pb) || 0;

  // Cópia manual sem utilização das faixas.
  if (copiaManual && !usarFaixaCopiaManual) {
    return base;
  }

  let preco = base;

  for (const f of normalizarFaixas(material.faixas)) {
    if (quantidade >= f.min) {
      preco = f.preco;
    }
  }

  return preco;
}

/**
 * Retorna o preço aplicável aos arquivos excedentes.
 *
 * IMPORTANTE:
 * A quantidade usada para determinar a faixa é a quantidade
 * TOTAL de arquivos.
 *
 * Exemplo:
 *
 * Quantidade fixa: 3
 *
 * Faixas:
 * 4 = 1,00
 * 11 = 0,80
 * 21 = 0,70
 *
 * 5 arquivos:
 * - 3 primeiros = preço fixo
 * - 2 excedentes = faixa de 4 arquivos = R$ 1,00
 *
 * 11 arquivos:
 * - 3 primeiros = preço fixo
 * - 8 excedentes = faixa de 11 arquivos = R$ 0,80
 */
export function precoPorQuantidadeArquivos(material: Material, quantidade: number) {
  const base = Number(material.preco_por_arquivo) || 0;

  const faixas = normalizarFaixas(material.faixas_por_arquivo);

  let preco = base;

  /**
   * A faixa é baseada na quantidade TOTAL de arquivos.
   */
  for (const f of faixas) {
    if (quantidade >= f.min) {
      preco = f.preco;
    }
  }

  return preco;
}

/**
 * Preço unitário das CÓPIAS ADICIONAIS.
 *
 * A faixa considera somente a quantidade de cópias adicionais
 * (não o total de cópias).
 *
 * Se o material não possuir faixas por cópia adicional,
 * retorna `precoPadrao` (o preço unitário de página já calculado),
 * mantendo o comportamento anterior.
 */
export function precoPorCopiasAdicionais(
  material: Material,
  copiasAdicionais: number,
  precoPadrao: number,
) {
  const faixas = normalizarFaixas(material.faixas_por_copia_adicional);

  if (faixas.length === 0) {
    return precoPadrao;
  }

  let preco = precoPadrao;

  for (const f of faixas) {
    if (copiasAdicionais >= f.min) {
      preco = f.preco;
    }
  }

  return preco;
}



/**
 * Calcula o valor dos arquivos considerando:
 *
 * 1. Quantidade fixa de arquivos
 * 2. Preço fixo desses arquivos
 * 3. Arquivos excedentes utilizando a faixa correspondente
 *
 * Exemplo:
 *
 * Quantidade fixa = 3
 * Preço fixo = R$ 2,00
 *
 * Faixas:
 * 4 = R$ 1,00
 * 11 = R$ 0,80
 * 21 = R$ 0,70
 *
 * 5 arquivos:
 *
 * 3 × 2,00 = 6,00
 * 2 × 1,00 = 2,00
 *
 * Total = R$ 8,00
 */
export function calcularValorArquivos(material: Material, quantidadeArquivos: number) {
  const quantidade = Math.max(0, Number(quantidadeArquivos) || 0);

  if (quantidade === 0) {
    return 0;
  }

  /**
   * Quantidade de arquivos que receberão
   * o preço fixo.
   */
  const quantidadeFixa = Math.max(0, Number(material.quantidade_arquivos_fixo) || 0);

  /**
   * Valor de cada arquivo dentro
   * da quantidade fixa.
   */
  const precoFixo = Number(material.preco_arquivos_fixo) || 0;

  /**
   * Quantos arquivos realmente recebem
   * o preço fixo.
   *
   * Exemplo:
   *
   * quantidade = 2
   * quantidadeFixa = 3
   *
   * resultado = 2
   */
  const quantidadeComPrecoFixo = Math.min(quantidade, quantidadeFixa);

  /**
   * Valor dos arquivos fixos.
   */
  const valorFixo = quantidadeComPrecoFixo * precoFixo;

  /**
   * Quantidade que ultrapassou
   * os arquivos fixos.
   */
  const quantidadeExcedente = Math.max(0, quantidade - quantidadeFixa);

  /**
   * Se não houver excedentes,
   * retorna somente o valor fixo.
   */
  if (quantidadeExcedente === 0) {
    return valorFixo;
  }

  /**
   * Busca a faixa utilizando a
   * QUANTIDADE TOTAL de arquivos.
   */
  const precoFaixa = precoPorQuantidadeArquivos(material, quantidade);

  /**
   * Calcula somente os arquivos
   * que ultrapassaram a quantidade fixa.
   */
  const valorExcedente = quantidadeExcedente * precoFaixa;

  return valorFixo + valorExcedente;
}

/** Preço unitário de um acabamento considerando as faixas por quantidade. */
export function precoAcabamento(acabamento: Acabamento, quantidade: number) {
  const base = Number(acabamento.valor) || 0;

  const faixas = normalizarFaixas(acabamento.faixas);

  let preco = base;

  for (const f of faixas) {
    if (quantidade >= f.min) {
      preco = f.preco;
    }
  }

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
    // Vírgula é o separador decimal.
    // Pontos são considerados separadores de milhar.
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

        return {
          min,
          preco,
        };
      }),
  );
}

export interface LinhaCalculo {
  material: Material;

  /** Preço unitário das páginas. */
  valorUnitario: number;

  /** Quantidade de páginas adicionais. */
  paginas: number;

  /**
   * Quantidade utilizada para determinar
   * a faixa de preço das páginas.
   */
  totalPaginas: number;

  /** Valor total cobrado pelos arquivos. */
  totalArquivos: number;

  /** Valor das páginas adicionais. */
  totalPaginasAdicionais: number;

  /** Valor das cópias adicionais. */
  totalCopiasAdicionais: number;

  /** Total geral do material. */
  total: number;
}

export interface EntradaCalculo {
  /**
   * Páginas que excedem 1 página por arquivo.
   */
  paginasAdicionais: number;

  /**
   * Quantidade de arquivos.
   */
  arquivos?: number;

  /**
   * Quantidade de cópias adicionais.
   */
  copiasAdicionais?: number;

  /** Filtra os materiais pelo tipo de impressão. */
  tipoServico?: TipoServico;

  /** Filtra os materiais pelo formato do papel. */
  formato?: FormatoPapel;

  /**
   * Cópia manual:
   * cobra somente por página.
   */
  copiaManual?: boolean;

  /**
   * Quando true:
   * utiliza as faixas de quantidade
   * mesmo na cópia manual.
   */
  usarFaixaCopiaManual?: boolean;
}

/**
 * Calcula todas as linhas de preço.
 *
 * O total é composto por:
 *
 * valor dos arquivos
 * +
 * valor das páginas adicionais
 * +
 * valor das cópias adicionais
 */
export function calcularLinhas(materiais: Material[], entrada: EntradaCalculo): LinhaCalculo[] {
  return materiais
    .filter((m) => m.ativo)

    .filter((m) => !entrada.tipoServico || (m.tipo_impressao ?? "simples") === entrada.tipoServico)

    .filter((m) => !entrada.formato || (m.formato ?? "A4") === entrada.formato)

    .sort((a, b) => a.ordem - b.ordem)

    .map((material) => {
      const paginasAdicionais = Math.max(0, Number(entrada.paginasAdicionais) || 0);

      const copiasAdicionais = Math.max(0, Number(entrada.copiasAdicionais) || 0);

      const quantidadeArquivos = Math.max(0, Number(entrada.arquivos) || 0);

      /**
       * Na cópia manual cada arquivo
       * equivale a uma página.
       *
       * No cálculo normal, somente as
       * páginas adicionais e cópias
       * adicionais entram nesse cálculo.
       */
      const quantidadeParaFaixa = paginasAdicionais + copiasAdicionais + (entrada.copiaManual ? quantidadeArquivos : 0);

      /**
       * Preço das páginas.
       */
      const preco = precoPorQuantidade(
        material,
        quantidadeParaFaixa,
        entrada.copiaManual,
        entrada.usarFaixaCopiaManual,
      );

      /**
       * Valor das páginas adicionais.
       */
      const totalPaginasAdicionais = paginasAdicionais * preco;

      /**
       * Valor das cópias adicionais.
       *
       * Usa as faixas por cópias adicionais quando cadastradas
       * (baseadas somente nas cópias adicionais); caso contrário
       * mantém o preço unitário de página.
       */
      const precoCopia = entrada.copiaManual
        ? preco
        : precoPorCopiasAdicionais(material, copiasAdicionais, preco);

      const totalCopiasAdicionais = copiasAdicionais * precoCopia;


      /**
       * ================================
       * VALOR DOS ARQUIVOS
       * ================================
       *
       * Cópia manual:
       * cada arquivo é cobrado como página.
       *
       * Cálculo normal:
       * utiliza quantidade fixa + excedentes.
       */
      const totalArquivos = entrada.copiaManual
        ? quantidadeArquivos * preco
        : calcularValorArquivos(material, quantidadeArquivos);

      /**
       * TOTAL DO MATERIAL
       */
      const total = totalArquivos + totalPaginasAdicionais + totalCopiasAdicionais;

      return {
        material,

        valorUnitario: preco,

        paginas: paginasAdicionais,

        totalPaginas: quantidadeParaFaixa,

        totalArquivos,

        totalPaginasAdicionais,

        totalCopiasAdicionais,

        total,
      };
    });
}

export function resumoLinhas(linhas: LinhaCalculo[]) {
  const ordenadas = [...linhas].sort((a, b) => a.total - b.total);

  const menor = ordenadas[0];

  const maior = ordenadas[ordenadas.length - 1];

  if (!menor || !maior) {
    return null;
  }

  const media = linhas.reduce((acc, l) => acc + l.total, 0) / linhas.length;

  return {
    menor,
    maior,
    media,
  };
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
  ctx: {
    paginas: number;
  },
): LinhaAcabamento[] {
  return acabamentos
    .filter((a) => a.ativo && selecao[a.id]?.ativo)
    .map((a) => {
      const qtdInformada = Math.max(0, Number(selecao[a.id]?.quantidade) || 0);

      const bloco = Math.max(1, Number(a.paginas_bloco) || 1);

      let quantidade = 1;

      if (a.cobranca === "quantidade") {
        quantidade = qtdInformada;
      } else if (a.cobranca === "bloco") {
        quantidade = Math.ceil(ctx.paginas / bloco);
      } else if (a.cobranca === "pagina") {
        quantidade = ctx.paginas;
      }

      const valor = precoAcabamento(a, quantidade);

      return {
        acabamento: a,
        quantidade,
        valorUnitario: valor,
        total: quantidade * valor,
      };
    });
}

/** Acabamentos visíveis para o tipo de impressão selecionado. */
export function acabamentosDoTipo(acabamentos: Acabamento[], tipo?: TipoServico) {
  if (!tipo) {
    return acabamentos;
  }

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

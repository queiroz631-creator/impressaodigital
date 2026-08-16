import type { DadosDocumento, ItemDoc, ArquivoDoc, AcabamentoDoc } from "./documento";

export interface ConfigEmpresa {
  empresa_nome?: string | null;
  telefone?: string | null;
  email?: string | null;
  endereco?: string | null;
  rodape_orcamento?: string | null;
}

type Row = Record<string, unknown>;

const RODAPE_PADRAO = "Orçamento gerado pelo sistema de Calculadora de Impressão Digital.";

function lerArquivos(valor: unknown): ArquivoDoc[] {
  if (!Array.isArray(valor)) return [];
  return valor.map((a) => {
    const o = a as Row;
    return {
      nome: String(o["nome"] ?? "-"),
      tipo: String(o["tipo"] ?? "-"),
      paginas: Number(o["paginas"] ?? 0),
    };
  });
}

function lerAcabamentos(valor: unknown): AcabamentoDoc[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .map((a) => {
      if (typeof a === "string") {
        return { nome: a, quantidade: 1, total: 0, incluso: true };
      }
      const o = a as Row;
      return {
        nome: String(o["nome"] ?? "-"),
        quantidade: Number(o["quantidade"] ?? 1),
        total: Number(o["total"] ?? 0),
        incluso: o["incluso"] !== false,
      };
    })
    .filter((a) => a.nome !== "-");
}

export function itemDeOrcamento(row: Row, indice: number): ItemDoc {
  const arquivos = lerArquivos(row["arquivos"]);
  const paginas = Number(row["paginas_total"] ?? 0) ||
    arquivos.reduce((acc, a) => acc + a.paginas, 0);
  return {
    titulo: `Orçamento ${String(indice + 1).padStart(2, "0")}`,
    material: String(row["material_nome"] ?? "-"),
    cor: row["cor_impressao"] === "color" ? "Colorido" : "Preto e Branco",
    tipoImpressao:
      row["tipo_impressao"] === "especial" ? "Impressão Especial" : "Impressão Simples",
    tamanho: (row["tamanho"] as string | null) ?? null,
    frenteVerso: Boolean(row["frente_verso"]),
    copiaManual: Boolean(row["copia_manual"]),
    arquivos,
    quantidadeArquivos: Number(row["quantidade_arquivos"] ?? arquivos.length),
    paginasTotal: paginas,
    acabamentos: lerAcabamentos(row["acabamentos"]),
    total: Number(row["valor_total"] ?? 0),
  };
}

/** Monta o documento (PDF/imagem) a partir de um ou mais orçamentos salvos. */
export function documentoDeOrcamentos(
  rows: Row[],
  config: ConfigEmpresa | null | undefined,
  extra: {
    numero: string;
    data: string;
    clienteNome: string;
    clienteTelefone?: string | null;
    validade?: string | null;
    observacao?: string | null;
  },
): DadosDocumento {
  const itens = rows.map((r, i) => itemDeOrcamento(r, i));
  return {
    numero: extra.numero,
    data: extra.data,
    empresaNome: config?.empresa_nome ?? "Impressão Digital",
    empresaTelefone: config?.telefone ?? null,
    empresaEmail: config?.email ?? null,
    empresaEndereco: config?.endereco ?? null,
    rodape: config?.rodape_orcamento ?? RODAPE_PADRAO,
    clienteNome: extra.clienteNome,
    clienteTelefone: extra.clienteTelefone ?? null,
    validade: extra.validade ?? null,
    observacao: extra.observacao ?? null,
    itens,
    total: itens.reduce((acc, i) => acc + i.total, 0),
  };
}
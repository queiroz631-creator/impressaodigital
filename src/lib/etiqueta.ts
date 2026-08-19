import type { AcabamentoDoc } from "./documento";

export interface ResumoEtiqueta {
  linhas: string[];
  arquivos: number;
  paginasAdicionais: number;
  copiasAdicionais: number;
  /** Total de páginas cobradas: 1 por arquivo + adicionais + cópias adicionais. */
  paginasTotal: number;
  acabamentos: string[];
}

const n = (v: unknown) => {
  const numero = Number(v ?? 0);
  return Number.isFinite(numero) ? numero : 0;
};

/**
 * Gera a descrição resumida do pedido para a etiqueta térmica,
 * a partir dos itens (registros da tabela "orcamentos") agrupados pelo pedido.
 */
export function resumoDoPedido(itens: Record<string, unknown>[]): ResumoEtiqueta {
  let arquivos = 0;
  let paginasAdicionais = 0;
  let copiasAdicionais = 0;
  const acabamentos = new Set<string>();
  const linhas: string[] = [];

  for (const item of itens) {
    const qtdArquivos = n(item["quantidade_arquivos"]);
    const adicionais = n(item["paginas_adicionais"]);
    const copias = n(item["copias_adicionais"]);

    arquivos += qtdArquivos;
    paginasAdicionais += adicionais;
    copiasAdicionais += copias;

    const lista = Array.isArray(item["acabamentos"]) ? (item["acabamentos"] as AcabamentoDoc[]) : [];
    for (const a of lista) {
      if (a && a.incluso !== false && a.nome) acabamentos.add(a.nome);
    }

    const partes = [
      String(item["tamanho"] ?? "").trim() || "-",
      String(item["material_nome"] ?? "").trim() || "Impressão",
    ];
    const detalhes = [
      qtdArquivos > 0 ? `${qtdArquivos} arquivo(s)` : "",
      adicionais > 0 ? `${adicionais} pág. adicionais` : "",
      copias > 0 ? `${copias} cópia(s) adicionais` : "",
      item["frente_verso"] ? "frente e verso" : "",
    ].filter(Boolean);

    linhas.push(`${partes.join(" - ")}${detalhes.length ? ` (${detalhes.join(", ")})` : ""}`);
  }

  return {
    linhas,
    arquivos,
    paginasAdicionais,
    copiasAdicionais,
    paginasTotal: arquivos + paginasAdicionais + copiasAdicionais,
    acabamentos: Array.from(acabamentos),
  };
}
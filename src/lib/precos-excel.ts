/**
 * Exportação e importação em Excel das configurações de preço
 * (materiais e acabamentos), com faixas em texto e vírgula decimal.
 */
import * as XLSX from "xlsx";
import { faixasParaTexto, textoParaFaixas, type Material, type Acabamento, type FaixaPreco } from "@/lib/calc";

/** Converte número para o padrão brasileiro (vírgula decimal). */
function numeroBR(valor: number) {
  return Number(valor || 0).toLocaleString("pt-BR", { useGrouping: false, maximumFractionDigits: 10 });
}

/** Lê um número aceitando vírgula ou ponto decimal. */
function lerNumero(valor: unknown): number {
  if (typeof valor === "number") return valor;
  const texto = String(valor ?? "").trim();
  if (!texto) return 0;
  const limpo = texto.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

function lerInteiro(valor: unknown): number {
  return Math.trunc(lerNumero(valor));
}

function lerBooleano(valor: unknown): boolean {
  const texto = String(valor ?? "").trim().toLowerCase();
  return ["sim", "s", "true", "1", "verdadeiro", "x"].includes(texto);
}

function boolBR(valor: boolean) {
  return valor ? "Sim" : "Não";
}

/** Faixas em uma célula: "500 = 0,08; 1000 = 0,06". */
function faixasCelula(faixas: FaixaPreco[] | null | undefined) {
  return faixasParaTexto(faixas ?? []).split("\n").filter(Boolean).join("; ");
}

function baixar(wb: XLSX.WorkBook, nome: string) {
  XLSX.writeFile(wb, nome);
}

// ---------------- MATERIAIS ----------------

export function exportarMateriais(materiais: Material[]) {
  const linhas = materiais.map((m) => ({
    id: m.id,
    Nome: m.nome,
    Descrição: m.descricao ?? "",
    Categoria: m.categoria,
    "Tipo de impressão": m.tipo_impressao,
    Formato: m.formato,
    "Preço uni": numeroBR(m.preco_pb),
    "Preço por arquivo": numeroBR(m.preco_por_arquivo),
    "Qtd. arquivos fixo": m.quantidade_arquivos_fixo ?? 0,
    "Preço arquivos fixo": numeroBR(m.preco_arquivos_fixo ?? 0),
    "Faixas por página": faixasCelula(m.faixas),
    "Faixas por arquivo": faixasCelula(m.faixas_por_arquivo),
    "Faixas por cópia adicional": faixasCelula(m.faixas_por_copia_adicional),
    Ativo: boolBR(m.ativo),
    Ordem: m.ordem,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), "Materiais");
  baixar(wb, "materiais.xlsx");
}

export interface LinhaImportada<T> {
  registro: T;
  novo: boolean;
}

export interface ResultadoImportacao<T> {
  linhas: LinhaImportada<T>[];
  erros: string[];
}

type MaterialImportado = Omit<Material, "id"> & { id?: string };

export async function lerMateriais(arquivo: File): Promise<ResultadoImportacao<MaterialImportado>> {
  const wb = XLSX.read(await arquivo.arrayBuffer(), { type: "array" });
  const aba = wb.Sheets[wb.SheetNames[0] ?? ""];
  const erros: string[] = [];
  const linhas: LinhaImportada<MaterialImportado>[] = [];
  if (!aba) return { linhas, erros: ["Planilha vazia."] };

  const dados = XLSX.utils.sheet_to_json<Record<string, unknown>>(aba, { defval: "" });
  dados.forEach((linha, i) => {
    const nome = String(linha["Nome"] ?? "").trim();
    if (!nome) {
      erros.push(`Linha ${i + 2}: nome do material vazio.`);
      return;
    }
    const id = String(linha["id"] ?? "").trim();
    linhas.push({
      novo: !id,
      registro: {
        ...(id ? { id } : {}),
        nome,
        descricao: String(linha["Descrição"] ?? "").trim(),
        categoria: (String(linha["Categoria"] ?? "impressao").trim() || "impressao") as Material["categoria"],
        tipo_impressao: (String(linha["Tipo de impressão"] ?? "simples").trim() ||
          "simples") as Material["tipo_impressao"],
        formato: (String(linha["Formato"] ?? "A4").trim() || "A4") as Material["formato"],
        preco_pb: lerNumero(linha["Preço uni"]),
        preco_color: 0,
        preco_por_arquivo: lerNumero(linha["Preço por arquivo"]),
        quantidade_arquivos_fixo: lerInteiro(linha["Qtd. arquivos fixo"]),
        preco_arquivos_fixo: lerNumero(linha["Preço arquivos fixo"]),
        faixas: textoParaFaixas(String(linha["Faixas por página"] ?? "")),
        faixas_por_arquivo: textoParaFaixas(String(linha["Faixas por arquivo"] ?? "")),
        faixas_por_copia_adicional: textoParaFaixas(String(linha["Faixas por cópia adicional"] ?? "")),
        ativo: lerBooleano(linha["Ativo"]),
        ordem: lerInteiro(linha["Ordem"]),
      } as MaterialImportado,
    });
  });

  return { linhas, erros };
}

// ---------------- ACABAMENTOS ----------------

export function exportarAcabamentos(acabamentos: Acabamento[]) {
  const linhas = acabamentos.map((a) => ({
    id: a.id,
    Nome: a.nome,
    "Tipo de impressão": a.tipo_impressao,
    Cobrança: a.cobranca,
    Valor: numeroBR(a.valor),
    "Páginas por bloco": a.paginas_bloco,
    Faixas: faixasCelula(a.faixas),
    "Mostrar não incluso": boolBR(a.mostrar_nao_incluso),
    "Mostrar no orçamento": boolBR(a.mostrar_no_orcamento),
    Ativo: boolBR(a.ativo),
    Ordem: a.ordem,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), "Acabamentos");
  baixar(wb, "acabamentos.xlsx");
}

type AcabamentoImportado = Omit<Acabamento, "id"> & { id?: string };

export async function lerAcabamentos(arquivo: File): Promise<ResultadoImportacao<AcabamentoImportado>> {
  const wb = XLSX.read(await arquivo.arrayBuffer(), { type: "array" });
  const aba = wb.Sheets[wb.SheetNames[0] ?? ""];
  const erros: string[] = [];
  const linhas: LinhaImportada<AcabamentoImportado>[] = [];
  if (!aba) return { linhas, erros: ["Planilha vazia."] };

  const dados = XLSX.utils.sheet_to_json<Record<string, unknown>>(aba, { defval: "" });
  dados.forEach((linha, i) => {
    const nome = String(linha["Nome"] ?? "").trim();
    if (!nome) {
      erros.push(`Linha ${i + 2}: nome do acabamento vazio.`);
      return;
    }
    const id = String(linha["id"] ?? "").trim();
    linhas.push({
      novo: !id,
      registro: {
        ...(id ? { id } : {}),
        nome,
        tipo_impressao: (String(linha["Tipo de impressão"] ?? "ambos").trim() ||
          "ambos") as Acabamento["tipo_impressao"],
        cobranca: (String(linha["Cobrança"] ?? "quantidade").trim() || "quantidade") as Acabamento["cobranca"],
        valor: lerNumero(linha["Valor"]),
        paginas_bloco: Math.max(1, lerInteiro(linha["Páginas por bloco"]) || 1),
        faixas: textoParaFaixas(String(linha["Faixas"] ?? "")),
        mostrar_nao_incluso: lerBooleano(linha["Mostrar não incluso"]),
        mostrar_no_orcamento: lerBooleano(linha["Mostrar no orçamento"]),
        ativo: lerBooleano(linha["Ativo"]),
        ordem: lerInteiro(linha["Ordem"]),
      } as AcabamentoImportado,
    });
  });

  return { linhas, erros };
}

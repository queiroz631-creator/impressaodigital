/**
 * Link público do orçamento. Somente servidor.
 *
 * Todo valor continua sendo calculado por src/lib/calc.ts com os materiais e
 * acabamentos cadastrados — o link apenas permite ao cliente ver e ajustar as
 * opções liberadas pelo administrador.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  acabamentosDoTipo,
  calcularAcabamentos,
  calcularLinhas,
  totalAcabamentos,
  type Acabamento,
  type FormatoPapel,
  type Material,
  type SelecaoAcabamento,
  type TipoServico,
} from "@/lib/calc";

export interface ArquivoOrcamento {
  nome: string;
  tipo?: string;
  paginas: number;
  copias: number;
  frenteVerso?: boolean;
}

export interface OpcoesLink {
  materialId?: string | null;
  formato?: FormatoPapel;
  tipoServico?: TipoServico;
  copiasPorArquivo?: number;
  frenteVerso?: boolean;
  acabamentoIds?: string[];
}

export interface ResultadoCalculo {
  materialId: string;
  materialNome: string;
  formato: FormatoPapel;
  tipoServico: TipoServico;
  copiasPorArquivo: number;
  frenteVerso: boolean;
  quantidadeArquivos: number;
  paginasTotal: number;
  paginasAdicionais: number;
  copiasAdicionais: number;
  valorUnitario: number;
  valorAcabamento: number;
  valorTotal: number;
  acabamentos: { id: string; nome: string; quantidade: number; total: number }[];
}

export function gerarToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function arquivosDoOrcamento(valor: unknown): ArquivoOrcamento[] {
  if (!Array.isArray(valor)) return [];
  return valor.map((item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    return {
      nome: String(o["nome"] ?? "Arquivo"),
      tipo: o["tipo"] ? String(o["tipo"]) : undefined,
      paginas: Math.max(1, Number(o["paginas"] ?? 1) || 1),
      copias: Math.max(1, Number(o["copias"] ?? 1) || 1),
      frenteVerso: Boolean(o["frenteVerso"]),
    };
  });
}

export async function listarMateriais() {
  const { data } = await supabaseAdmin.from("materiais").select("*").eq("ativo", true).order("ordem");
  return (data ?? []) as unknown as Material[];
}

export async function listarAcabamentos() {
  const { data } = await supabaseAdmin.from("acabamentos").select("*").eq("ativo", true).order("ordem");
  return (data ?? []) as unknown as Acabamento[];
}

export function materiaisCompativeis(materiais: Material[], tipo: TipoServico, formato: FormatoPapel) {
  return materiais.filter(
    (m) => (m.tipo_impressao ?? "simples") === tipo && (m.formato ?? "A4") === formato,
  );
}

/** Recalcula o orçamento a partir dos arquivos e das opções escolhidas. */
export function recalcular(
  arquivos: ArquivoOrcamento[],
  materiais: Material[],
  acabamentos: Acabamento[],
  opcoes: Required<Omit<OpcoesLink, "materialId">> & { materialId: string },
): ResultadoCalculo | null {
  const material = materiais.find((m) => m.id === opcoes.materialId);
  if (!material) return null;

  const copias = Math.max(1, Number(opcoes.copiasPorArquivo) || 1);
  const quantidadeArquivos = arquivos.length;
  const paginasTotal = arquivos.reduce((acc, a) => acc + Math.max(1, a.paginas), 0);
  const paginasAdicionais = arquivos.reduce((acc, a) => acc + Math.max(0, a.paginas - 1), 0);
  const copiasAdicionais = arquivos.reduce((acc, a) => {
    const paginas = Math.max(1, a.paginas);
    return acc + paginas * copias - paginas;
  }, 0);

  const [linha] = calcularLinhas([material], {
    arquivos: quantidadeArquivos,
    paginasAdicionais,
    copiasAdicionais,
    tipoServico: opcoes.tipoServico,
    formato: opcoes.formato,
  });
  if (!linha) return null;

  const disponiveis = acabamentosDoTipo(acabamentos, opcoes.tipoServico);
  const escolhidos = new Set(opcoes.acabamentoIds);
  const selecao: Record<string, SelecaoAcabamento> = {};
  for (const a of disponiveis) {
    if (escolhidos.has(a.id)) selecao[a.id] = { ativo: true, quantidade: quantidadeArquivos || 1 };
  }

  const linhasAcabamento = calcularAcabamentos(disponiveis, selecao, {
    paginas: quantidadeArquivos + paginasAdicionais + copiasAdicionais,
  });
  const valorAcabamento = totalAcabamentos(linhasAcabamento);

  return {
    materialId: material.id,
    materialNome: material.nome,
    formato: opcoes.formato,
    tipoServico: opcoes.tipoServico,
    copiasPorArquivo: copias,
    frenteVerso: opcoes.frenteVerso,
    quantidadeArquivos,
    paginasTotal,
    paginasAdicionais,
    copiasAdicionais,
    valorUnitario: linha.valorUnitario,
    valorAcabamento,
    valorTotal: linha.total + valorAcabamento,
    acabamentos: linhasAcabamento.map((l) => ({
      id: l.acabamento.id,
      nome: l.acabamento.nome,
      quantidade: l.quantidade,
      total: l.total,
    })),
  };
}

/** Grava o resultado recalculado no orçamento e no pedido. */
export async function persistirCalculo(
  orcamentoId: string,
  pedidoId: string | null,
  arquivos: ArquivoOrcamento[],
  r: ResultadoCalculo,
) {
  await supabaseAdmin
    .from("orcamentos")
    .update({
      material_id: r.materialId,
      material_nome: r.materialNome,
      tamanho: r.formato,
      tipo_impressao: r.tipoServico,
      frente_verso: r.frenteVerso,
      quantidade_arquivos: r.quantidadeArquivos,
      paginas_total: r.paginasTotal,
      paginas_adicionais: r.paginasAdicionais,
      copias_adicionais: r.copiasAdicionais,
      valor_unitario: r.valorUnitario,
      valor_acabamento: r.valorAcabamento,
      valor_total: r.valorTotal,
      arquivos: arquivos.map((a) => ({
        nome: a.nome,
        tipo: a.tipo ?? "documento",
        paginas: a.paginas,
        copias: r.copiasPorArquivo,
        frenteVerso: r.frenteVerso,
      })) as never,
      acabamentos: r.acabamentos.map((a) => ({
        nome: a.nome,
        quantidade: a.quantidade,
        total: a.total,
        incluso: true,
      })) as never,
      revisao_necessaria: true,
    })
    .eq("id", orcamentoId);

  if (pedidoId) {
    const { data } = await supabaseAdmin
      .from("orcamentos")
      .select("valor_total")
      .eq("pedido_id", pedidoId);
    const total = (data ?? []).reduce((acc, o) => acc + Number(o.valor_total ?? 0), 0);
    await supabaseAdmin.from("pedidos").update({ valor_total: total }).eq("id", pedidoId);
  }
}

/** Cria (ou reaproveita) o link público de um orçamento e devolve o token. */
export async function criarLink(orcamentoId: string, pedidoId: string | null, conversaId: string | null) {
  const { data: existente } = await supabaseAdmin
    .from("orcamento_links")
    .select("token, expira_em, cancelado")
    .eq("orcamento_id", orcamentoId)
    .eq("cancelado", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existente && new Date(existente.expira_em).getTime() > Date.now()) return existente.token;

  const token = gerarToken();
  const { error } = await supabaseAdmin.from("orcamento_links").insert({
    token,
    orcamento_id: orcamentoId,
    pedido_id: pedidoId,
    conversa_id: conversaId,
  });
  if (error) throw new Error(error.message);
  return token;
}

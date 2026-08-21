/** Regras do link público de orçamento. Somente servidor. */

import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { acabamentosDoTipo, type FormatoPapel, type TipoServico } from "@/lib/calc";
import {
  arquivosDoOrcamento,
  criarLink,
  listarAcabamentos,
  listarMateriais,
  materiaisCompativeis,
  persistirCalculo,
  recalcular,
} from "@/lib/link.server";

export interface PermissoesLink {
  mostrarPrecos: boolean;
  upload: boolean;
  material: boolean;
  acabamento: boolean;
  formato: boolean;
  tipo: boolean;
  copias: boolean;
  frenteVerso: boolean;
  confirmacao: boolean;
  exigirTelefone: boolean;
}

export interface DadosLink {
  ok: boolean;
  motivo?: string;
  empresa?: { nome: string; telefone: string | null; logo: string | null };
  permissoes?: PermissoesLink;
  orcamento?: {
    numero: string;
    clienteNome: string;
    materialId: string | null;
    materialNome: string | null;
    formato: FormatoPapel;
    tipoServico: TipoServico;
    copiasPorArquivo: number;
    frenteVerso: boolean;
    quantidadeArquivos: number;
    paginasTotal: number;
    valorTotal: number;
    valorAcabamento: number;
    status: string;
    confirmado: boolean;
    arquivos: { nome: string; paginas: number }[];
    acabamentosSelecionados: string[];
  };
  opcoes?: {
    materiais: { id: string; nome: string; descricao: string | null; formato: string; tipo: string }[];
    acabamentos: { id: string; nome: string }[];
  };
}

async function lerConfigLink() {
  const { data } = await supabaseAdmin
    .from("whatsapp_config")
    .select(
      "permitir_link, mostrar_precos_link, link_permitir_upload, link_permitir_material, link_permitir_acabamento, link_permitir_formato, link_permitir_tipo, link_permitir_copias, link_permitir_frente_verso, link_permitir_confirmacao, link_exigir_telefone",
    )
    .limit(1)
    .maybeSingle();
  return data;
}

function permissoes(c: Awaited<ReturnType<typeof lerConfigLink>>): PermissoesLink {
  return {
    mostrarPrecos: Boolean(c?.mostrar_precos_link),
    upload: Boolean(c?.link_permitir_upload),
    material: Boolean(c?.link_permitir_material),
    acabamento: Boolean(c?.link_permitir_acabamento),
    formato: Boolean(c?.link_permitir_formato),
    tipo: Boolean(c?.link_permitir_tipo),
    copias: Boolean(c?.link_permitir_copias),
    frenteVerso: Boolean(c?.link_permitir_frente_verso),
    confirmacao: Boolean(c?.link_permitir_confirmacao),
    exigirTelefone: Boolean(c?.link_exigir_telefone),
  };
}

async function lerLink(token: string) {
  const { data } = await supabaseAdmin
    .from("orcamento_links")
    .select("id, token, orcamento_id, pedido_id, conversa_id, expira_em, cancelado, confirmado_em")
    .eq("token", token)
    .maybeSingle();
  return data;
}

async function lerOrcamento(id: string) {
  const { data } = await supabaseAdmin.from("orcamentos").select("*").eq("id", id).maybeSingle();
  return data;
}

async function montar(token: string): Promise<DadosLink> {
  const link = await lerLink(token);
  if (!link || link.cancelado) return { ok: false, motivo: "Link inválido ou cancelado." };
  if (new Date(link.expira_em).getTime() < Date.now()) return { ok: false, motivo: "Este link expirou." };

  const config = await lerConfigLink();
  if (!config?.permitir_link) return { ok: false, motivo: "O link de orçamento está desativado." };

  const orc = await lerOrcamento(link.orcamento_id);
  if (!orc) return { ok: false, motivo: "Orçamento não encontrado." };

  const { data: empresa } = await supabaseAdmin
    .from("configuracoes")
    .select("empresa_nome, telefone, logo_url")
    .limit(1)
    .maybeSingle();

  const tipoServico = (orc.tipo_impressao ?? "simples") as TipoServico;
  const formato = (orc.tamanho ?? "A4") as FormatoPapel;

  const materiais = await listarMateriais();
  const acabamentos = acabamentosDoTipo(await listarAcabamentos(), tipoServico);
  const arquivos = arquivosDoOrcamento(orc.arquivos);
  const selecionadosNomes = new Set(
    (Array.isArray(orc.acabamentos) ? orc.acabamentos : []).map((a) =>
      String((a as Record<string, unknown>)["nome"] ?? ""),
    ),
  );

  return {
    ok: true,
    empresa: {
      nome: empresa?.empresa_nome ?? "Orçamento",
      telefone: empresa?.telefone ?? null,
      logo: empresa?.logo_url ?? null,
    },
    permissoes: permissoes(config),
    orcamento: {
      numero: orc.numero,
      clienteNome: orc.cliente_nome,
      materialId: orc.material_id,
      materialNome: orc.material_nome,
      formato,
      tipoServico,
      copiasPorArquivo: Math.max(1, arquivos[0]?.copias ?? 1),
      frenteVerso: Boolean(orc.frente_verso),
      quantidadeArquivos: orc.quantidade_arquivos,
      paginasTotal: orc.paginas_total,
      valorTotal: Number(orc.valor_total ?? 0),
      valorAcabamento: Number(orc.valor_acabamento ?? 0),
      status: orc.status,
      confirmado: Boolean(link.confirmado_em) || orc.status === "aprovado",
      arquivos: arquivos.map((a) => ({ nome: a.nome, paginas: a.paginas })),
      acabamentosSelecionados: acabamentos.filter((a) => selecionadosNomes.has(a.nome)).map((a) => a.id),
    },
    opcoes: {
      materiais: materiaisCompativeis(materiais, tipoServico, formato).map((m) => ({
        id: m.id,
        nome: m.nome,
        descricao: m.descricao ?? null,
        formato: m.formato ?? "A4",
        tipo: m.tipo_impressao ?? "simples",
      })),
      acabamentos: acabamentos.map((a) => ({ id: a.id, nome: a.nome })),
    },
  };
}

export async function carregarPorToken(token: string): Promise<DadosLink> {
  const link = await lerLink(token);
  if (link && !link.cancelado) {
    await supabaseAdmin
      .from("orcamento_links")
      .update({ aberto_em: new Date().toISOString() })
      .eq("id", link.id);
  }
  return montar(token);
}

export interface EntradaAtualizacao {
  token: string;
  materialId?: string | null | undefined;
  formato?: FormatoPapel | undefined;
  tipoServico?: TipoServico | undefined;
  copiasPorArquivo?: number | undefined;
  frenteVerso?: boolean | undefined;
  acabamentoIds?: string[] | undefined;
  observacao?: string | undefined;
}

export async function atualizarPorToken(entrada: EntradaAtualizacao): Promise<DadosLink> {
  const link = await lerLink(entrada.token);
  if (!link || link.cancelado) return { ok: false, motivo: "Link inválido ou cancelado." };
  if (new Date(link.expira_em).getTime() < Date.now()) return { ok: false, motivo: "Este link expirou." };
  if (link.confirmado_em) return { ok: false, motivo: "Este orçamento já foi confirmado." };

  const config = await lerConfigLink();
  if (!config?.permitir_link) return { ok: false, motivo: "O link de orçamento está desativado." };
  const perm = permissoes(config);

  const orc = await lerOrcamento(link.orcamento_id);
  if (!orc) return { ok: false, motivo: "Orçamento não encontrado." };

  const arquivos = arquivosDoOrcamento(orc.arquivos);
  const materiais = await listarMateriais();
  const acabamentos = await listarAcabamentos();

  const tipoAtual = (orc.tipo_impressao ?? "simples") as TipoServico;
  const formatoAtual = (orc.tamanho ?? "A4") as FormatoPapel;

  const tipoServico = perm.tipo && entrada.tipoServico ? entrada.tipoServico : tipoAtual;
  const formato = perm.formato && entrada.formato ? entrada.formato : formatoAtual;

  const compativeis = materiaisCompativeis(materiais, tipoServico, formato);
  let materialId = orc.material_id ?? "";
  if (perm.material && entrada.materialId) materialId = entrada.materialId;
  if (!compativeis.some((m) => m.id === materialId)) materialId = compativeis[0]?.id ?? "";
  if (!materialId) return { ok: false, motivo: "Nenhum material disponível para essa combinação." };

  const selecionadosNomes = new Set(
    (Array.isArray(orc.acabamentos) ? orc.acabamentos : []).map((a) =>
      String((a as Record<string, unknown>)["nome"] ?? ""),
    ),
  );
  const atuaisIds = acabamentosDoTipo(acabamentos, tipoAtual)
    .filter((a) => selecionadosNomes.has(a.nome))
    .map((a) => a.id);

  const resultado = recalcular(arquivos, materiais, acabamentos, {
    materialId,
    formato,
    tipoServico,
    copiasPorArquivo:
      perm.copias && entrada.copiasPorArquivo
        ? entrada.copiasPorArquivo
        : Math.max(1, arquivos[0]?.copias ?? 1),
    frenteVerso:
      perm.frenteVerso && entrada.frenteVerso !== undefined
        ? entrada.frenteVerso
        : Boolean(orc.frente_verso),
    acabamentoIds: perm.acabamento && entrada.acabamentoIds ? entrada.acabamentoIds : atuaisIds,
  });

  if (!resultado) return { ok: false, motivo: "Não foi possível recalcular o orçamento." };

  await persistirCalculo(orc.id, orc.pedido_id, arquivos, resultado);

  if (entrada.observacao) {
    await supabaseAdmin.from("orcamentos").update({ observacao: entrada.observacao }).eq("id", orc.id);
  }

  if (link.conversa_id) {
    await supabaseAdmin.from("whatsapp_auditoria").insert({
      conversa_id: link.conversa_id,
      usuario_nome: "Cliente (link)",
      acao: "cliente_alterou_orcamento",
      detalhe: `${resultado.materialNome} — ${resultado.copiasPorArquivo} cópia(s)`,
    });
  }

  return montar(entrada.token);
}

export async function confirmarPorToken(token: string): Promise<DadosLink> {
  const link = await lerLink(token);
  if (!link || link.cancelado) return { ok: false, motivo: "Link inválido ou cancelado." };
  if (new Date(link.expira_em).getTime() < Date.now()) return { ok: false, motivo: "Este link expirou." };

  const config = await lerConfigLink();
  if (!config?.permitir_link) return { ok: false, motivo: "O link de orçamento está desativado." };
  if (!config.link_permitir_confirmacao) return { ok: false, motivo: "A confirmação pelo link está desativada." };

  const agora = new Date().toISOString();
  await supabaseAdmin.from("orcamento_links").update({ confirmado_em: agora }).eq("id", link.id);
  await supabaseAdmin
    .from("orcamentos")
    .update({ status: "aprovado", revisao_necessaria: true })
    .eq("id", link.orcamento_id);
  if (link.pedido_id) {
    await supabaseAdmin.from("pedidos").update({ status: "aprovado" }).eq("id", link.pedido_id);
  }

  if (link.conversa_id) {
    await supabaseAdmin
      .from("whatsapp_conversas")
      .update({ status: "pendente", etapa: "aguardando_atendente", motivo_pendencia: "orçamento confirmado pelo link" })
      .eq("id", link.conversa_id);
    await supabaseAdmin.from("whatsapp_auditoria").insert({
      conversa_id: link.conversa_id,
      usuario_nome: "Cliente (link)",
      acao: "cliente_confirmou_pelo_link",
    });
  }

  return montar(token);
}

/** Monta a URL pública a partir da requisição atual. */
export function urlBase(): string {
  try {
    const req = getRequest();
    if (req?.url) return new URL(req.url).origin;
  } catch {
    /* fora de um contexto de requisição */
  }
  return process.env["SITE_URL"] ?? "";
}

export async function gerarParaOrcamento(orcamentoId: string, enviarWhatsapp: boolean) {
  const orc = await lerOrcamento(orcamentoId);
  if (!orc) return { ok: false, motivo: "Orçamento não encontrado." as string };

  const { data: conversa } = await supabaseAdmin
    .from("whatsapp_conversas")
    .select("id")
    .eq("orcamento_id", orcamentoId)
    .maybeSingle();

  const token = await criarLink(orcamentoId, orc.pedido_id, conversa?.id ?? null);
  const url = `${urlBase()}/orcamento/${token}`;

  let enviado = false;
  let detalhe: string | null = null;

  if (enviarWhatsapp && orc.cliente_telefone) {
    const { chamarZapi } = await import("@/lib/zapi.server");
    const r = await chamarZapi("send-text", {
      metodo: "POST",
      corpo: {
        phone: orc.cliente_telefone.replace(/\D/g, ""),
        message: `Seu orçamento *${orc.numero}* está pronto! 📄\n\nAcesse pelo link para conferir e confirmar:\n${url}`,
      },
    });
    enviado = r.ok;
    detalhe = r.ok ? null : (r.erro ?? "Falha no envio");
  }

  return { ok: true, token, url, enviado, detalhe };
}

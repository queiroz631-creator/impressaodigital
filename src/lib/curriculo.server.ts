import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { urlBase } from "@/lib/link-dados.server";
import type { CurriculoCompleto, PayloadEtapa } from "@/lib/curriculo";

const CAMPOS =
  "id, cliente_id, status, nome_completo, cpf, telefone_principal, data_nascimento, estado_civil, email, documentacao_completa, habilitacao, categoria_habilitacao, escolaridade, curso_superior, pos_graduacao_nome, endereco, bairro, cidade, uf, cep, objetivo_tipo, objetivo_texto, exibir_data_atualizacao, created_at, updated_at, completed_at";

export interface DadosPublicos {
  curriculo: Omit<CurriculoCompleto["curriculo"], "cpf"> & { cpf: string };
  telefones: CurriculoCompleto["telefones"];
  cursos: CurriculoCompleto["cursos"];
  experiencias: CurriculoCompleto["experiencias"];
  habilidades: CurriculoCompleto["habilidades"];
  catalogoHabilidades: { id: string; descricao: string }[];
  objetivosSugeridos: { id: string; texto: string }[];
  empresaNome: string;
  expiraEm: string;
}

/** Lê e valida o link, devolvendo o id do currículo correspondente. */
async function lerLink(token: string) {
  const { data } = await supabaseAdmin
    .from("curriculo_links")
    .select("id, curriculo_id, expires_at, ativo")
    .eq("token", token)
    .maybeSingle();

  if (!data || !data.ativo) throw new Error("LINK_INVALIDO");
  if (new Date(data.expires_at).getTime() < Date.now()) throw new Error("LINK_EXPIRADO");
  return data;
}

export async function carregarCurriculo(curriculoId: string): Promise<CurriculoCompleto> {
  const [c, tel, cur, form, exp, hab] = await Promise.all([
    supabaseAdmin.from("curriculos").select(CAMPOS).eq("id", curriculoId).maybeSingle(),
    supabaseAdmin
      .from("curriculo_telefones")
      .select("telefone")
      .eq("curriculo_id", curriculoId)
      .order("ordem"),
    supabaseAdmin
      .from("curriculo_cursos")
      .select("nome_curso, instituicao, ano")
      .eq("curriculo_id", curriculoId)
      .order("ordem"),
    supabaseAdmin
      .from("curriculo_formacoes")
      .select("nome_curso, instituicao, ano")
      .eq("curriculo_id", curriculoId)
      .order("ordem"),
    supabaseAdmin
      .from("curriculo_experiencias")
      .select("empresa, cargo, periodo, atividades")
      .eq("curriculo_id", curriculoId)
      .order("ordem"),
    supabaseAdmin
      .from("curriculo_habilidades")
      .select("habilidade_id, descricao")
      .eq("curriculo_id", curriculoId)
      .order("ordem"),
  ]);

  if (!c.data) throw new Error("Currículo não encontrado.");

  return {
    curriculo: c.data as CurriculoCompleto["curriculo"],
    telefones: tel.data ?? [],
    cursos: cur.data ?? [],
    formacoes: form.data ?? [],
    experiencias: exp.data ?? [],
    habilidades: hab.data ?? [],
  };
}

/** Grava uma etapa (campos e/ou listas) de um currículo. */
export async function gravarEtapa(curriculoId: string, payload: PayloadEtapa) {
  if (payload.campos && Object.keys(payload.campos).length > 0) {
    const { error } = await supabaseAdmin
      .from("curriculos")
      .update(payload.campos)
      .eq("id", curriculoId);
    if (error) throw new Error(error.message);
  }

  const trocarLista = async (
    tabela:
      | "curriculo_telefones"
      | "curriculo_cursos"
      | "curriculo_formacoes"
      | "curriculo_experiencias"
      | "curriculo_habilidades",
    linhas: Record<string, unknown>[],
  ) => {
    await supabaseAdmin.from(tabela).delete().eq("curriculo_id", curriculoId);
    if (linhas.length > 0) {
      const { error } = await supabaseAdmin
        .from(tabela)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(linhas.map((l, i) => ({ ...l, curriculo_id: curriculoId, ordem: i })) as any);
      if (error) throw new Error(error.message);
    }
  };

  if (payload.telefones) {
    await trocarLista(
      "curriculo_telefones",
      payload.telefones.filter((t) => t.telefone.trim()).map((t) => ({ telefone: t.telefone.trim() })),
    );
  }
  if (payload.cursos) {
    await trocarLista(
      "curriculo_cursos",
      payload.cursos
        .filter((c) => c.nome_curso.trim())
        .map((c) => ({
          nome_curso: c.nome_curso.trim(),
          instituicao: c.instituicao?.trim() || null,
          ano: c.ano?.trim() || null,
        })),
    );
  }
  if (payload.formacoes) {
    await trocarLista(
      "curriculo_formacoes",
      payload.formacoes
        .filter((f) => f.nome_curso.trim())
        .map((f) => ({
          nome_curso: f.nome_curso.trim(),
          instituicao: f.instituicao?.trim() || null,
          ano: f.ano?.trim() || null,
        })),
    );
  }
  if (payload.experiencias) {
    await trocarLista(
      "curriculo_experiencias",
      payload.experiencias
        .filter((e) => (e.empresa ?? "").trim() || (e.cargo ?? "").trim())
        .map((e) => ({
          empresa: e.empresa?.trim() || null,
          cargo: e.cargo?.trim() || null,
          periodo: e.periodo?.trim() || null,
          atividades: e.atividades?.trim() || null,
        })),
    );
  }
  if (payload.habilidades) {
    await trocarLista(
      "curriculo_habilidades",
      payload.habilidades
        .filter((h) => h.descricao.trim())
        .map((h) => ({ habilidade_id: h.habilidade_id, descricao: h.descricao.trim() })),
    );
  }

  if (payload.finalizar) {
    await supabaseAdmin
      .from("curriculos")
      .update({ status: "completo", completed_at: new Date().toISOString() })
      .eq("id", curriculoId);
  }
}

/* ------------------------------------------------------ link público */

function novoToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function gerarLink(curriculoId: string) {
  await supabaseAdmin
    .from("curriculo_links")
    .update({ ativo: false })
    .eq("curriculo_id", curriculoId)
    .eq("ativo", true);

  const token = novoToken();
  const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabaseAdmin
    .from("curriculo_links")
    .insert({ curriculo_id: curriculoId, token, expires_at: expiraEm });
  if (error) throw new Error(error.message);

  return { token, url: `${urlBase()}/curriculo/publico/${token}`, expiraEm };
}

export async function carregarPublico(token: string): Promise<DadosPublicos> {
  const link = await lerLink(token);
  const completo = await carregarCurriculo(link.curriculo_id);

  const [cat, obj, cfg] = await Promise.all([
    supabaseAdmin
      .from("habilidades_curriculo")
      .select("id, descricao")
      .eq("ativo", true)
      .order("ordem"),
    supabaseAdmin.from("objetivos_curriculo").select("id, texto").eq("ativo", true).order("ordem"),
    supabaseAdmin.from("configuracoes").select("empresa_nome").limit(1).maybeSingle(),
  ]);

  return {
    // CPF nunca sai para o link público.
    curriculo: { ...completo.curriculo, cpf: "" },
    telefones: completo.telefones,
    cursos: completo.cursos,
    formacoes: completo.formacoes,
    experiencias: completo.experiencias,
    habilidades: completo.habilidades,
    catalogoHabilidades: cat.data ?? [],
    objetivosSugeridos: obj.data ?? [],
    empresaNome: cfg.data?.empresa_nome ?? "Currículo",
    expiraEm: link.expires_at,
  };
}

export async function salvarPublico(token: string, payload: PayloadEtapa) {
  const link = await lerLink(token);
  await gravarEtapa(link.curriculo_id, payload);
  await supabaseAdmin
    .from("curriculo_links")
    .update({ used_at: new Date().toISOString() })
    .eq("id", link.id);
  return carregarPublico(token);
}

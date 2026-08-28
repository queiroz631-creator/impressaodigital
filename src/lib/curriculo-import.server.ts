/** Interpretação (IA) e gravação de currículos importados. Somente servidor. */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  CATEGORIAS_HABILITACAO,
  ESCOLARIDADES,
  ESTADOS_CIVIS,
  cpfValido,
  capitalizarTexto,
  formatarTelefone,
  somenteNumeros,
} from "@/lib/curriculo";
import { normalizarTelefone } from "@/lib/whatsapp-comum";
import { gravarEtapa } from "@/lib/curriculo.server";
import type { PayloadEtapa } from "@/lib/curriculo";
import type { CurriculoImportado } from "@/lib/curriculo-import-tipos";

const MODELO = "google/gemini-2.5-flash";

const SISTEMA = `Você extrai dados de currículos brasileiros e devolve SOMENTE JSON válido.
REGRAS OBRIGATÓRIAS:
- Nunca invente informação. Campo ausente no documento fica vazio ("" ou null) ou lista vazia.
- Reconheça variações de título: Celular/Contato/WhatsApp = telefone; Formação/Educação/Escolaridade = escolaridade; Experiência/Histórico Profissional/Atuação = experiências; Cursos/Qualificações/Capacitação = cursos; Habilidades/Competências = habilidades.
- O documento pode não ter títulos, ter tabelas ou duas colunas.
- escolaridade DEVE ser exatamente um destes valores ou "": ${ESCOLARIDADES.join(" | ")}
- escolaridade é a formação PRINCIPAL (nível de ensino). NUNCA repita essa formação principal dentro de "formacoes".
- "formacoes" recebe SOMENTE formações adicionais que tenham um curso próprio (ex.: graduação, técnico, pós) com nome_curso preenchido. Se a pessoa só tem o nível de ensino (fundamental/médio), "formacoes" deve ser [].
- estado_civil DEVE ser exatamente um destes valores ou "": ${ESTADOS_CIVIS.join(" | ")}
- categoria_habilitacao DEVE ser um destes ou "": ${CATEGORIAS_HABILITACAO.join(" | ")}
- data_nascimento no formato AAAA-MM-DD ou "".
- Em confianca_baixa liste os nomes dos campos cujo valor você não tem certeza.

Formato exato de saída:
{"nome_completo":"","cpf":"","telefone_principal":"","telefones":[],"data_nascimento":"","estado_civil":"","email":"","endereco":"","numero":"","bairro":"","cidade":"","uf":"","cep":"","documentacao_completa":null,"habilitacao":false,"categoria_habilitacao":"","escolaridade":"","curso_superior":"","pos_graduacao_nome":"","objetivo_texto":"","cursos":[{"nome_curso":"","instituicao":"","ano":""}],"formacoes":[{"nivel":"","nome_curso":"","instituicao":"","ano":""}],"experiencias":[{"empresa":"","cargo":"","periodo":"","atividades":""}],"habilidades":[""],"confianca_baixa":[""]}`;

function texto(v: unknown, max = 300): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function lista(v: unknown): unknown[] {
  return Array.isArray(v) ? v.slice(0, 30) : [];
}

/** Chama a IA e normaliza o resultado para os tipos do sistema. */
export async function interpretarTexto(conteudo: string): Promise<CurriculoImportado> {
  const chave = process.env["LOVABLE_API_KEY"];
  if (!chave) throw new Error("IA_INDISPONIVEL");

  const resposta = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` },
    body: JSON.stringify({
      model: MODELO,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SISTEMA },
        { role: "user", content: conteudo.slice(0, 30000) },
      ],
    }),
  });

  if (resposta.status === 429) throw new Error("IA_LIMITE");
  if (resposta.status === 402) throw new Error("IA_CREDITOS");
  if (!resposta.ok) throw new Error("IA_INDISPONIVEL");

  const json = (await resposta.json()) as { choices?: { message?: { content?: string } }[] };
  const bruto = json.choices?.[0]?.message?.content ?? "";
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(bruto.replace(/^```json/i, "").replace(/```$/, "").trim());
  } catch {
    throw new Error("IA_INDISPONIVEL");
  }

  const escolaridade = ESCOLARIDADES.includes(texto(obj["escolaridade"]))
    ? texto(obj["escolaridade"])
    : "";
  const civilBruto = texto(obj["estado_civil"]).toLowerCase();
  const estadoCivil =
    ESTADOS_CIVIS.find(
      (e) =>
        e.toLowerCase() === civilBruto ||
        (civilBruto.length > 3 && e.toLowerCase().startsWith(civilBruto.slice(0, 5))),
    ) ?? "";
  const categoria = CATEGORIAS_HABILITACAO.includes(texto(obj["categoria_habilitacao"]).toUpperCase())
    ? texto(obj["categoria_habilitacao"]).toUpperCase()
    : "";
  const nascimento = /^\d{4}-\d{2}-\d{2}$/.test(texto(obj["data_nascimento"]))
    ? texto(obj["data_nascimento"])
    : "";

  const cpf = somenteNumeros(texto(obj["cpf"]));

  return {
    campos: {
      nome_completo: capitalizarTexto(texto(obj["nome_completo"], 200)),
      telefone_principal: texto(obj["telefone_principal"], 30),
      data_nascimento: nascimento,
      estado_civil: estadoCivil,
      email: texto(obj["email"], 160).toLowerCase(),
      endereco: capitalizarTexto(texto(obj["endereco"], 200)),
      numero: texto(obj["numero"], 20),
      bairro: capitalizarTexto(texto(obj["bairro"], 120)),
      cidade: capitalizarTexto(texto(obj["cidade"], 120)),
      uf: texto(obj["uf"], 2).toUpperCase(),
      cep: texto(obj["cep"], 12),
      documentacao_completa:
        typeof obj["documentacao_completa"] === "boolean"
          ? (obj["documentacao_completa"] as boolean)
          : null,
      habilitacao: obj["habilitacao"] === true || !!categoria,
      categoria_habilitacao: categoria,
      escolaridade,
      curso_superior: capitalizarTexto(texto(obj["curso_superior"], 160)),
      pos_graduacao_nome: capitalizarTexto(texto(obj["pos_graduacao_nome"], 200)),
      objetivo_texto: texto(obj["objetivo_texto"], 1000),
    },
    cpf: cpfValido(cpf) ? cpf : "",
    telefones: lista(obj["telefones"])
      .map((t) => texto(t, 30))
      .filter(Boolean),
    cursos: lista(obj["cursos"])
      .map((c) => {
        const o = (c ?? {}) as Record<string, unknown>;
        return {
          nome_curso: capitalizarTexto(texto(o["nome_curso"] ?? o["nome"] ?? o["curso"], 200)),
          instituicao: capitalizarTexto(texto(o["instituicao"] ?? o["escola"], 200)),
          ano: texto(o["ano"] ?? o["ano_conclusao"], 10),
        };
      })
      .filter((c) => c.nome_curso),
    formacoes: lista(obj["formacoes"])
      .map((f) => {
        const o = (f ?? {}) as Record<string, unknown>;
        return {
          nivel: texto(o["nivel"], 120),
          nome_curso: capitalizarTexto(texto(o["nome_curso"] ?? o["nome"] ?? o["curso"], 200)),
          instituicao: capitalizarTexto(texto(o["instituicao"] ?? o["escola"], 200)),
          ano: texto(o["ano"] ?? o["ano_conclusao"], 10),
        };
      })
      // Só entram formações adicionais com curso próprio; o nível principal fica em "escolaridade".
      .filter((f) => {
        if (!f.nome_curso) return false;
        const chave = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();
        if (escolaridade && chave(f.nome_curso) === chave(escolaridade)) return false;
        if (escolaridade && f.nivel && chave(f.nivel) === chave(escolaridade) && !f.instituicao) return false;
        return true;
      }),
    experiencias: lista(obj["experiencias"])
      .map((e) => {
        const o = (e ?? {}) as Record<string, unknown>;
        return {
          empresa: capitalizarTexto(texto(o["empresa"], 200)),
          cargo: capitalizarTexto(texto(o["cargo"] ?? o["funcao"], 200)),
          periodo: texto(o["periodo"] ?? o["ano"], 120),
          atividades: texto(o["atividades"] ?? o["descricao"], 2000),
        };
      })
      .filter((e) => e.empresa || e.cargo),
    habilidades: lista(obj["habilidades"])
      .map((h) =>
        typeof h === "string"
          ? texto(h, 300)
          : texto((h as Record<string, unknown>)?.["descricao"] ?? (h as Record<string, unknown>)?.["nome"], 300),
      )
      .filter(Boolean),
    confiancaBaixa: lista(obj["confianca_baixa"])
      .map((c) => texto(c, 60))
      .filter(Boolean),
  };
}

/** Currículo já cadastrado para o CPF informado. */
export async function buscarPorCpf(cpf: string) {
  const numeros = somenteNumeros(cpf);
  if (!cpfValido(numeros)) return null;
  const { data } = await supabaseAdmin
    .from("curriculos")
    .select("id, nome_completo, telefone_principal, status")
    .eq("cpf", numeros)
    .maybeSingle();
  return data ?? null;
}

async function clientePorTelefone(nome: string, telefone: string) {
  const normalizado = normalizarTelefone(telefone);
  if (normalizado.length < 10) return null;
  const { data } = await supabaseAdmin
    .from("clientes")
    .select("id")
    .eq("telefone_normalizado", normalizado)
    .maybeSingle();
  if (data) return data.id;
  const { data: novo, error } = await supabaseAdmin
    .from("clientes")
    .insert({
      nome: nome.trim() || "Cliente",
      telefone: formatarTelefone(telefone),
      telefone_normalizado: normalizado,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return novo.id;
}

/** Combina catálogo de habilidades com as habilidades importadas. */
async function habilidadesImportadas(descricoes: string[]) {
  const { data: catalogo } = await supabaseAdmin
    .from("habilidades_curriculo")
    .select("id, descricao")
    .eq("ativo", true);

  return descricoes.map((descricao) => {
    const achou = (catalogo ?? []).find(
      (c) => c.descricao.toLowerCase() === descricao.toLowerCase(),
    );
    return { habilidade_id: achou?.id ?? null, descricao: achou?.descricao ?? descricao };
  });
}

function payloadDoImportado(dados: CurriculoImportado): Required<
  Pick<PayloadEtapa, "campos" | "telefones" | "cursos" | "formacoes" | "experiencias">
> {
  const c = dados.campos;
  return {
    campos: {
      ...(c.nome_completo ? { nome_completo: c.nome_completo } : {}),
      ...(c.telefone_principal ? { telefone_principal: c.telefone_principal } : {}),
      data_nascimento: c.data_nascimento || null,
      estado_civil: c.estado_civil || null,
      email: c.email || null,
      endereco: c.endereco || null,
      numero: c.numero || null,
      bairro: c.bairro || null,
      cidade: c.cidade || null,
      uf: c.uf || null,
      cep: c.cep || null,
      documentacao_completa: c.documentacao_completa,
      habilitacao: c.habilitacao,
      categoria_habilitacao: c.categoria_habilitacao || null,
      escolaridade: c.escolaridade || null,
      curso_superior: c.curso_superior || null,
      pos_graduacao_nome: c.pos_graduacao_nome || null,
      objetivo_tipo: (c.objetivo_texto ? "personalizado" : "nao_informar") as
        | "personalizado"
        | "nao_informar",
      objetivo_texto: c.objetivo_texto || null,
      experiencia_possui: dados.experiencias.length > 0,
    },
    telefones: dados.telefones.map((t) => ({ telefone: t })),
    cursos: dados.cursos.map((cu) => ({
      nome_curso: cu.nome_curso,
      instituicao: cu.instituicao || null,
      ano: cu.ano || null,
    })),
    formacoes: dados.formacoes.map((f) => ({
      nome_curso: f.nome_curso,
      instituicao: f.instituicao || null,
      ano: f.ano || null,
      nivel: f.nivel || null,
    })),
    experiencias: dados.experiencias.map((e) => ({
      empresa: e.empresa || null,
      cargo: e.cargo || null,
      periodo: e.periodo || null,
      atividades: e.atividades || null,
    })),
  };
}

/** Cria um currículo em rascunho com os dados importados. */
export async function criarImportado(
  cpf: string,
  telefone: string,
  dados: CurriculoImportado,
): Promise<string> {
  const cpfNumeros = somenteNumeros(cpf);
  if (!cpfValido(cpfNumeros)) throw new Error("CPF inválido.");

  const existente = await buscarPorCpf(cpfNumeros);
  if (existente) throw new Error("Este CPF já possui um currículo cadastrado.");

  const nome = dados.campos.nome_completo || "Sem nome";
  const clienteId = await clientePorTelefone(nome, telefone);

  const { data: curriculo, error } = await supabaseAdmin
    .from("curriculos")
    .insert({
      cliente_id: clienteId,
      cpf: cpfNumeros,
      nome_completo: nome,
      telefone_principal: formatarTelefone(telefone),
      status: "rascunho",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const payload = payloadDoImportado(dados);
  await gravarEtapa(curriculo.id, {
    ...payload,
    habilidades: await habilidadesImportadas(dados.habilidades),
  });

  return curriculo.id;
}

/** Aplica os dados importados sobre um currículo existente. */
export async function atualizarImportado(
  curriculoId: string,
  dados: CurriculoImportado,
  substituirListas: boolean,
): Promise<string> {
  const payload = payloadDoImportado(dados);

  if (!substituirListas) {
    const [cur, form, exp, hab, tel] = await Promise.all([
      supabaseAdmin.from("curriculo_cursos").select("nome_curso, instituicao, ano").eq("curriculo_id", curriculoId).order("ordem"),
      supabaseAdmin.from("curriculo_formacoes").select("nome_curso, instituicao, ano, nivel").eq("curriculo_id", curriculoId).order("ordem"),
      supabaseAdmin.from("curriculo_experiencias").select("empresa, cargo, periodo, atividades").eq("curriculo_id", curriculoId).order("ordem"),
      supabaseAdmin.from("curriculo_habilidades").select("habilidade_id, descricao").eq("curriculo_id", curriculoId).order("ordem"),
      supabaseAdmin.from("curriculo_telefones").select("telefone").eq("curriculo_id", curriculoId).order("ordem"),
    ]);

    payload.cursos = [...(cur.data ?? []), ...payload.cursos];
    payload.formacoes = [...(form.data ?? []), ...payload.formacoes];
    payload.experiencias = [...(exp.data ?? []), ...payload.experiencias];
    payload.telefones = [...(tel.data ?? []), ...payload.telefones];

    const importadas = await habilidadesImportadas(dados.habilidades);
    const atuais = hab.data ?? [];
    const novas = importadas.filter(
      (i) => !atuais.some((a) => a.descricao.toLowerCase() === i.descricao.toLowerCase()),
    );
    await gravarEtapa(curriculoId, { ...payload, habilidades: [...atuais, ...novas] });
    return curriculoId;
  }

  await gravarEtapa(curriculoId, {
    ...payload,
    habilidades: await habilidadesImportadas(dados.habilidades),
  });
  return curriculoId;
}

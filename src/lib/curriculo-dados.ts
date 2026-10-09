import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { CurriculoCompleto } from "./curriculo";

export const CAMPOS_CURRICULO = "id, cliente_id, status, nome_completo, cpf, telefone_principal, telefone_principal_descricao, data_nascimento, estado_civil, email, documentacao_completa, habilitacao, categoria_habilitacao, escolaridade, curso_superior, pos_graduacao_nome, endereco, numero, bairro, cidade, uf, cep, objetivo_tipo, objetivo_texto, exibir_data_atualizacao, experiencia_possui, experiencia_frase, habilidades_observacao, foto_url, foto_exibir, created_at, updated_at, completed_at";

export async function carregarDadosCurriculo(client: SupabaseClient<Database>, id: string): Promise<CurriculoCompleto> {
  const [c, tel, cur, form, exp, hab] = await Promise.all([
    client.from("curriculos").select(CAMPOS_CURRICULO).eq("id", id).maybeSingle(),
    client.from("curriculo_telefones").select("telefone, tipo").eq("curriculo_id", id).order("ordem"),
    client.from("curriculo_cursos").select("nome_curso, instituicao, ano").eq("curriculo_id", id).order("ordem"),
    client.from("curriculo_formacoes").select("nome_curso, instituicao, ano, nivel").eq("curriculo_id", id).order("ordem"),
    client.from("curriculo_experiencias").select("empresa, cargo, periodo, atividades").eq("curriculo_id", id).order("ordem"),
    client.from("curriculo_habilidades").select("habilidade_id, descricao").eq("curriculo_id", id).order("ordem"),
  ]);
  for (const resultado of [c, tel, cur, form, exp, hab]) {
    if (resultado.error) throw new Error("Não foi possível carregar todos os dados do currículo.");
  }
  if (!c.data) throw new Error("Currículo não encontrado.");
  return { curriculo: c.data as CurriculoCompleto["curriculo"], telefones: tel.data ?? [], cursos: cur.data ?? [], formacoes: form.data ?? [], experiencias: exp.data ?? [], habilidades: hab.data ?? [] };
}
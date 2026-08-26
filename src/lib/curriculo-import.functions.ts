import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const camposSchema = z.object({
  nome_completo: z.string().max(200),
  telefone_principal: z.string().max(30),
  data_nascimento: z.string().max(20),
  estado_civil: z.string().max(60),
  email: z.string().max(160),
  endereco: z.string().max(200),
  numero: z.string().max(20),
  bairro: z.string().max(120),
  cidade: z.string().max(120),
  uf: z.string().max(2),
  cep: z.string().max(12),
  documentacao_completa: z.boolean().nullable(),
  habilitacao: z.boolean(),
  categoria_habilitacao: z.string().max(4),
  escolaridade: z.string().max(120),
  curso_superior: z.string().max(160),
  pos_graduacao_nome: z.string().max(200),
  objetivo_texto: z.string().max(1000),
});

const importadoSchema = z.object({
  campos: camposSchema,
  cpf: z.string().max(14),
  telefones: z.array(z.string().max(30)).max(10),
  cursos: z
    .array(
      z.object({
        nome_curso: z.string().max(200),
        instituicao: z.string().max(200),
        ano: z.string().max(10),
      }),
    )
    .max(30),
  formacoes: z
    .array(
      z.object({
        nivel: z.string().max(120),
        nome_curso: z.string().max(200),
        instituicao: z.string().max(200),
        ano: z.string().max(10),
      }),
    )
    .max(30),
  experiencias: z
    .array(
      z.object({
        empresa: z.string().max(200),
        cargo: z.string().max(200),
        periodo: z.string().max(120),
        atividades: z.string().max(2000),
      }),
    )
    .max(30),
  habilidades: z.array(z.string().max(300)).max(40),
  confiancaBaixa: z.array(z.string().max(60)).max(40),
});

/** Interpreta o texto extraído do arquivo e devolve os dados estruturados. */
export const interpretarCurriculoImportado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ texto: z.string().min(40).max(40000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { interpretarTexto, buscarPorCpf } = await import("@/lib/curriculo-import.server");
    const dados = await interpretarTexto(data.texto);
    const existente = dados.cpf ? await buscarPorCpf(dados.cpf) : null;
    return { dados, existente };
  });

/** Verifica se um CPF informado manualmente já possui currículo. */
export const consultarCpfImportacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ cpf: z.string().max(14) }).parse(input))
  .handler(async ({ data }) => {
    const { buscarPorCpf } = await import("@/lib/curriculo-import.server");
    return { existente: await buscarPorCpf(data.cpf) };
  });

/** Cria um currículo em rascunho com os dados importados. */
export const criarCurriculoImportado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        cpf: z.string().max(14),
        telefone: z.string().min(8).max(30),
        dados: importadoSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { criarImportado } = await import("@/lib/curriculo-import.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const id = await criarImportado(data.cpf, data.telefone, data.dados);
    await supabaseAdmin.from("whatsapp_auditoria").insert({
      usuario_id: context.userId,
      acao: "curriculo_importado",
      detalhe: `Currículo ${id} criado por importação de arquivo`,
    });
    return { id };
  });

/** Aplica os dados importados sobre um currículo já existente. */
export const atualizarCurriculoImportado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        curriculoId: z.string().uuid(),
        dados: importadoSchema,
        substituirListas: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { atualizarImportado } = await import("@/lib/curriculo-import.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const id = await atualizarImportado(data.curriculoId, data.dados, data.substituirListas);
    await supabaseAdmin.from("whatsapp_auditoria").insert({
      usuario_id: context.userId,
      acao: "curriculo_importado_atualizado",
      detalhe: `Currículo ${id} atualizado por importação de arquivo`,
    });
    return { id };
  });

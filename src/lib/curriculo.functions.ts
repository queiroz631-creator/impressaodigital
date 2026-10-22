import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const camposSchema = z
  .object({
    nome_completo: z.string().max(200).optional(),
    telefone_principal: z.string().max(30).optional(),
    telefone_principal_descricao: z.string().max(60).nullish(),
    data_nascimento: z.string().max(20).nullish(),
    estado_civil: z.string().max(60).nullish(),
    email: z.string().max(160).nullish(),
    documentacao_completa: z.boolean().nullish(),
    habilitacao: z.boolean().optional(),
    categoria_habilitacao: z.string().max(4).nullish(),
    escolaridade: z.string().max(120).nullish(),
    curso_superior: z.string().max(160).nullish(),
    pos_graduacao_nome: z.string().max(200).nullish(),
    endereco: z.string().max(200).nullish(),
    bairro: z.string().max(120).nullish(),
    cidade: z.string().max(120).nullish(),
    uf: z.string().max(2).nullish(),
    cep: z.string().max(12).nullish(),
    numero: z.string().max(20).nullish(),
    experiencia_possui: z.boolean().optional(),
    experiencia_frase: z.string().max(300).nullish(),
    habilidades_observacao: z.string().max(1000).nullish(),
    foto_url: z.string().max(3_000_000).nullish(),
    foto_exibir: z.boolean().optional(),
    objetivo_tipo: z.enum(["sugerido", "personalizado", "nao_informar"]).optional(),
    objetivo_texto: z.string().max(1000).nullish(),
    exibir_data_atualizacao: z.boolean().optional(),
  })
  .strict();

const payloadSchema = z.object({
  campos: camposSchema.optional(),
  telefones: z
    .array(z.object({ telefone: z.string().max(30), tipo: z.string().max(60).nullish() }))
    .max(10)
    .optional(),
  cursos: z
    .array(
      z.object({
        nome_curso: z.string().max(200),
        instituicao: z.string().max(200).nullish(),
        ano: z.string().max(10).nullish(),
      }),
    )
    .max(30)
    .optional(),
  formacoes: z
    .array(
      z.object({
        nome_curso: z.string().max(200),
        instituicao: z.string().max(200).nullish(),
        ano: z.string().max(10).nullish(),
        nivel: z.string().max(120).nullish(),
      }),
    )
    .max(30)
    .optional(),

  experiencias: z
    .array(
      z.object({
        empresa: z.string().max(200).nullish(),
        cargo: z.string().max(200).nullish(),
        periodo: z.string().max(120).nullish(),
        atividades: z.string().max(2000).nullish(),
      }),
    )
    .max(30)
    .optional(),
  habilidades: z
    .array(z.object({ habilidade_id: z.string().uuid().nullish(), descricao: z.string().max(300) }))
    .max(40)
    .optional(),
  finalizar: z.boolean().optional(),
});

const tokenSchema = z.string().min(20).max(200);

/* ------------------------------------------------- link público (cliente) */

export const carregarCurriculoPublico = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ token: tokenSchema }).parse(input))
  .handler(async ({ data }) => {
    const { carregarPublico } = await import("@/lib/curriculo.server");
    return carregarPublico(data.token);
  });

export const salvarCurriculoPublico = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ token: tokenSchema, payload: payloadSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const { salvarPublico } = await import("@/lib/curriculo.server");
    return salvarPublico(data.token, data.payload as Parameters<typeof salvarPublico>[1]);
  });

export const criarCurriculoPublico = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token: tokenSchema,
        nome: z.string().trim().min(2).max(200),
        cpf: z.string().min(8).max(20),
        telefone: z.string().min(8).max(30),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { criarPublico } = await import("@/lib/curriculo.server");
    return criarPublico(data.token, {
      nome: data.nome,
      cpf: data.cpf,
      telefone: data.telefone,
    });
  });

/* -------------------------------------------------------- administrativo */

export const gerarLinkCurriculo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ curriculoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { gerarLink } = await import("@/lib/curriculo.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = await gerarLink(data.curriculoId);
    await supabaseAdmin.from("whatsapp_auditoria").insert({
      usuario_id: context.userId,
      acao: "curriculo_link_gerado",
      detalhe: `Currículo ${data.curriculoId}`,
    });
    return r;
  });

/** Gera um link de criação (sem currículo) para o cliente criar o próprio currículo. */
export const gerarLinkNovoCurriculo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { gerarLinkNovo } = await import("@/lib/curriculo.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = await gerarLinkNovo();
    await supabaseAdmin.from("whatsapp_auditoria").insert({
      usuario_id: context.userId,
      acao: "curriculo_link_novo_gerado",
      detalhe: "Link para novo currículo (autoatendimento)",
    });
    const { data: cfg } = await supabaseAdmin
      .from("whatsapp_config")
      .select("msg_link_curriculo")
      .limit(1)
      .maybeSingle();
    return {
      ...r,
      mensagem: (cfg as { msg_link_curriculo?: string | null } | null)?.msg_link_curriculo ?? "",
    };
  });

export const invalidarLinkCurriculo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ curriculoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("curriculo_links")
      .update({ ativo: false })
      .eq("curriculo_id", data.curriculoId)
      .eq("ativo", true);
    await supabaseAdmin.from("whatsapp_auditoria").insert({
      usuario_id: context.userId,
      acao: "curriculo_link_invalidado",
      detalhe: `Currículo ${data.curriculoId}`,
    });
    return { ok: true };
  });

/** Altera o CPF do currículo e, quando houver cliente vinculado, também do cadastro. */
export const alterarCpfCurriculo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ curriculoId: z.string().uuid(), cpf: z.string().min(11).max(14) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: permitido, error: erroPermissao } = await context.supabase.rpc("tem_permissao", {
      _user_id: context.userId,
      _chave: "curriculos.visualizar",
    });
    if (erroPermissao || !permitido) {
      throw new Error("Você não tem permissão para alterar o CPF do currículo.");
    }

    const { cpfValido, somenteNumeros } = await import("@/lib/curriculo");
    const cpf = somenteNumeros(data.cpf);
    if (!cpfValido(cpf)) throw new Error("CPF inválido.");

    const { data: atual, error: erroAtual } = await context.supabase
      .from("curriculos")
      .select("id, cpf, cliente_id")
      .eq("id", data.curriculoId)
      .single();
    if (erroAtual || !atual) throw new Error("Currículo não encontrado.");
    if (atual.cpf === cpf) return { ok: true };

    const { data: emUso, error: erroUso } = await context.supabase
      .from("curriculos")
      .select("id")
      .eq("cpf", cpf)
      .neq("id", data.curriculoId)
      .limit(1);
    if (erroUso) throw new Error("Não foi possível verificar o CPF.");
    if (emUso && emUso.length > 0) {
      throw new Error("Este CPF já está em uso por outro currículo.");
    }

    const { error: erroUpdate } = await context.supabase
      .from("curriculos")
      .update({ cpf })
      .eq("id", data.curriculoId);
    if (erroUpdate) throw new Error("Não foi possível alterar o CPF do currículo.");

    if (atual.cliente_id) {
      const { error: erroCliente } = await context.supabase
        .from("clientes")
        .update({ cpf })
        .eq("id", atual.cliente_id);
      if (erroCliente) {
        throw new Error(
          "O CPF do currículo foi alterado, mas não foi possível atualizar o cadastro do cliente.",
        );
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("whatsapp_auditoria").insert({
      usuario_id: context.userId,
      acao: "curriculo_cpf_alterado",
      detalhe: `Currículo ${data.curriculoId}`,
    });

    return { ok: true };
  });

export const enviarCurriculoWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        curriculoId: z.string().uuid(),
        telefone: z.string().min(8).max(30),
        mensagem: z.string().max(2000).optional(),
        pdfBase64: z.string().min(100),
        nomeArquivo: z.string().max(120),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { conexaoPorTelefone } = await import("@/lib/zapi.server");
    const { normalizarTelefone } = await import("@/lib/whatsapp-comum");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { enviarTextoPelaConexao, enviarMidiaPelaConexao } = await import(
      "@/lib/whatsapp/provedor.server"
    );

    const telefone = normalizarTelefone(data.telefone);
    if (!telefone) throw new Error("Telefone inválido.");

    const conexaoId = await conexaoPorTelefone(telefone);

    if (data.mensagem?.trim()) {
      await enviarTextoPelaConexao(conexaoId, { telefone, texto: data.mensagem.trim() });
    }

    const documento = data.pdfBase64.startsWith("data:")
      ? data.pdfBase64
      : `data:application/pdf;base64,${data.pdfBase64}`;

    const r = await enviarMidiaPelaConexao(conexaoId, {
      telefone,
      tipo: "documento",
      url: documento,
      nomeArquivo: data.nomeArquivo,
    });

    await supabaseAdmin.from("whatsapp_auditoria").insert({
      usuario_id: context.userId,
      acao: "curriculo_enviado_whatsapp",
      detalhe: `Currículo ${data.curriculoId} → ${telefone}${r.ok ? "" : ` (falha: ${r.erro.mensagem})`}`,
    });

    if (!r.ok) throw new Error(r.erro.mensagem);
    return { ok: true };
  });

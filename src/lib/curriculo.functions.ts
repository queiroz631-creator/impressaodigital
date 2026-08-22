import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const camposSchema = z
  .object({
    nome_completo: z.string().max(200).optional(),
    telefone_principal: z.string().max(30).optional(),
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
    objetivo_tipo: z.enum(["sugerido", "personalizado", "nao_informar"]).optional(),
    objetivo_texto: z.string().max(1000).nullish(),
    exibir_data_atualizacao: z.boolean().optional(),
  })
  .strict();

const payloadSchema = z.object({
  campos: camposSchema.optional(),
  telefones: z.array(z.object({ telefone: z.string().max(30) })).max(10).optional(),
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
    const { chamarZapi } = await import("@/lib/zapi.server");
    const { normalizarTelefone } = await import("@/lib/whatsapp-comum");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const telefone = normalizarTelefone(data.telefone);
    if (!telefone) throw new Error("Telefone inválido.");

    if (data.mensagem?.trim()) {
      await chamarZapi("send-text", {
        metodo: "POST",
        corpo: { phone: telefone, message: data.mensagem.trim() },
      });
    }

    const documento = data.pdfBase64.startsWith("data:")
      ? data.pdfBase64
      : `data:application/pdf;base64,${data.pdfBase64}`;

    const r = await chamarZapi("send-document/pdf", {
      metodo: "POST",
      corpo: { phone: telefone, document: documento, fileName: data.nomeArquivo },
    });

    await supabaseAdmin.from("whatsapp_auditoria").insert({
      usuario_id: context.userId,
      acao: "curriculo_enviado_whatsapp",
      detalhe: `Currículo ${data.curriculoId} → ${telefone}${r.ok ? "" : ` (falha: ${r.erro})`}`,
    });

    if (!r.ok) throw new Error(r.erro ?? "Não foi possível enviar o currículo.");
    return { ok: true };
  });

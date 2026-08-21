import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tokenSchema = z.object({ token: z.string().min(10).max(200) });

const opcoesSchema = z.object({
  token: z.string().min(10).max(200),
  materialId: z.string().uuid().nullish(),
  formato: z.enum(["A3", "A4", "A5"]).optional(),
  tipoServico: z.enum(["simples", "especial"]).optional(),
  copiasPorArquivo: z.number().int().min(1).max(10000).optional(),
  frenteVerso: z.boolean().optional(),
  acabamentoIds: z.array(z.string().uuid()).max(30).optional(),
  observacao: z.string().max(500).optional(),
});

/** Dados públicos do orçamento acessado pelo link (sem informações sensíveis). */
export const carregarLinkOrcamento = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    const { carregarPorToken } = await import("@/lib/link-dados.server");
    return carregarPorToken(data.token);
  });

/** Aplica as alterações permitidas e recalcula os valores pelo sistema. */
export const atualizarLinkOrcamento = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => opcoesSchema.parse(input))
  .handler(async ({ data }) => {
    const { atualizarPorToken } = await import("@/lib/link-dados.server");
    return atualizarPorToken(data);
  });

/** Cliente confirma o orçamento pelo link. */
export const confirmarLinkOrcamento = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    const { confirmarPorToken } = await import("@/lib/link-dados.server");
    return confirmarPorToken(data.token);
  });

/** Gera o link público de um orçamento (uso interno, exige login). */
export const gerarLinkOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ orcamentoId: z.string().uuid(), enviarWhatsapp: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { gerarParaOrcamento } = await import("@/lib/link-dados.server");
    return gerarParaOrcamento(data.orcamentoId, data.enviarWhatsapp === true);
  });

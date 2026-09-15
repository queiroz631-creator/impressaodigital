import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Recebe um lote de notas da base do sorteio (loja → sistema).
 * Não confirma nada: a marca da base só avança em `notas-confirmar`.
 */
const esquema = z.object({
  loteId: z.string().min(8).max(120),
  sorteioId: z.string().uuid(),
  notas: z
    .array(
      z.object({
        numero: z.string().regex(/^[\dA-Za-z-]{3,60}$/),
        valorCentavos: z.number().int().positive().max(100000000),
        origemId: z.string().max(120).nullish(),
        dataNota: z.string().max(40).nullish(),
      }),
    )
    .min(1)
    .max(500),
});

export const Route = createFileRoute("/api/public/sorteios/sync/notas-lote")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { tokenLojamixSyncValido, naoAutorizado } = await import("@/lib/sorteios-sync-token.server");
        if (!tokenLojamixSyncValido(request)) return naoAutorizado();

        const entrada = esquema.safeParse(await request.json().catch(() => null));
        if (!entrada.success) {
          return new Response("Dados inválidos", { status: 400 });
        }

        try {
          const { receberNotasLote } = await import("@/lib/sorteios-sync.server");
          const r = await receberNotasLote(entrada.data);
          return Response.json({ ok: true, ...r });
        } catch (e) {
          const mensagem = e instanceof Error ? e.message : "Erro inesperado";
          return Response.json({ ok: false, erro: mensagem }, { status: 500 });
        }
      },
    },
  },
});

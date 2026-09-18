import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Alteração de situação de notas já sincronizadas (principalmente cancelamento).
 * A nota é localizada SEMPRE por sorteio + número; `origemId` é apenas
 * referência da origem. Nenhum registro é criado ou apagado aqui.
 */
const esquema = z.object({
  loteId: z.string().min(8).max(120),
  sorteioId: z.string().uuid(),
  notas: z
    .array(
      z.object({
        numero: z.string().min(1).max(60),
        origemId: z.string().max(120).nullish(),
        clienteOrigemId: z.string().max(120).nullish(),
        situacao: z.number().int().min(0).max(99),
        canceladaEm: z.string().datetime({ offset: true }).nullish(),
      }),
    )
    .min(1)
    .max(500),
});

export const Route = createFileRoute("/api/public/sorteios/sync/notas-situacao")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { tokenLojamixSyncValido, naoAutorizado } = await import("@/lib/sorteios-sync-token.server");
        if (!tokenLojamixSyncValido(request)) return naoAutorizado();

        const entrada = esquema.safeParse(await request.json().catch(() => null));
        if (!entrada.success) return new Response("Dados inválidos", { status: 400 });

        try {
          const { registrarSituacaoNotas } = await import("@/lib/sorteios-sync.server");
          const r = await registrarSituacaoNotas(entrada.data);
          return Response.json({ ok: true, ...r });
        } catch (e) {
          const mensagem = e instanceof Error ? e.message : "Erro inesperado";
          return Response.json({ ok: false, erro: mensagem }, { status: 500 });
        }
      },
    },
  },
});

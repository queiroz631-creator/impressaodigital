import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Confirma o lote de notas: só aqui `base_sincronizada_em` avança, o evento é
 * registrado e a validação das notas pendentes DESTE sorteio é acionada.
 */
const esquema = z.object({
  loteId: z.string().min(8).max(120),
  sorteioId: z.string().uuid(),
  processadas: z.number().int().nonnegative().max(100000).optional(),
});

export const Route = createFileRoute("/api/public/sorteios/sync/notas-confirmar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { tokenLojamixSyncValido, naoAutorizado } = await import("@/lib/sorteios-sync-token.server");
        if (!tokenLojamixSyncValido(request)) return naoAutorizado();

        const entrada = esquema.safeParse(await request.json().catch(() => null));
        if (!entrada.success) return new Response("Dados inválidos", { status: 400 });

        try {
          const { confirmarNotasLote } = await import("@/lib/sorteios-sync.server");
          const r = await confirmarNotasLote(entrada.data);
          return Response.json({ ok: true, ...r });
        } catch (e) {
          const mensagem = e instanceof Error ? e.message : "Erro inesperado";
          return Response.json({ ok: false, erro: mensagem }, { status: 500 });
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Confirma até onde a API local aplicou as alterações. Só aqui o cursor avança;
 * uma falha no meio do lote mantém o último ponto confirmado.
 */
const esquema = z.object({
  consumidor: z.string().min(3).max(80),
  sequencia: z.number().int().nonnegative(),
  erro: z.string().max(500).optional(),
});

export const Route = createFileRoute("/api/public/sorteios/sync/clientes-confirmar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { tokenLojamixSyncValido, naoAutorizado } = await import("@/lib/sorteios-sync-token.server");
        if (!(await tokenLojamixSyncValido(request))) return naoAutorizado();

        const entrada = esquema.safeParse(await request.json().catch(() => null));
        if (!entrada.success) return new Response("Dados inválidos", { status: 400 });

        try {
          const { confirmarCursorClientes, registrarErroItem } =
            await import("@/lib/sorteios-sync.server");
          if (entrada.data.erro) {
            await registrarErroItem(entrada.data.sequencia + 1, entrada.data.erro);
          }
          const r = await confirmarCursorClientes({
            consumidor: entrada.data.consumidor,
            sequencia: entrada.data.sequencia,
          });
          return Response.json({ ok: true, ...r });
        } catch (e) {
          const mensagem = e instanceof Error ? e.message : "Erro inesperado";
          return Response.json({ ok: false, erro: mensagem }, { status: 500 });
        }
      },
    },
  },
});

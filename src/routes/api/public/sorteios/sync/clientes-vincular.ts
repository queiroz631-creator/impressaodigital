import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Registra a ligação permanente entre um cliente do sistema e o cadastro da
 * loja (origem_id). Marcada como alteração da LOJA para não gerar eco.
 */
const esquema = z.object({
  clienteId: z.string().uuid(),
  origemId: z.string().min(1).max(80),
});

export const Route = createFileRoute("/api/public/sorteios/sync/clientes-vincular")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { tokenLojamixSyncValido, naoAutorizado } = await import("@/lib/sorteios-sync-token.server");
        if (!(await tokenLojamixSyncValido(request))) return naoAutorizado();

        const entrada = esquema.safeParse(await request.json().catch(() => null));
        if (!entrada.success) return new Response("Dados inválidos", { status: 400 });

        try {
          const { vincularOrigemCliente } = await import("@/lib/sorteios-sync.server");
          const r = await vincularOrigemCliente(entrada.data);
          return Response.json({ ok: true, ...r });
        } catch (e) {
          const mensagem = e instanceof Error ? e.message : "Erro inesperado";
          return Response.json({ ok: false, erro: mensagem }, { status: 500 });
        }
      },
    },
  },
});

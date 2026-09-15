import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Devolve somente as alterações de clientes após o cursor confirmado.
 * O cursor NÃO avança aqui — a API local precisa confirmar depois de aplicar.
 */
const esquema = z.object({
  consumidor: z.string().min(3).max(80),
  limite: z.number().int().positive().max(500).optional(),
});

export const Route = createFileRoute("/api/public/sorteios/sync/clientes-alteracoes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { tokenLojamixSyncValido, naoAutorizado } = await import("@/lib/sorteios-sync-token.server");
        if (!tokenLojamixSyncValido(request)) return naoAutorizado();

        const entrada = esquema.safeParse(await request.json().catch(() => null));
        if (!entrada.success) return new Response("Dados inválidos", { status: 400 });

        try {
          const { lerAlteracoesClientes } = await import("@/lib/sorteios-sync.server");
          const r = await lerAlteracoesClientes({
            consumidor: entrada.data.consumidor,
            limite: entrada.data.limite ?? 100,
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

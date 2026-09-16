import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Devolve, em blocos paginados por id, os clientes elegíveis ainda sem ligação
 * com a loja (pessoa física, CPF válido, telefone válido, participação em
 * sorteio ATIVO). O marcador é só de paginação: ao fim da lista, a API local
 * o reinicia e recomeça a varredura.
 */
const esquema = z.object({
  desdeId: z.string().uuid().nullable().optional(),
  limite: z.number().int().positive().max(500).optional(),
});

export const Route = createFileRoute("/api/public/sorteios/sync/clientes-pendentes-loja")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { tokenLojamixSyncValido, naoAutorizado } = await import("@/lib/sorteios-sync-token.server");
        if (!tokenLojamixSyncValido(request)) return naoAutorizado();

        const entrada = esquema.safeParse(await request.json().catch(() => null));
        if (!entrada.success) return new Response("Dados inválidos", { status: 400 });

        try {
          const { listarClientesSemOrigem } = await import("@/lib/sorteios-sync.server");
          const r = await listarClientesSemOrigem({
            desdeId: entrada.data.desdeId ?? null,
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

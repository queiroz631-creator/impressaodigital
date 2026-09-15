import { createFileRoute } from "@tanstack/react-router";

/**
 * Sorteio ATIVO e seu período — consultado UMA vez por ciclo pela API local.
 * Devolve apenas o mínimo necessário; nenhuma configuração é exposta.
 */
export const Route = createFileRoute("/api/public/sorteios/sync/sorteio-ativo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { tokenValido, naoAutorizado } = await import("@/lib/sorteios-sync-token.server");
        if (!(await tokenValido(request))) return naoAutorizado();

        try {
          const { lerSorteioAtivoParaSync } = await import("@/lib/sorteios-sync.server");
          const sorteio = await lerSorteioAtivoParaSync();
          return Response.json({ ok: true, sorteio });
        } catch (e) {
          const mensagem = e instanceof Error ? e.message : "Erro inesperado";
          return Response.json({ ok: false, erro: mensagem }, { status: 500 });
        }
      },
    },
  },
});

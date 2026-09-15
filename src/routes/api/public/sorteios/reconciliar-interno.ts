import { createFileRoute } from "@tanstack/react-router";

/**
 * Reconciliação acionada pela rotina interna agendada (a cada 15 minutos).
 * Autenticação interna (webhook_token), separada da API do Lojamix Sync.
 * Executa exatamente a mesma função reconciliar() da rota pública.
 */
export const Route = createFileRoute("/api/public/sorteios/reconciliar-interno")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { tokenValido, naoAutorizado } = await import("@/lib/sorteios-sync-token.server");
        if (!(await tokenValido(request))) return naoAutorizado();

        try {
          const { reconciliar } = await import("@/lib/sorteios-sync.server");
          const resumo = await reconciliar();
          return Response.json({ ok: true, ...resumo });
        } catch (e) {
          const mensagem = e instanceof Error ? e.message : "Erro inesperado";
          return Response.json({ ok: false, erro: mensagem }, { status: 500 });
        }
      },
    },
  },
});

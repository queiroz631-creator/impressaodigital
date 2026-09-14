import { createFileRoute } from "@tanstack/react-router";

/**
 * Rede de segurança de baixa frequência (15 minutos).
 * O caminho normal é por evento: a confirmação do lote aciona a validação.
 * Esta rotina só recupera evento perdido, fila travada ou API desligada.
 */
export const Route = createFileRoute("/api/public/sorteios/reconciliar")({
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

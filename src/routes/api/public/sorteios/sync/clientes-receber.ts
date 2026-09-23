import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/** Recebe um lote de clientes da loja (criação/atualização). Nunca exclui. */
const esquema = z.object({
  loteId: z.string().min(8).max(120),
  clientes: z
    .array(
      z.object({
        origemId: z.string().min(1).max(120),
        nome: z.string().min(1).max(200),
        cpf: z.string().max(20).nullish(),
        telefone: z.string().max(30).nullish(),
        email: z.string().max(200).nullish(),
        dataNascimento: z.string().max(20).nullish(),
      }),
    )
    .min(1)
    .max(500),
});

export const Route = createFileRoute("/api/public/sorteios/sync/clientes-receber")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { tokenLojamixSyncValido, naoAutorizado } = await import("@/lib/sorteios-sync-token.server");
        if (!(await tokenLojamixSyncValido(request))) return naoAutorizado();

        const entrada = esquema.safeParse(await request.json().catch(() => null));
        if (!entrada.success) return new Response("Dados inválidos", { status: 400 });

        try {
          const { receberClientesLote } = await import("@/lib/sorteios-sync.server");
          const r = await receberClientesLote(entrada.data);
          return Response.json({ ok: true, ...r });
        } catch (e) {
          const mensagem = e instanceof Error ? e.message : "Erro inesperado";
          return Response.json({ ok: false, erro: mensagem }, { status: 500 });
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";

/** Endereço de webhook por conexão: o token no endereço identifica a conexão. */
export const Route = createFileRoute("/api/public/whatsapp/webhook/$token")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { processarWebhookWhatsapp } = await import("@/lib/whatsapp-webhook.server");
        return processarWebhookWhatsapp(request, params.token ?? "");
      },
      GET: async () => Response.json({ ok: true, servico: "webhook whatsapp" }),
    },
  },
});

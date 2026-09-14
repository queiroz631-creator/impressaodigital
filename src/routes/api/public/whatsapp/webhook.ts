import { createFileRoute } from "@tanstack/react-router";

/**
 * Endereço antigo do webhook (token na query). Continua válido para a conexão
 * já configurada na Z-API: o token identifica a conexão.
 */
export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        const { processarWebhookWhatsapp } = await import("@/lib/whatsapp-webhook.server");
        return processarWebhookWhatsapp(request, token);
      },
      GET: async () => Response.json({ ok: true, servico: "webhook whatsapp" }),
    },
  },
});

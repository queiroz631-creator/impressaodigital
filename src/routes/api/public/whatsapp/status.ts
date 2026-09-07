import { createFileRoute } from "@tanstack/react-router";

/**
 * Verificação periódica das publicações do Status do WhatsApp.
 * Chamada por cron com o token do webhook configurado em Configurações.
 */
export const Route = createFileRoute("/api/public/whatsapp/status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? "";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("whatsapp_config")
          .select("webhook_token")
          .limit(1)
          .maybeSingle();

        if (!token || !data?.webhook_token || token !== data.webhook_token) {
          return new Response("Não autorizado", { status: 401 });
        }

        const { processarStatusAgendados } = await import("@/lib/status-whatsapp.server");
        const r = await processarStatusAgendados();
        return Response.json({ ok: true, ...r });
      },
    },
  },
});

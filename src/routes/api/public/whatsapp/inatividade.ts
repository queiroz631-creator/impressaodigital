import { createFileRoute } from "@tanstack/react-router";

/**
 * Rotina de inatividade do bot. Deve ser chamada periodicamente (cron)
 * com o token do webhook configurado em Configurações → WhatsApp.
 */
export const Route = createFileRoute("/api/public/whatsapp/inatividade")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? "";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin.from("whatsapp_config").select("webhook_token").limit(1).maybeSingle();

        if (!token || !data?.webhook_token || token !== data.webhook_token) {
          return new Response("Não autorizado", { status: 401 });
        }

        const { verificarInatividade, drenarFilaBot } = await import("@/lib/bot.server");
        // Reforço: se algum acionamento imediato da fila falhou, as conversas
        // pendentes são atendidas aqui na próxima rodada.
        const fila = await drenarFilaBot();
        const r = await verificarInatividade();
        return Response.json({ ok: true, ...r, fila: fila.processadas });
      },
    },
  },
});

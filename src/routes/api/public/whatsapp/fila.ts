import { createFileRoute } from "@tanstack/react-router";

/**
 * Fila do atendimento automático. É acionada pelo banco assim que uma conversa
 * fica pendente (e também pela rotina de inatividade, como reforço). Roda fora
 * da requisição do provedor, então pode respeitar as esperas configuradas.
 */
export const Route = createFileRoute("/api/public/whatsapp/fila")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("whatsapp_config")
          .select("webhook_token")
          .limit(1)
          .maybeSingle();

        if (!token || !data?.webhook_token || token !== data.webhook_token) {
          return new Response("Não autorizado", { status: 401 });
        }

        const { drenarFilaBot } = await import("@/lib/bot.server");
        const r = await drenarFilaBot();
        return Response.json({ ok: true, ...r });
      },
    },
  },
});

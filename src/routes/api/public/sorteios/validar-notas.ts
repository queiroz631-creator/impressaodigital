import { createFileRoute } from "@tanstack/react-router";

/**
 * Rotina automática de validação das notas do sorteio.
 * Chamada periodicamente (cron) com o token do webhook configurado em
 * Configurações → WhatsApp. Aceita somente POST e devolve apenas o resumo.
 */
export const Route = createFileRoute("/api/public/sorteios/validar-notas")({
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

        const { validarNotasPendentes } = await import("@/lib/sorteios-validacao.server");
        const resumo = await validarNotasPendentes(100);
        return Response.json({ ok: true, ...resumo });
      },
    },
  },
});

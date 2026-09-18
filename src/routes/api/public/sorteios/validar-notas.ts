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

        // Saldo/cupons das notas válidas que ainda não foram processadas
        // (inclusive as que ficaram para trás por falha anterior).
        const { processarCuponsPendentesAtivos } = await import("@/lib/sorteios-cupons.server");
        let cupons;
        try {
          cupons = await processarCuponsPendentesAtivos(200);
        } catch (e) {
          console.error("[sorteios] falha ao processar cupons pendentes", e);
        }

        return Response.json({ ok: true, ...resumo, cupons });
      },
    },
  },
});

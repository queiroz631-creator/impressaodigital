import { createFileRoute } from "@tanstack/react-router";

/**
 * Proxy de mídia das mensagens do WhatsApp.
 *
 * As URLs devolvidas pela Z-API não são confiáveis para exibição direta no
 * navegador (CORS/expiração), então o arquivo é buscado no servidor e
 * repassado ao cliente. Use `?download=1` para forçar o download.
 */
export const Route = createFileRoute("/api/public/whatsapp/midia")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        const baixar = url.searchParams.get("download") === "1";
        if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
          return new Response("Parâmetro inválido", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("whatsapp_mensagens")
          .select("arquivo_url, arquivo_nome, mime_type")
          .eq("id", id)
          .maybeSingle();

        if (error || !data?.arquivo_url) {
          return new Response("Arquivo não encontrado", { status: 404 });
        }

        const origem = await fetch(data.arquivo_url);
        if (!origem.ok || !origem.body) {
          return new Response("Falha ao obter o arquivo", { status: 502 });
        }

        const nome = (data.arquivo_nome ?? "arquivo").replace(/["\\\r\n]/g, "");
        const tipo = data.mime_type ?? origem.headers.get("content-type") ?? "application/octet-stream";

        return new Response(origem.body, {
          headers: {
            "Content-Type": tipo,
            "Cache-Control": "private, max-age=3600",
            "Content-Disposition": `${baixar ? "attachment" : "inline"}; filename="${nome}"`,
          },
        });
      },
    },
  },
});

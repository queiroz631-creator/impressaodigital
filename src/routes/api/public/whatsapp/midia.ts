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

        // Mídia que o provedor não entrega por URL (Evolution): baixada pela conexão.
        const { lerUrlMidiaProvedor } = await import("@/lib/whatsapp/providers/evolution-ids");
        if (lerUrlMidiaProvedor(data.arquivo_url)) {
          const { obterBytesDaMidia } = await import("@/lib/whatsapp/midia.server");
          const { montarContentDisposition } = await import("@/lib/whatsapp/content-disposition");
          const m = await obterBytesDaMidia(data.arquivo_url);
          if (!m.ok) return new Response("Falha ao obter o arquivo", { status: 502 });
          return new Response(m.bytes as unknown as BodyInit, {
            headers: {
              "Content-Type": data.mime_type ?? m.mime ?? "application/octet-stream",
              "Cache-Control": "private, max-age=3600",
              // O nome vem do provedor e pode ter acento em Unicode decomposto,
              // o que quebraria o header (ByteString). O helper normaliza.
              "Content-Disposition": montarContentDisposition(
                baixar ? "attachment" : "inline",
                data.arquivo_nome,
              ),
            },
          });
        }

        const origem = await fetch(data.arquivo_url);
        if (!origem.ok || !origem.body) {
          return new Response("Falha ao obter o arquivo", { status: 502 });
        }

        const { montarContentDisposition } = await import("@/lib/whatsapp/content-disposition");
        const tipo =
          data.mime_type ?? origem.headers.get("content-type") ?? "application/octet-stream";

        return new Response(origem.body, {
          headers: {
            "Content-Type": tipo,
            "Cache-Control": "private, max-age=3600",
            "Content-Disposition": montarContentDisposition(
              baixar ? "attachment" : "inline",
              data.arquivo_nome,
            ),
          },
        });
      },
    },
  },
});

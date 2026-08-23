import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { normalizarTelefone } from "@/lib/whatsapp-comum";

const corpoSchema = z
  .object({
    phone: z.string().optional(),
    connectedPhone: z.string().optional(),
    senderName: z.string().optional(),
    chatName: z.string().optional(),
    messageId: z.string().optional(),
    fromMe: z.boolean().optional(),
    isStatusReply: z.boolean().optional(),
    type: z.string().optional(),
    text: z.object({ message: z.string().optional() }).partial().optional(),
    image: z.object({ imageUrl: z.string().optional(), caption: z.string().optional(), mimeType: z.string().optional() }).partial().optional(),
    document: z
      .object({
        documentUrl: z.string().optional(),
        fileName: z.string().optional(),
        mimeType: z.string().optional(),
        caption: z.string().optional(),
        pageCount: z.number().optional(),
      })
      .partial()
      .optional(),
    audio: z.object({ audioUrl: z.string().optional(), mimeType: z.string().optional() }).partial().optional(),
    location: z.object({ latitude: z.number().optional(), longitude: z.number().optional(), address: z.string().optional() }).partial().optional(),
    buttonsResponseMessage: z.object({ message: z.string().optional(), buttonId: z.string().optional() }).partial().optional(),
    listResponseMessage: z.object({ message: z.string().optional(), title: z.string().optional() }).partial().optional(),
  })
  .passthrough();

function extrair(corpo: z.infer<typeof corpoSchema>) {
  if (corpo.text?.message) return { tipo: "texto", texto: corpo.text.message, url: null as string | null, nome: null as string | null, mime: null as string | null };
  if (corpo.image?.imageUrl)
    return { tipo: "imagem", texto: corpo.image.caption ?? "", url: corpo.image.imageUrl, nome: "imagem.jpg", mime: corpo.image.mimeType ?? "image/jpeg" };
  if (corpo.document?.documentUrl)
    return {
      tipo: "documento",
      texto: corpo.document.caption ?? corpo.document.fileName ?? "",
      url: corpo.document.documentUrl,
      nome: corpo.document.fileName ?? "arquivo",
      mime: corpo.document.mimeType ?? "application/octet-stream",
    };
  if (corpo.audio?.audioUrl) return { tipo: "audio", texto: "", url: corpo.audio.audioUrl, nome: "audio.ogg", mime: corpo.audio.mimeType ?? "audio/ogg" };
  if (corpo.location)
    return {
      tipo: "localizacao",
      texto: corpo.location.address ?? `${corpo.location.latitude ?? ""}, ${corpo.location.longitude ?? ""}`,
      url: null,
      nome: null,
      mime: null,
    };
  if (corpo.buttonsResponseMessage?.message)
    return { tipo: "botao", texto: corpo.buttonsResponseMessage.message, url: null, nome: null, mime: null };
  if (corpo.listResponseMessage?.message)
    return { tipo: "botao", texto: corpo.listResponseMessage.message, url: null, nome: null, mime: null };
  return { tipo: "desconhecido", texto: "", url: null, nome: null, mime: null };
}

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        if (!token) return new Response("Token ausente", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: config } = await supabaseAdmin
          .from("whatsapp_config")
          .select("id, webhook_token")
          .limit(1)
          .maybeSingle();

        if (!config?.webhook_token || config.webhook_token !== token) {
          return new Response("Token inválido", { status: 401 });
        }

        let corpo: z.infer<typeof corpoSchema>;
        try {
          corpo = corpoSchema.parse(await request.json());
        } catch {
          return new Response("Payload inválido", { status: 400 });
        }

        if (corpo.fromMe || corpo.isStatusReply) return Response.json({ ok: true, ignorado: true });

        // A Z-API envia vários tipos de callback (entrega, status, presença).
        // Só o "ReceivedCallback" é mensagem de cliente; o resto causaria laço.
        if (corpo.type && corpo.type !== "ReceivedCallback") {
          return Response.json({ ok: true, ignorado: true, motivo: corpo.type });
        }

        const telefone = normalizarTelefone(corpo.phone);
        if (!telefone) return Response.json({ ok: true, ignorado: true });

        const nomeContato = corpo.senderName || corpo.chatName || null;
        const conteudo = extrair(corpo);
        const agora = new Date().toISOString();

        // Callback sem conteúdo reconhecível não deve acionar o bot.
        if (conteudo.tipo === "desconhecido") {
          return Response.json({ ok: true, ignorado: true, motivo: "sem_conteudo" });
        }

        // Evita reprocessar a mesma mensagem quando a Z-API reenvia o callback.
        if (corpo.messageId) {
          const { data: jaExiste } = await supabaseAdmin
            .from("whatsapp_mensagens")
            .select("id")
            .eq("whatsapp_message_id", corpo.messageId)
            .maybeSingle();
          if (jaExiste?.id) return Response.json({ ok: true, ignorado: true, motivo: "duplicada" });
        }

        // Cliente
        const { data: clienteExistente } = await supabaseAdmin
          .from("clientes")
          .select("id, nome")
          .eq("telefone_normalizado", telefone)
          .maybeSingle();

        let clienteId = clienteExistente?.id ?? null;
        if (!clienteId) {
          const { data: novo } = await supabaseAdmin
            .from("clientes")
            .insert({ nome: nomeContato ?? "", telefone, telefone_normalizado: telefone })
            .select("id")
            .maybeSingle();
          clienteId = novo?.id ?? null;
        }

        // Conversa aberta
        const { data: conversaAberta } = await supabaseAdmin
          .from("whatsapp_conversas")
          .select("id, total_mensagens, nao_lidas")
          .eq("telefone", telefone)
          .neq("status", "finalizado")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let conversaId = conversaAberta?.id ?? null;
        let totalMensagens = conversaAberta?.total_mensagens ?? 0;
        let naoLidas = conversaAberta?.nao_lidas ?? 0;

        if (!conversaId) {
          const { data: nova } = await supabaseAdmin
            .from("whatsapp_conversas")
            .insert({
              telefone,
              cliente_id: clienteId,
              nome_contato: nomeContato,
              status: "automatico",
              etapa: "inicio",
            })
            .select("id")
            .maybeSingle();
          conversaId = nova?.id ?? null;
          totalMensagens = 0;
          naoLidas = 0;
        }

        if (!conversaId) return new Response("Falha ao registrar a conversa", { status: 500 });

        const { data: mensagem } = await supabaseAdmin
          .from("whatsapp_mensagens")
          .insert({
            conversa_id: conversaId,
            whatsapp_message_id: corpo.messageId ?? null,
            direcao: "entrada",
            autor: nomeContato,
            tipo: conteudo.tipo,
            texto: conteudo.texto,
            arquivo_url: conteudo.url,
            arquivo_nome: conteudo.nome,
            mime_type: conteudo.mime,
            payload: JSON.parse(JSON.stringify(corpo)) as never,
            status: "recebida",
            data_hora: agora,
          })
          .select("id")
          .maybeSingle();

        // Guarda o arquivo recebido no bucket privado.
        if (conteudo.url && (conteudo.tipo === "documento" || conteudo.tipo === "imagem")) {
          try {
            const resposta = await fetch(conteudo.url);
            if (resposta.ok) {
              const bytes = new Uint8Array(await resposta.arrayBuffer());
              const caminho = `${conversaId}/${Date.now()}-${(conteudo.nome ?? "arquivo").replace(/[^\w.-]+/g, "_")}`;
              const { error: erroUpload } = await supabaseAdmin.storage
                .from("whatsapp")
                .upload(caminho, bytes, { contentType: conteudo.mime ?? "application/octet-stream", upsert: true });

              if (!erroUpload) {
                await supabaseAdmin
                  .from("whatsapp_mensagens")
                  .update({ arquivo_path: caminho })
                  .eq("id", mensagem?.id ?? "");

                await supabaseAdmin.from("whatsapp_arquivos").insert({
                  conversa_id: conversaId,
                  mensagem_id: mensagem?.id ?? null,
                  cliente_id: clienteId,
                  nome: conteudo.nome ?? "arquivo",
                  tipo: (conteudo.nome ?? "").split(".").pop()?.toUpperCase() ?? conteudo.tipo.toUpperCase(),
                  mime_type: conteudo.mime,
                  storage_path: caminho,
                  paginas: corpo.document?.pageCount ?? 1,
                  paginas_manuais: conteudo.tipo === "documento" && !corpo.document?.pageCount,
                });
              }
            }
          } catch {
            /* falha no download da mídia não invalida a mensagem */
          }
        }

        const resumo =
          conteudo.texto ||
          (conteudo.tipo === "documento"
            ? `📄 ${conteudo.nome}`
            : conteudo.tipo === "imagem"
              ? "🖼️ Imagem"
              : conteudo.tipo === "audio"
                ? "🎤 Áudio"
                : "Mensagem recebida");

        await supabaseAdmin
          .from("whatsapp_conversas")
          .update({
            cliente_id: clienteId,
            nome_contato: nomeContato,
            ultima_mensagem: resumo.slice(0, 300),
            ultima_mensagem_em: agora,
            total_mensagens: totalMensagens + 1,
            nao_lidas: naoLidas + 1,
          })
          .eq("id", conversaId);

        // Atendimento automático: responde apenas quando o bot está ativo
        // e a conversa continua no modo automático.
        try {
          const { processarBot } = await import("@/lib/bot.server");
          await processarBot(conversaId, { tipo: conteudo.tipo, texto: conteudo.texto });
        } catch (e) {
          await supabaseAdmin.from("whatsapp_auditoria").insert({
            conversa_id: conversaId,
            usuario_nome: "Bot",
            acao: "bot_erro",
            detalhe: e instanceof Error ? e.message : "Falha no atendimento automático",
          });
        }

        return Response.json({ ok: true });
      },

      GET: async () => Response.json({ ok: true, servico: "webhook whatsapp" }),
    },
  },
});

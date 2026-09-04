import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizarTelefone } from "@/lib/whatsapp-comum";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Quando alguém da loja envia mensagem pelo sistema, conversas finalizadas,
 * automáticas, aguardando resposta ou aguardando finalização passam para
 * "Em Atendimento". Pendente e já em atendimento não mudam.
 */
async function promoverParaEmAtendimento(
  supabase: SupabaseClient,
  conversaId: string,
  atendenteId: string,
  atendenteNome?: string,
) {
  const { data } = await supabase
    .from("whatsapp_conversas")
    .select("status")
    .eq("id", conversaId)
    .maybeSingle();
  const status = (data as { status?: string } | null)?.status;
  if (!status || status === "em_atendimento" || status === "pendente") return;

  await supabase
    .from("whatsapp_conversas")
    .update({
      status: "em_atendimento",
      etapa: "em_atendimento",
      atendente_id: atendenteId,
      atendente_nome: atendenteNome ?? null,
      inicio_atendimento: new Date().toISOString(),
      inatividade_avisada: false,
      inatividade_etapa: 0,
    })
    .eq("id", conversaId);
}

/** Verifica se a instância da Z-API está configurada e conectada. */
export const statusInstanciaZapi = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { lerCredenciaisZapi, chamarZapi } = await import("@/lib/zapi.server");

    const cred = lerCredenciaisZapi();
    if (!cred) {
      return { configurado: false, conectado: false, detalhe: "Credenciais da Z-API não configuradas." };
    }

    const r = await chamarZapi("status");
    if (!r.ok) {
      return { configurado: true, conectado: false, detalhe: r.erro ?? "Não foi possível consultar o status." };
    }

    const dados = (r.dados ?? {}) as { connected?: boolean; smartphoneConnected?: boolean; error?: string };
    return {
      configurado: true,
      conectado: Boolean(dados.connected),
      detalhe: dados.error ?? (dados.connected ? "Instância conectada." : "Instância desconectada — leia o QR Code."),
    };
  });

/** Ativa na Z-API o envio ao webhook das mensagens digitadas no celular/Web. */
export const ativarMensagensEnviadasPorMim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: ehAdmin, error: erroPermissao } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (erroPermissao || !ehAdmin) {
      return { ok: false as const, erro: "Somente administradores podem alterar a integração." };
    }

    const { chamarZapi } = await import("@/lib/zapi.server");
    const resposta = await chamarZapi("update-notify-sent-by-me", {
      metodo: "PUT",
      corpo: { notifySentByMe: true },
    });

    if (!resposta.ok) {
      return {
        ok: false as const,
        erro: resposta.erro ?? "Não foi possível ativar as mensagens enviadas pelo celular.",
      };
    }

    const dados = resposta.dados as { value?: boolean } | null;
    if (dados?.value === false) {
      return { ok: false as const, erro: "A Z-API não confirmou a ativação." };
    }

    return { ok: true as const, erro: null };
  });

/** Envia uma mensagem de texto e registra na conversa. */
export const enviarTextoWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        conversaId: z.string().uuid().optional(),
        telefone: z.string().min(8).max(30),
        mensagem: z.string().min(1).max(4000),
        autor: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { chamarZapi } = await import("@/lib/zapi.server");

    const telefone = normalizarTelefone(data.telefone);
    if (!telefone) throw new Error("Telefone inválido.");

    const r = await chamarZapi("send-text", { metodo: "POST", corpo: { phone: telefone, message: data.mensagem } });

    if (data.conversaId) {
      const idMensagem =
        r.dados && typeof r.dados === "object" && "messageId" in r.dados
          ? String((r.dados as { messageId: unknown }).messageId)
          : null;

      await context.supabase.from("whatsapp_mensagens").insert({
        conversa_id: data.conversaId,
        direcao: "saida",
        tipo: "texto",
        texto: data.mensagem,
        autor: data.autor ?? "Atendente",
        status: r.ok ? "enviada" : "erro",
        erro: r.ok ? null : (r.erro ?? "Falha no envio"),
        whatsapp_message_id: idMensagem,
      });

      if (r.ok) {
        await context.supabase
          .from("whatsapp_conversas")
          .update({ ultima_mensagem: data.mensagem, ultima_mensagem_em: new Date().toISOString() })
          .eq("id", data.conversaId);
        await promoverParaEmAtendimento(context.supabase, data.conversaId, context.userId, data.autor);
      }
    }

    if (!r.ok) return { ok: false as const, erro: r.erro ?? "Falha ao enviar a mensagem." };
    return { ok: true as const, erro: null };
  });

/** Mostra "digitando..." no WhatsApp do cliente enquanto o atendente escreve. */
export const enviarDigitandoWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ telefone: z.string().min(8).max(30) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { enviarPresencaDigitando } = await import("@/lib/zapi.server");
    const telefone = normalizarTelefone(data.telefone);
    if (!telefone) return { ok: false as const };
    await enviarPresencaDigitando(telefone, 4000);
    return { ok: true as const };
  });

/** Envia um documento (PDF) ou imagem em base64. */
export const enviarArquivoWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        conversaId: z.string().uuid().optional(),
        telefone: z.string().min(8).max(30),
        base64: z.string().min(10),
        nomeArquivo: z.string().min(1).max(200),
        tipo: z.enum(["pdf", "imagem"]),
        legenda: z.string().max(1000).optional(),
        autor: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { chamarZapi } = await import("@/lib/zapi.server");

    const telefone = normalizarTelefone(data.telefone);
    if (!telefone) throw new Error("Telefone inválido.");

    const conteudo = data.base64.startsWith("data:")
      ? data.base64
      : `data:${data.tipo === "pdf" ? "application/pdf" : "image/png"};base64,${data.base64}`;

    const r =
      data.tipo === "pdf"
        ? await chamarZapi("send-document/pdf", {
            metodo: "POST",
            corpo: { phone: telefone, document: conteudo, fileName: data.nomeArquivo, caption: data.legenda ?? "" },
          })
        : await chamarZapi("send-image", {
            metodo: "POST",
            corpo: { phone: telefone, image: conteudo, caption: data.legenda ?? "" },
          });

    if (data.conversaId) {
      await context.supabase.from("whatsapp_mensagens").insert({
        conversa_id: data.conversaId,
        direcao: "saida",
        tipo: data.tipo === "pdf" ? "documento" : "imagem",
        texto: data.legenda ?? data.nomeArquivo,
        arquivo_nome: data.nomeArquivo,
        autor: data.autor ?? "Atendente",
        status: r.ok ? "enviada" : "erro",
        erro: r.ok ? null : (r.erro ?? "Falha no envio"),
      });

      if (r.ok) {
        await promoverParaEmAtendimento(context.supabase, data.conversaId, context.userId, data.autor);
      }
    }

    if (!r.ok) return { ok: false as const, erro: r.erro ?? "Falha ao enviar o arquivo." };
    return { ok: true as const, erro: null };
  });

/** Move a conversa para "Aguardando Finalização" e dispara o fluxo de finalização. */
export const enviarParaFinalizacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        conversaId: z.string().uuid(),
        atendente: z.string().max(120).optional(),
        fluxoId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { iniciarFinalizacao } = await import("@/lib/bot.server");
    const r = await iniciarFinalizacao(data.conversaId, data.fluxoId ?? null);
    if (!r.ok) return { ok: false, fluxo: false, erro: "Conversa não encontrada." };

    await context.supabase.from("whatsapp_auditoria").insert({
      conversa_id: data.conversaId,
      usuario_id: context.userId,
      usuario_nome: data.atendente ?? null,
      acao: "aguardando_finalizacao",
      detalhe: r.fluxo ? "fluxo de finalização iniciado" : "sem fluxo de finalização configurado",
    });

    return { ok: true, fluxo: r.fluxo, erro: null as string | null };
  });

/** Transcreve o áudio de uma mensagem (sob demanda) e grava o texto na mensagem. */
export const transcreverAudioWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ mensagemId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: msg } = await context.supabase
      .from("whatsapp_mensagens")
      .select("id, transcricao, arquivo_url, mime_type")
      .eq("id", data.mensagemId)
      .maybeSingle();

    if (!msg?.arquivo_url) return { ok: false as const, texto: null, erro: "Áudio não encontrado." };
    if (msg.transcricao) return { ok: true as const, texto: msg.transcricao, erro: null as string | null };

    const resposta = await fetch(msg.arquivo_url);
    if (!resposta.ok) return { ok: false as const, texto: null, erro: "Não foi possível baixar o áudio." };

    const buffer = Buffer.from(await resposta.arrayBuffer());
    if (buffer.length > 18 * 1024 * 1024) {
      return { ok: false as const, texto: null, erro: "Áudio muito grande para transcrever." };
    }

    const formato = ((msg.mime_type ?? "audio/ogg").split("/")[1] ?? "ogg").split(";")[0] || "ogg";
    const chave = process.env["LOVABLE_API_KEY"];
    if (!chave) return { ok: false as const, texto: null, erro: "Serviço de IA não configurado." };

    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` },
        body: JSON.stringify({
          // Modelo que aceita áudio OGG/Opus (formato dos áudios do WhatsApp).
          model: "google/gemini-3.7-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Transcreva exatamente o que foi dito neste áudio (português). Responda somente com a transcrição, sem comentários.",
                },
                { type: "input_audio", input_audio: { data: buffer.toString("base64"), format: formato } },
              ],
            },
          ],
        }),
      });

      if (!r.ok) {
        const detalhe = await r.text().catch(() => "");
        console.error("Falha na transcrição de áudio", r.status, detalhe.slice(0, 500));

        if (r.status === 429 || r.status >= 500) {
          return { ok: false as const, texto: null, erro: "Serviço de IA ocupado. Tente novamente em instantes." };
        }
        if (r.status === 402) {
          return { ok: false as const, texto: null, erro: "Créditos de IA insuficientes para transcrever." };
        }
        if (r.status === 403) {
          return { ok: false as const, texto: null, erro: "Transcrição bloqueada pelas configurações de IA." };
        }

        let mensagem = "";
        try {
          const j = JSON.parse(detalhe) as { error?: { message?: string }; message?: string };
          mensagem = j.error?.message ?? j.message ?? "";
        } catch {
          mensagem = "";
        }
        return {
          ok: false as const,
          texto: null,
          erro: mensagem ? `A transcrição falhou: ${mensagem}` : "A transcrição falhou. Tente novamente.",
        };
      }

      const j = (await r.json()) as { choices?: { message?: { content?: unknown } }[] };
      const conteudo = j.choices?.[0]?.message?.content;
      const texto = (typeof conteudo === "string" ? conteudo : "").trim();
      if (!texto) return { ok: false as const, texto: null, erro: "Não foi possível entender o áudio." };

      await context.supabase.from("whatsapp_mensagens").update({ transcricao: texto }).eq("id", msg.id);
      return { ok: true as const, texto, erro: null as string | null };
    } catch (e) {
      console.error("Erro ao transcrever áudio", e);
      return { ok: false as const, texto: null, erro: "A transcrição falhou. Tente novamente." };
    }

  });

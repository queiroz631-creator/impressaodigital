import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizarTelefone } from "@/lib/whatsapp-comum";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TipoMidia } from "@/lib/whatsapp/providers/tipos";

/**
 * Envio pelo provedor da conexão (fachada multiprovedor). O atendente NÃO
 * conhece Z-API nem Evolution: a conexão da conversa define por onde a
 * mensagem sai. Nunca lança — devolve `{ ok, mensagemId, erro }`.
 */
async function enviarTextoPelaConversa(
  conexaoId: string | null,
  telefone: string,
  texto: string,
): Promise<{ ok: boolean; mensagemId: string | null; erro: string | null }> {
  const { enviarTextoPelaConexao } = await import("@/lib/whatsapp/provedor.server");
  const r = await enviarTextoPelaConexao(conexaoId, { telefone, texto });
  return r.ok
    ? { ok: true, mensagemId: r.dados.mensagemId, erro: null }
    : { ok: false, mensagemId: null, erro: r.erro.mensagem };
}

async function enviarMidiaPelaConversa(
  conexaoId: string | null,
  telefone: string,
  midia: { tipo: TipoMidia; url: string; legenda?: string; nomeArquivo?: string | null },
): Promise<{ ok: boolean; mensagemId: string | null; erro: string | null }> {
  const { enviarMidiaPelaConexao } = await import("@/lib/whatsapp/provedor.server");
  const r = await enviarMidiaPelaConexao(conexaoId, { telefone, ...midia });
  return r.ok
    ? { ok: true, mensagemId: r.dados.mensagemId, erro: null }
    : { ok: false, mensagemId: null, erro: r.erro.mensagem };
}

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

/** Conexão de WhatsApp a que a conversa pertence (define as credenciais usadas). */
async function conexaoDaConversa(
  supabase: SupabaseClient,
  conversaId?: string | null,
): Promise<string | null> {
  if (!conversaId) return null;
  const { data } = await supabase
    .from("whatsapp_conversas")
    .select("conexao_id")
    .eq("id", conversaId)
    .maybeSingle();
  return (data as { conexao_id?: string | null } | null)?.conexao_id ?? null;
}

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
    const telefone = normalizarTelefone(data.telefone);
    if (!telefone) throw new Error("Telefone inválido.");

    // Envia pelo provedor da conexão da conversa (Z-API ou Evolution).
    const conexaoId = await conexaoDaConversa(context.supabase, data.conversaId);
    const r = await enviarTextoPelaConversa(conexaoId, telefone, data.mensagem);

    if (data.conversaId) {
      await context.supabase.from("whatsapp_mensagens").insert({
        conversa_id: data.conversaId,
        direcao: "saida",
        tipo: "texto",
        texto: data.mensagem,
        autor: data.autor ?? "Atendente",
        status: r.ok ? "enviada" : "erro",
        erro: r.ok ? null : r.erro,
        whatsapp_message_id: r.mensagemId,
      });

      if (r.ok) {
        await context.supabase
          .from("whatsapp_conversas")
          .update({ ultima_mensagem: data.mensagem, ultima_mensagem_em: new Date().toISOString() })
          .eq("id", data.conversaId);
        await promoverParaEmAtendimento(
          context.supabase,
          data.conversaId,
          context.userId,
          data.autor,
        );
      }
    }

    if (!r.ok) return { ok: false as const, erro: r.erro ?? "Falha ao enviar a mensagem." };
    return { ok: true as const, erro: null };
  });

/** Mostra "digitando..." no WhatsApp do cliente enquanto o atendente escreve. */
export const enviarDigitandoWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        telefone: z.string().min(8).max(30),
        conversaId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { enviarPresencaPelaConexao } = await import("@/lib/whatsapp/provedor.server");
    const telefone = normalizarTelefone(data.telefone);
    if (!telefone) return { ok: false as const };
    const conexaoId = await conexaoDaConversa(context.supabase, data.conversaId);
    await enviarPresencaPelaConexao(conexaoId, telefone, 4000);
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
        tipo: z.enum(["pdf", "imagem", "documento"]),
        mimeType: z.string().max(200).optional(),
        legenda: z.string().max(1000).optional(),
        autor: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const telefone = normalizarTelefone(data.telefone);
    if (!telefone) throw new Error("Telefone inválido.");

    const mimePadrao =
      data.tipo === "pdf"
        ? "application/pdf"
        : data.tipo === "imagem"
          ? "image/png"
          : (data.mimeType ?? "application/octet-stream");

    const conteudo = data.base64.startsWith("data:")
      ? data.base64
      : `data:${mimePadrao};base64,${data.base64}`;

    const conexaoId = await conexaoDaConversa(context.supabase, data.conversaId);
    const r = await enviarMidiaPelaConversa(conexaoId, telefone, {
      tipo: data.tipo === "imagem" ? "imagem" : "documento",
      url: conteudo,
      legenda: data.legenda ?? "",
      nomeArquivo: data.nomeArquivo,
    });

    if (data.conversaId) {
      await context.supabase.from("whatsapp_mensagens").insert({
        conversa_id: data.conversaId,
        direcao: "saida",
        tipo: data.tipo === "imagem" ? "imagem" : "documento",
        texto: data.legenda ?? data.nomeArquivo,
        arquivo_nome: data.nomeArquivo,
        autor: data.autor ?? "Atendente",
        status: r.ok ? "enviada" : "erro",
        erro: r.ok ? null : r.erro,
        whatsapp_message_id: r.mensagemId,
      });

      if (r.ok) {
        await promoverParaEmAtendimento(
          context.supabase,
          data.conversaId,
          context.userId,
          data.autor,
        );
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

    if (!msg?.arquivo_url)
      return { ok: false as const, texto: null, erro: "Áudio não encontrado." };
    if (msg.transcricao)
      return { ok: true as const, texto: msg.transcricao, erro: null as string | null };

    const resposta = await fetch(msg.arquivo_url);
    if (!resposta.ok)
      return { ok: false as const, texto: null, erro: "Não foi possível baixar o áudio." };

    const buffer = Buffer.from(await resposta.arrayBuffer());
    if (buffer.length > 18 * 1024 * 1024) {
      return { ok: false as const, texto: null, erro: "Áudio muito grande para transcrever." };
    }

    const formato = ((msg.mime_type ?? "audio/ogg").split("/")[1] ?? "ogg").split(";")[0] || "ogg";
    try {
      const { transcreverAudioIA } = await import("@/lib/ia-chave.server");
      const r = await transcreverAudioIA(
        "Transcreva exatamente o que foi dito neste áudio (português). Responda somente com a transcrição, sem comentários.",
        buffer.toString("base64"),
        formato,
      );

      if (r.status === 0) {
        return { ok: false as const, texto: null, erro: "Serviço de IA não configurado." };
      }

      if (r.status !== 200 || r.conteudo === null) {
        const detalhe = r.erroBruto ?? "";
        console.error("Falha na transcrição de áudio", r.status, detalhe.slice(0, 500));

        if (r.status === 429 || r.status >= 500) {
          return {
            ok: false as const,
            texto: null,
            erro: "Serviço de IA ocupado. Tente novamente em instantes.",
          };
        }
        if (r.status === 402) {
          return {
            ok: false as const,
            texto: null,
            erro: "Créditos de IA insuficientes para transcrever.",
          };
        }
        if (r.status === 403) {
          return {
            ok: false as const,
            texto: null,
            erro: "Transcrição bloqueada pelas configurações de IA.",
          };
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
          erro: mensagem
            ? `A transcrição falhou: ${mensagem}`
            : "A transcrição falhou. Tente novamente.",
        };
      }

      const texto = r.conteudo.trim();
      if (!texto)
        return { ok: false as const, texto: null, erro: "Não foi possível entender o áudio." };

      await context.supabase
        .from("whatsapp_mensagens")
        .update({ transcricao: texto })
        .eq("id", msg.id);
      return { ok: true as const, texto, erro: null as string | null };
    } catch (e) {
      console.error("Erro ao transcrever áudio", e);
      return { ok: false as const, texto: null, erro: "A transcrição falhou. Tente novamente." };
    }
  });

/** Envia uma mensagem rápida cadastrada (texto e/ou imagem salva no Storage). */
export const enviarMensagemRapidaWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        conversaId: z.string().uuid(),
        mensagemId: z.string().uuid(),
        autor: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: conversa } = await context.supabase
      .from("whatsapp_conversas")
      .select("telefone, conexao_id")
      .eq("id", data.conversaId)
      .maybeSingle();
    const telefone = normalizarTelefone((conversa as { telefone?: string } | null)?.telefone ?? "");
    if (!telefone) return { ok: false as const, erro: "Telefone da conversa não encontrado." };
    const conexaoId = (conversa as { conexao_id?: string | null } | null)?.conexao_id ?? null;

    const { data: rapida, error: errBusca } = await context.supabase
      .from("mensagens_rapidas")
      .select("id, tipo, texto, imagem_path, imagem_nome, ativo")
      .eq("id", data.mensagemId)
      .maybeSingle();
    if (errBusca) return { ok: false as const, erro: errBusca.message };
    if (!rapida || !rapida.ativo)
      return { ok: false as const, erro: "Mensagem rápida não encontrada ou inativa." };

    const texto = rapida.texto?.trim() || null;
    const comImagem = rapida.tipo !== "texto" && Boolean(rapida.imagem_path);
    if (rapida.tipo === "texto" && !texto)
      return { ok: false as const, erro: "Mensagem rápida sem texto." };
    if (rapida.tipo !== "texto" && !comImagem)
      return { ok: false as const, erro: "Mensagem rápida sem imagem." };

    let mime: string | null = null;
    let r: { ok: boolean; mensagemId: string | null; erro: string | null };
    if (comImagem) {
      const { data: blob, error: errImg } = await context.supabase.storage
        .from("mensagens-rapidas")
        .download(rapida.imagem_path as string);
      if (errImg || !blob)
        return { ok: false as const, erro: "Não foi possível ler a imagem salva." };
      mime = blob.type || "image/jpeg";
      const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
      r = await enviarMidiaPelaConversa(conexaoId, telefone, {
        tipo: "imagem",
        url: `data:${mime};base64,${base64}`,
        legenda: rapida.tipo === "texto_imagem" ? (texto ?? "") : "",
        nomeArquivo: rapida.imagem_nome,
      });
    } else {
      r = await enviarTextoPelaConversa(conexaoId, telefone, texto as string);
    }

    await context.supabase.from("whatsapp_mensagens").insert({
      conversa_id: data.conversaId,
      direcao: "saida",
      tipo: comImagem ? "imagem" : "texto",
      texto: texto ?? rapida.imagem_nome ?? "Imagem",
      arquivo_nome: comImagem ? rapida.imagem_nome : null,
      mime_type: mime,
      autor: data.autor ?? "Atendente",
      status: r.ok ? "enviada" : "erro",
      erro: r.ok ? null : r.erro,
      whatsapp_message_id: r.mensagemId,
    });

    if (r.ok) {
      await context.supabase
        .from("whatsapp_conversas")
        .update({
          ultima_mensagem: texto ?? "📷 Imagem",
          ultima_mensagem_em: new Date().toISOString(),
        })
        .eq("id", data.conversaId);
      await promoverParaEmAtendimento(
        context.supabase,
        data.conversaId,
        context.userId,
        data.autor,
      );
    }

    if (!r.ok) return { ok: false as const, erro: r.erro ?? "Falha ao enviar a mensagem rápida." };
    return { ok: true as const, erro: null as string | null };
  });

/** Edita no WhatsApp do cliente uma mensagem de texto já enviada pela loja. */
export const editarMensagemWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ mensagemId: z.string().uuid(), texto: z.string().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: msg, error } = await context.supabase
      .from("whatsapp_mensagens")
      .select(
        "id, conversa_id, direcao, tipo, texto, texto_original, apagada, whatsapp_message_id, data_hora",
      )
      .eq("id", data.mensagemId)
      .maybeSingle();
    if (error) return { ok: false as const, erro: error.message };
    if (!msg) return { ok: false as const, erro: "Mensagem não encontrada." };
    if (msg.direcao !== "saida")
      return { ok: false as const, erro: "Só é possível editar mensagens enviadas pela loja." };
    if (msg.tipo !== "texto")
      return { ok: false as const, erro: "Só é possível editar mensagens de texto." };
    if (msg.apagada) return { ok: false as const, erro: "Esta mensagem já foi apagada." };
    if (!msg.whatsapp_message_id)
      return { ok: false as const, erro: "Mensagem sem identificação no WhatsApp." };

    const { data: conversa } = await context.supabase
      .from("whatsapp_conversas")
      .select("telefone, ultima_mensagem_em, conexao_id")
      .eq("id", msg.conversa_id)
      .maybeSingle();
    const telefone = normalizarTelefone((conversa as { telefone?: string } | null)?.telefone ?? "");
    if (!telefone) return { ok: false as const, erro: "Telefone da conversa não encontrado." };
    const conexaoId = (conversa as { conexao_id?: string | null } | null)?.conexao_id ?? null;

    const { editarMensagemPelaConexao, apagarMensagemPelaConexao, enviarTextoPelaConexao } =
      await import("@/lib/whatsapp/provedor.server");
    const { obterProvedorDaConexao } = await import("@/lib/whatsapp/providers/registro.server");

    // Provedores com edição nativa (Evolution) editam no lugar; os demais
    // (Z-API) não têm edição: apagamos a original e reenviamos o texto.
    const provedor = await obterProvedorDaConexao(conexaoId);
    const editaNativo = provedor.ok && provedor.dados.capacidades.editarMensagem;

    let novoId: string | null = null;

    if (editaNativo) {
      const rEditar = await editarMensagemPelaConexao(conexaoId, {
        telefone,
        mensagemId: msg.whatsapp_message_id,
        texto: data.texto,
      });
      if (!rEditar.ok) {
        return { ok: false as const, erro: rEditar.erro.mensagem };
      }
      novoId = msg.whatsapp_message_id;
    } else {
      const rApagar = await apagarMensagemPelaConexao(conexaoId, {
        telefone,
        mensagemId: msg.whatsapp_message_id,
      });
      if (!rApagar.ok) {
        return {
          ok: false as const,
          erro:
            rApagar.erro.mensagem ||
            "O WhatsApp recusou apagar a mensagem original (o prazo pode ter expirado).",
        };
      }

      const r = await enviarTextoPelaConexao(conexaoId, { telefone, texto: data.texto });
      if (!r.ok) {
        await context.supabase
          .from("whatsapp_mensagens")
          .update({ apagada: true, apagada_em: new Date().toISOString() })
          .eq("id", msg.id);
        return {
          ok: false as const,
          erro:
            r.erro.mensagem ||
            "A mensagem antiga foi apagada, mas o texto corrigido não pôde ser enviado.",
        };
      }
      novoId = r.dados.mensagemId;
    }

    await context.supabase
      .from("whatsapp_mensagens")
      .update({
        texto: data.texto,
        texto_original: msg.texto_original ?? msg.texto,
        editada: true,
        editada_em: new Date().toISOString(),
        whatsapp_message_id: novoId ?? msg.whatsapp_message_id,
      })
      .eq("id", msg.id);

    const ultimaEm = (conversa as { ultima_mensagem_em?: string | null } | null)
      ?.ultima_mensagem_em;
    if (!ultimaEm || !msg.data_hora || new Date(msg.data_hora) >= new Date(ultimaEm)) {
      await context.supabase
        .from("whatsapp_conversas")
        .update({ ultima_mensagem: data.texto })
        .eq("id", msg.conversa_id);
    }

    await context.supabase.from("whatsapp_auditoria").insert({
      conversa_id: msg.conversa_id,
      usuario_id: context.userId,
      acao: "mensagem_editada",
      detalhe: data.texto.slice(0, 200),
    });

    return { ok: true as const, erro: null as string | null };
  });

/** Reenvia uma mensagem da loja que ficou com erro, sem duplicar o histórico. */
export const reenviarMensagemWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ mensagemId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: msg, error } = await context.supabase
      .from("whatsapp_mensagens")
      .select(
        "id, conversa_id, direcao, tipo, texto, apagada, status, arquivo_url, arquivo_nome, mime_type",
      )
      .eq("id", data.mensagemId)
      .maybeSingle();
    if (error) return { ok: false as const, erro: error.message };
    if (!msg) return { ok: false as const, erro: "Mensagem não encontrada." };
    if (msg.direcao !== "saida")
      return { ok: false as const, erro: "Só é possível reenviar mensagens enviadas pela loja." };
    if (msg.apagada) return { ok: false as const, erro: "Esta mensagem foi apagada." };
    if (msg.status !== "erro")
      return { ok: false as const, erro: "Esta mensagem não está com erro." };

    const { data: conversa } = await context.supabase
      .from("whatsapp_conversas")
      .select("telefone, conexao_id")
      .eq("id", msg.conversa_id)
      .maybeSingle();
    const telefone = normalizarTelefone((conversa as { telefone?: string } | null)?.telefone ?? "");
    if (!telefone) return { ok: false as const, erro: "Telefone da conversa não encontrado." };
    const conexaoId = (conversa as { conexao_id?: string | null } | null)?.conexao_id ?? null;

    let r: { ok: boolean; mensagemId: string | null; erro: string | null };
    if (msg.tipo === "texto") {
      const texto = (msg.texto ?? "").trim();
      if (!texto) return { ok: false as const, erro: "Mensagem sem texto para reenviar." };
      r = await enviarTextoPelaConversa(conexaoId, telefone, texto);
    } else {
      if (!msg.arquivo_url) {
        return {
          ok: false as const,
          erro: "Não é possível reenviar: o conteúdo do arquivo não está salvo.",
        };
      }
      const resposta = await fetch(msg.arquivo_url);
      if (!resposta.ok)
        return { ok: false as const, erro: "Não foi possível ler o arquivo salvo." };
      const buffer = Buffer.from(await resposta.arrayBuffer());
      if (buffer.length > 18 * 1024 * 1024)
        return { ok: false as const, erro: "Arquivo muito grande para reenviar." };
      const mime = msg.mime_type ?? "application/octet-stream";
      const conteudo = `data:${mime};base64,${buffer.toString("base64")}`;
      r = await enviarMidiaPelaConversa(conexaoId, telefone, {
        tipo: msg.tipo === "imagem" ? "imagem" : "documento",
        url: conteudo,
        legenda: "",
        nomeArquivo: msg.arquivo_nome,
      });
    }

    if (r.ok) {
      await context.supabase
        .from("whatsapp_mensagens")
        .update({
          status: "enviada",
          erro: null,
          whatsapp_message_id: r.mensagemId,
        })
        .eq("id", msg.id);
      await context.supabase
        .from("whatsapp_conversas")
        .update({
          ultima_mensagem: msg.texto ?? msg.arquivo_nome ?? "Mensagem",
          ultima_mensagem_em: new Date().toISOString(),
        })
        .eq("id", msg.conversa_id);
      await promoverParaEmAtendimento(context.supabase, msg.conversa_id, context.userId);
      return { ok: true as const, erro: null as string | null };
    }

    const erro = r.erro ?? "Falha ao reenviar a mensagem.";
    await context.supabase
      .from("whatsapp_mensagens")
      .update({ erro })
      .eq("id", msg.id);
    return { ok: false as const, erro };
  });

/** Apaga no WhatsApp do cliente uma mensagem enviada pela loja (mantém no histórico). */
export const apagarMensagemWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ mensagemId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: msg, error } = await context.supabase
      .from("whatsapp_mensagens")
      .select("id, conversa_id, direcao, apagada, whatsapp_message_id, data_hora")
      .eq("id", data.mensagemId)
      .maybeSingle();
    if (error) return { ok: false as const, erro: error.message };
    if (!msg) return { ok: false as const, erro: "Mensagem não encontrada." };
    if (msg.direcao !== "saida")
      return { ok: false as const, erro: "Só é possível apagar mensagens enviadas pela loja." };
    if (msg.apagada) return { ok: true as const, erro: null as string | null };
    if (!msg.whatsapp_message_id)
      return { ok: false as const, erro: "Mensagem sem identificação no WhatsApp." };

    const { data: conversa } = await context.supabase
      .from("whatsapp_conversas")
      .select("telefone, ultima_mensagem_em, conexao_id")
      .eq("id", msg.conversa_id)
      .maybeSingle();
    const telefone = normalizarTelefone((conversa as { telefone?: string } | null)?.telefone ?? "");
    if (!telefone) return { ok: false as const, erro: "Telefone da conversa não encontrado." };

    const conexaoId = (conversa as { conexao_id?: string | null } | null)?.conexao_id ?? null;
    const { apagarMensagemPelaConexao } = await import("@/lib/whatsapp/provedor.server");
    const r = await apagarMensagemPelaConexao(conexaoId, {
      telefone,
      mensagemId: msg.whatsapp_message_id,
    });
    if (!r.ok) {
      return { ok: false as const, erro: r.erro.mensagem || "O WhatsApp recusou apagar esta mensagem." };
    }

    await context.supabase
      .from("whatsapp_mensagens")
      .update({ apagada: true, apagada_em: new Date().toISOString() })
      .eq("id", msg.id);

    const ultimaEm = (conversa as { ultima_mensagem_em?: string | null } | null)
      ?.ultima_mensagem_em;
    if (!ultimaEm || !msg.data_hora || new Date(msg.data_hora) >= new Date(ultimaEm)) {
      await context.supabase
        .from("whatsapp_conversas")
        .update({ ultima_mensagem: "Mensagem apagada" })
        .eq("id", msg.conversa_id);
    }

    await context.supabase.from("whatsapp_auditoria").insert({
      conversa_id: msg.conversa_id,
      usuario_id: context.userId,
      acao: "mensagem_apagada",
      detalhe: null,
    });

    return { ok: true as const, erro: null as string | null };
  });

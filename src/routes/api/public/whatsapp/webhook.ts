import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { normalizarTelefone } from "@/lib/whatsapp-comum";
import { dentroDaJanela, ehMensagemCortesia, lerCfgCortesia } from "@/lib/whatsapp-cortesia";

const corpoSchema = z
  .object({
    phone: z.string().nullish(),
    connectedPhone: z.string().nullish(),
    senderName: z.string().nullish(),
    chatName: z.string().nullish(),
    messageId: z.string().nullish(),
    fromMe: z.boolean().nullish(),
    isGroup: z.boolean().nullish(),
    participantPhone: z.string().nullish(),
    chatLid: z.string().nullish(),
    isStatusReply: z.boolean().nullish(),
    type: z.string().nullish(),
    text: z.object({ message: z.string().optional() }).partial().nullish(),
    image: z.object({ imageUrl: z.string().nullish(), caption: z.string().nullish(), mimeType: z.string().optional() }).partial().nullish(),
    document: z
      .object({
        documentUrl: z.string().nullish(),
        fileName: z.string().nullish(),
        mimeType: z.string().nullish(),
        caption: z.string().nullish(),
        pageCount: z.number().nullish(),
      })
      .partial()
      .nullish(),
    audio: z.object({ audioUrl: z.string().nullish(), mimeType: z.string().optional() }).partial().nullish(),
    location: z.object({ latitude: z.number().nullish(), longitude: z.number().nullish(), address: z.string().optional() }).partial().nullish(),
    buttonsResponseMessage: z.object({ message: z.string().nullish(), buttonId: z.string().optional() }).partial().nullish(),
    listResponseMessage: z.object({ message: z.string().nullish(), title: z.string().optional() }).partial().nullish(),
  })
  .passthrough();

function extrair(corpo: z.infer<typeof corpoSchema>) {
  if (corpo.text?.message) return { tipo: "texto", texto: corpo.text.message, url: null as string | null, nome: null as string | null, mime: null as string | null };
  if (corpo.image?.imageUrl)
    return { tipo: "imagem", texto: corpo.image.caption ?? "", url: corpo.image.imageUrl, nome: "imagem.jpg", mime: corpo.image.mimeType ?? "image/jpeg" };
  if (corpo.document?.documentUrl) {
    const nome = (corpo.document.fileName ?? "arquivo").trim();
    const legenda = (corpo.document.caption ?? "").trim();
    // Alguns formatos do callback repetem o nome do documento em caption.
    // Isso é metadado, não texto escrito pelo cliente.
    const texto = legenda.localeCompare(nome, undefined, { sensitivity: "accent" }) === 0 ? "" : legenda;
    return {
      // O nome do arquivo não é texto escrito pelo cliente: sem legenda o
      // documento precisa cair na regra "Somente arquivos".
      tipo: "documento",
      texto,
      url: corpo.document.documentUrl,
      nome,
      mime: corpo.document.mimeType ?? "application/octet-stream",
    };
  }
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

        let bruto: unknown;
        try {
          bruto = await request.json();
        } catch {
          return new Response("Payload inválido", { status: 400 });
        }
        // A Z-API manda campos com null e formatos novos sem aviso: nunca
        // rejeitamos o callback por causa do schema, só normalizamos.
        const analise = corpoSchema.safeParse(bruto);
        const corpo: z.infer<typeof corpoSchema> = analise.success
          ? analise.data
          : ((bruto ?? {}) as z.infer<typeof corpoSchema>);

        if (corpo.isStatusReply) return Response.json({ ok: true, ignorado: true });

        // Mensagem enviada pelo próprio número (celular/WhatsApp Web, fora do
        // sistema): é registrada como saída para o histórico ficar completo,
        // mas nunca aciona o bot nem reabre atendimento.
        const ehSaidaPropria = corpo.fromMe === true;


        // A Z-API envia vários tipos de callback (entrega, status, presença).
        // Só o "ReceivedCallback" é mensagem de cliente; o resto causaria laço.
        if (corpo.type && corpo.type !== "ReceivedCallback" && !ehSaidaPropria) {
          return Response.json({ ok: true, ignorado: true, motivo: corpo.type });
        }

        // Mensagens de grupo não são atendidas: não gravamos nem respondemos.
        const ehGrupo =
          corpo.isGroup === true ||
          Boolean(corpo.participantPhone) ||
          /@g\.us$/i.test(corpo.phone ?? "") ||
          String(corpo.phone ?? "").replace(/\D/g, "").length > 15;
        if (ehGrupo) return Response.json({ ok: true, ignorado: true, motivo: "grupo" });

        const telefone = normalizarTelefone(corpo.phone);
        if (!telefone) return Response.json({ ok: true, ignorado: true });

        // Em mensagens enviadas pelo próprio número, "senderName" é a loja:
        // o nome do contato é o do chat (o cliente).
        const nomeContato = ehSaidaPropria
          ? corpo.chatName || null
          : corpo.senderName || corpo.chatName || null;
        const conteudo = extrair(corpo);
        const agora = new Date().toISOString();

        // Quais números o bot atende é definido na tela BOT > Números.
        // "todos": responde a todos, menos os bloqueados.
        // "somente_liberados": responde apenas aos liberados e ativos.
        const [{ data: cfgBot }, { data: regraNumero }] = await Promise.all([
          supabaseAdmin.from("whatsapp_config").select("modo_numeros, ignorar_agradecimentos").limit(1).maybeSingle(),
          supabaseAdmin
            .from("bot_numeros")
            .select("permitido, ativo")
            .eq("telefone", telefone)
            .maybeSingle(),
        ]);
        const modoNumeros = cfgBot?.modo_numeros ?? "todos";
        const regraValida = regraNumero?.ativo ? regraNumero : null;
        const botLiberadoParaNumero =
          modoNumeros === "somente_liberados"
            ? Boolean(regraValida?.permitido)
            : regraValida ? regraValida.permitido : true;




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

        // Conversa do cliente (única por telefone: atendimentos são numerados dentro dela).
        // "telefone" tem UNIQUE constraint no banco: duas mensagens simultâneas do
        // mesmo cliente não podem mais criar duas conversas em paralelo. Se o INSERT
        // esbarrar na constraint (outra requisição criou a linha entre o SELECT e o
        // INSERT), a busca abaixo recupera a linha já existente.
        let conversaAberta: {
          id: string;
          total_mensagens: number | null;
          nao_lidas: number | null;
          status: string;
          atendimento_numero: number | null;
          data_finalizacao: string | null;
        } | null = null;

        for (let tentativa = 0; tentativa < 2 && !conversaAberta; tentativa += 1) {
          const { data } = await supabaseAdmin
            .from("whatsapp_conversas")
            .select("id, total_mensagens, nao_lidas, status, atendimento_numero, data_finalizacao")
            .eq("telefone", telefone)
            .maybeSingle();

          if (data) {
            conversaAberta = data;
            break;
          }

          const { error: erroNova } = await supabaseAdmin.from("whatsapp_conversas").insert({
            telefone,
            cliente_id: clienteId,
            nome_contato: nomeContato,
            status: "automatico",
            etapa: "inicio",
          });

          // 23505 = unique_violation: outra requisição concorrente já criou a
          // conversa deste telefone; a próxima volta do loop apenas a lê.
          if (erroNova && erroNova.code !== "23505") {
            return new Response("Falha ao registrar a conversa", { status: 500 });
          }
        }

        const conversaId = conversaAberta?.id ?? null;
        let totalMensagens = conversaAberta?.total_mensagens ?? 0;
        let naoLidas = conversaAberta?.nao_lidas ?? 0;

        if (!conversaId) return new Response("Falha ao registrar a conversa", { status: 500 });

        // Agradecimento/despedida logo após finalizar: registra a mensagem,
        // mas não reabre o atendimento nem aciona o bot (BOT > Inatividade).
        const cfgCortesia = lerCfgCortesia(
          (cfgBot as { ignorar_agradecimentos?: unknown } | null)?.ignorar_agradecimentos,
        );
        const cortesiaIgnorada =
          !ehSaidaPropria &&
          conversaAberta?.status === "finalizado" &&
          conteudo.tipo === "texto" &&
          cfgCortesia.ativo &&
          dentroDaJanela(conversaAberta?.data_finalizacao, cfgCortesia.janela_minutos, new Date()) &&
          ehMensagemCortesia(conteudo.texto, cfgCortesia.frases);

        if (!ehSaidaPropria && conversaAberta?.status === "finalizado" && !cortesiaIgnorada) {
          // Atendimento anterior encerrado: abre o próximo na mesma conversa.
          const numero = Number(conversaAberta.atendimento_numero ?? 1) + 1;
          await supabaseAdmin
            .from("whatsapp_conversas")
            .update({
              status: "automatico",
              etapa: "inicio",
              atendimento_numero: numero,
              contexto: {} as never,
              data_finalizacao: null,
              motivo_finalizacao: null,
              motivo_pendencia: null,
              motivo_encaminhamento: null,
              atendente_id: null,
              atendente_nome: null,
              inatividade_avisada: false,
              inatividade_etapa: 0,
            })
            .eq("id", conversaId);

          await supabaseAdmin.from("whatsapp_mensagens").insert({
            conversa_id: conversaId,
            direcao: "saida",
            tipo: "sistema",
            texto: `ATENDIMENTO ${numero}`,
            autor: "Sistema",
            status: "enviada",
            data_hora: agora,
          });
        }

        const { data: mensagem, error: erroMensagem } = await supabaseAdmin
          .from("whatsapp_mensagens")
          .insert({
            conversa_id: conversaId,
            whatsapp_message_id: corpo.messageId ?? null,
            direcao: ehSaidaPropria ? "saida" : "entrada",
            autor: ehSaidaPropria ? "Atendente (WhatsApp)" : nomeContato,
            tipo: conteudo.tipo,
            texto: conteudo.texto,
            arquivo_url: conteudo.url,
            arquivo_nome: conteudo.nome,
            mime_type: conteudo.mime,
            payload: JSON.parse(JSON.stringify(corpo)) as never,
            status: ehSaidaPropria ? "enviada" : "recebida",
            data_hora: agora,
          })
          .select("id")
          .maybeSingle();

        // O índice único é a proteção definitiva contra callbacks repetidos
        // que chegam em paralelo antes da consulta de deduplicação acima.
        if (erroMensagem?.code === "23505") {
          return Response.json({ ok: true, ignorado: true, motivo: "duplicada" });
        }
        if (erroMensagem || !mensagem?.id) {
          return new Response("Falha ao registrar a mensagem", { status: 500 });
        }

        // Registra imediatamente os metadados. A cópia da mídia para o
        // armazenamento privado é feita depois, pela rotina da fila.
        if (!ehSaidaPropria && conteudo.url && (conteudo.tipo === "documento" || conteudo.tipo === "imagem")) {
          await supabaseAdmin.from("whatsapp_arquivos").insert({
            conversa_id: conversaId,
            mensagem_id: mensagem.id,
            cliente_id: clienteId,
            nome: conteudo.nome ?? "arquivo",
            tipo: (conteudo.nome ?? "").split(".").pop()?.toUpperCase() ?? conteudo.tipo.toUpperCase(),
            mime_type: conteudo.mime,
            url: conteudo.url,
            paginas: corpo.document?.pageCount ?? 1,
            paginas_manuais: conteudo.tipo === "documento" && !corpo.document?.pageCount,
          });
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
            ...(nomeContato ? { nome_contato: nomeContato } : {}),
            ultima_mensagem: resumo.slice(0, 300),
            ultima_mensagem_em: agora,
            total_mensagens: totalMensagens + 1,
            // Resposta do atendente pelo celular não é mensagem não lida.
            nao_lidas: ehSaidaPropria ? naoLidas : naoLidas + 1,
          })
          .eq("id", conversaId);

        // Mensagem enviada fora do sistema: fica registrada no histórico e o
        // bot não é acionado.
        if (ehSaidaPropria) {
          return Response.json({ ok: true, bot: false, motivo: "enviada_fora_do_sistema" });
        }

        if (cortesiaIgnorada) {
          await supabaseAdmin.from("whatsapp_auditoria").insert({
            conversa_id: conversaId,
            usuario_nome: "Bot",
            acao: "cortesia_ignorada",
            detalhe: `Agradecimento/despedida ignorado após finalização: "${conteudo.texto.slice(0, 120)}"`,
          });
          return Response.json({ ok: true, bot: false, motivo: "cortesia_ignorada" });
        }

        // A mensagem fica registrada na conversa mesmo quando o bot não pode
        // responder ao número (configuração em BOT > Números).
        if (!botLiberadoParaNumero) {
          return Response.json({ ok: true, bot: false, motivo: "numero_desativado" });
        }
        // O atendimento automático NÃO roda dentro desta requisição: as esperas
        // configuradas (agrupamento, trava e atrasos da regra) ultrapassam o
        // tempo que o provedor mantém a conexão aberta e a execução era
        // interrompida antes do envio. Aqui apenas marcamos a conversa como
        // pendente; a rotina da fila responde e guarda a mídia com segurança.
        await supabaseAdmin
          .from("whatsapp_conversas")
          .update({ bot_pendente: true, bot_pendente_em: agora } as never)
          .eq("id", conversaId);


        return Response.json({ ok: true });
      },

      GET: async () => Response.json({ ok: true, servico: "webhook whatsapp" }),
    },
  },
});

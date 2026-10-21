/**
 * Normalização do webhook da Z-API para o modelo interno. PURA (sem I/O).
 *
 * As regras e a ORDEM das decisões foram transcritas do processamento do
 * webhook original (whatsapp-webhook.server.ts) sem alterações, para que o
 * resultado do pipeline continue idêntico.
 */

import { z } from "zod";
import { normalizarTelefone } from "@/lib/whatsapp-comum";
import type { ConteudoNormalizado, EventoNormalizado } from "./tipos";

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
    notification: z.string().nullish(),
    isEdit: z.boolean().nullish(),
    // Aviso de entrega/leitura: `ids` são as mensagens afetadas e `momment`
    // é o instante informado pela Z-API.
    ids: z.array(z.string()).nullish(),
    momment: z.number().nullish(),
    status: z.string().nullish(),
    referencedMessage: z.object({ messageId: z.string().nullish() }).partial().nullish(),
    text: z.object({ message: z.string().optional() }).partial().nullish(),
    image: z
      .object({
        imageUrl: z.string().nullish(),
        caption: z.string().nullish(),
        mimeType: z.string().optional(),
      })
      .partial()
      .nullish(),
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
    audio: z
      .object({ audioUrl: z.string().nullish(), mimeType: z.string().optional() })
      .partial()
      .nullish(),
    location: z
      .object({
        latitude: z.number().nullish(),
        longitude: z.number().nullish(),
        address: z.string().optional(),
      })
      .partial()
      .nullish(),
    buttonsResponseMessage: z
      .object({ message: z.string().nullish(), buttonId: z.string().optional() })
      .partial()
      .nullish(),
    listResponseMessage: z
      .object({ message: z.string().nullish(), title: z.string().optional() })
      .partial()
      .nullish(),
  })
  .passthrough();

type CorpoZapi = z.infer<typeof corpoSchema>;

function extrair(corpo: CorpoZapi): ConteudoNormalizado {
  if (corpo.text?.message)
    return { tipo: "texto", texto: corpo.text.message, url: null, nome: null, mime: null, paginas: null };
  if (corpo.image?.imageUrl)
    return {
      tipo: "imagem",
      texto: corpo.image.caption ?? "",
      url: corpo.image.imageUrl,
      nome: "imagem.jpg",
      mime: corpo.image.mimeType ?? "image/jpeg",
      paginas: null,
    };
  if (corpo.document?.documentUrl) {
    const nome = (corpo.document.fileName ?? "arquivo").trim();
    const legenda = (corpo.document.caption ?? "").trim();
    // Alguns formatos do callback repetem o nome do documento em caption.
    // Isso é metadado, não texto escrito pelo cliente.
    const texto =
      legenda.localeCompare(nome, undefined, { sensitivity: "accent" }) === 0 ? "" : legenda;
    return {
      // O nome do arquivo não é texto escrito pelo cliente: sem legenda o
      // documento precisa cair na regra "Somente arquivos".
      tipo: "documento",
      texto,
      url: corpo.document.documentUrl,
      nome,
      mime: corpo.document.mimeType ?? "application/octet-stream",
      paginas: corpo.document.pageCount ?? null,
    };
  }
  if (corpo.audio?.audioUrl)
    return {
      tipo: "audio",
      texto: "",
      url: corpo.audio.audioUrl,
      nome: "audio.ogg",
      mime: corpo.audio.mimeType ?? "audio/ogg",
      paginas: null,
    };
  if (corpo.location)
    return {
      tipo: "localizacao",
      texto:
        corpo.location.address ??
        `${corpo.location.latitude ?? ""}, ${corpo.location.longitude ?? ""}`,
      url: null,
      nome: null,
      mime: null,
      paginas: null,
    };
  if (corpo.buttonsResponseMessage?.message)
    return { tipo: "botao", texto: corpo.buttonsResponseMessage.message, url: null, nome: null, mime: null, paginas: null };
  if (corpo.listResponseMessage?.message)
    return { tipo: "botao", texto: corpo.listResponseMessage.message, url: null, nome: null, mime: null, paginas: null };
  return { tipo: "desconhecido", texto: "", url: null, nome: null, mime: null, paginas: null };
}

export function normalizarWebhookZapi(bruto: unknown): EventoNormalizado {
  // A Z-API manda campos com null e formatos novos sem aviso: nunca
  // rejeitamos o callback por causa do schema, só normalizamos.
  const analise = corpoSchema.safeParse(bruto);
  const corpo: CorpoZapi = analise.success ? analise.data : ((bruto ?? {}) as CorpoZapi);
  const idExterno = corpo.messageId ?? null;

  if (corpo.isStatusReply) return { tipo: "ignorado", motivo: null, idExterno };

  // Mensagem apagada (revogação): o pipeline marca como apagada no histórico.
  const ehRevogacao = String(corpo.notification ?? "")
    .toUpperCase()
    .includes("REVOKE");
  if (ehRevogacao) {
    return {
      tipo: "mensagem_revogada",
      idExterno,
      idAlvo: corpo.referencedMessage?.messageId || corpo.messageId || null,
    };
  }

  // Edição de mensagem já recebida (se não houver alvo/texto, segue como mensagem normal).
  let edicao: { idAlvo: string; novoTexto: string } | null = null;
  if (corpo.isEdit === true) {
    const alvo = corpo.referencedMessage?.messageId || corpo.messageId || null;
    const novoTexto = corpo.text?.message ?? corpo.image?.caption ?? null;
    if (alvo && novoTexto) edicao = { idAlvo: alvo, novoTexto };
  }

  const ehSaidaPropria = corpo.fromMe === true;

  // Aviso de entrega/leitura de mensagem já enviada: atualiza os tiques sem
  // acionar o bot. Nunca rebaixa (lida não volta a entregue/enviada).
  if (corpo.type === "MessageStatusCallback") {
    const st = String(corpo.status ?? "").toUpperCase();
    const novo = st === "READ" || st === "PLAYED" ? "lida" : st === "RECEIVED" ? "entregue" : null;
    const ids = (corpo.ids ?? []).filter((x): x is string => typeof x === "string");
    if (!novo || ids.length === 0) return { tipo: "ignorado", motivo: corpo.type, idExterno };
    return {
      tipo: "status_mensagem",
      ids,
      status: novo,
      quando: new Date(typeof corpo.momment === "number" ? corpo.momment : Date.now()).toISOString(),
    };
  }

  // A Z-API envia vários tipos de callback (entrega, status, presença).
  // Só o "ReceivedCallback" é mensagem de cliente; o resto causaria laço.
  if (corpo.type && corpo.type !== "ReceivedCallback" && !ehSaidaPropria) {
    const statusConexao =
      corpo.type === "ConnectedCallback"
        ? ("conectado" as const)
        : corpo.type === "DisconnectedCallback"
          ? ("desconectado" as const)
          : undefined;
    return { tipo: "ignorado", motivo: corpo.type, idExterno, edicao, ...(statusConexao ? { statusConexao } : {}) };
  }

  // Mensagens de grupo não são atendidas: não gravamos nem respondemos.
  const ehGrupo =
    corpo.isGroup === true || Boolean(corpo.participantPhone) || /@g\.us$/i.test(corpo.phone ?? "");
  if (ehGrupo) return { tipo: "ignorado", motivo: "grupo", idExterno, edicao };

  // Nas mensagens enviadas pelo próprio número o provedor manda o
  // identificador interno do chat (LID) no lugar do telefone do cliente.
  // Ele não é telefone: usar como tal criaria contato/conversa fantasma.
  const chatLid =
    (corpo.chatLid ?? (/@lid$/i.test(corpo.phone ?? "") ? corpo.phone : null)) || null;
  const lidNormalizado = chatLid ? chatLid.replace(/@.*$/, "").replace(/\D/g, "") : null;
  const phoneEhLid =
    /@lid$/i.test(corpo.phone ?? "") || String(corpo.phone ?? "").replace(/\D/g, "").length > 15;

  const telefone = phoneEhLid ? "" : normalizarTelefone(corpo.phone);
  if (!telefone && !(ehSaidaPropria && lidNormalizado)) {
    return { tipo: "ignorado", motivo: null, idExterno, edicao };
  }

  const conteudo = extrair(corpo);
  // Callback sem conteúdo reconhecível não deve acionar o bot.
  if (conteudo.tipo === "desconhecido") return { tipo: "ignorado", motivo: "sem_conteudo", idExterno, edicao };

  // Em mensagens enviadas pelo próprio número, "senderName" é a loja:
  // o nome do contato é o do chat (o cliente).
  const nomeContato = ehSaidaPropria
    ? corpo.chatName || null
    : corpo.senderName || corpo.chatName || null;

  return {
    tipo: ehSaidaPropria ? "mensagem_enviada_fora" : "mensagem_recebida",
    idExterno,
    telefone,
    lid: lidNormalizado,
    nomeContato,
    conteudo,
    edicao,
    bruto: JSON.parse(JSON.stringify(corpo)) as unknown,
  };
}

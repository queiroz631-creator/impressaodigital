/**
 * Normalização do webhook da Evolution API (v2) para o modelo interno. PURA.
 *
 * Eventos tratados (nomes em minúsculas com ponto, como a v2 envia):
 *  - messages.upsert / send.message → mensagem (recebida ou enviada pelo número)
 *  - messages.delete                → revogação
 *  - connection.update              → estado da conexão (open/close)
 *  - demais (messages.update, qrcode.updated, ...) → ignorados
 *
 * Regras equivalentes às da Z-API: grupo e status são ignorados; LID sem
 * telefone só vale para mensagens do próprio número; vídeo/sticker/contato
 * sem conteúdo reconhecível são ignorados. Os ids são prefixados por conexão
 * (ver evolution-ids.ts). Nada aqui faz I/O.
 */

import { normalizarTelefone } from "@/lib/whatsapp-comum";
import { idOriginalEvolution, prefixarIdEvolution } from "./evolution-ids";
import type { ConteudoNormalizado, ContextoWebhook, EventoNormalizado } from "./tipos";

type Obj = Record<string, unknown>;

const ehObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

const SEM_CONTEUDO: ConteudoNormalizado = { tipo: "desconhecido", texto: "", url: null, nome: null, mime: null, paginas: null };

/** Remove invólucros que o WhatsApp usa (mensagem temporária, visualização única, documento com legenda). */
function desembrulhar(mensagem: Obj): Obj {
  let atual = mensagem;
  for (let i = 0; i < 4; i += 1) {
    const interno =
      (ehObj(atual["ephemeralMessage"]) && atual["ephemeralMessage"]["message"]) ||
      (ehObj(atual["viewOnceMessage"]) && atual["viewOnceMessage"]["message"]) ||
      (ehObj(atual["viewOnceMessageV2"]) && atual["viewOnceMessageV2"]["message"]) ||
      (ehObj(atual["documentWithCaptionMessage"]) && atual["documentWithCaptionMessage"]["message"]);
    if (!ehObj(interno)) break;
    atual = interno;
  }
  return atual;
}

function extensaoDoMime(mime: string | null, padrao: string): string {
  const m = (mime ?? "").split(";")[0]!.trim().toLowerCase();
  const mapa: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
  };
  return mapa[m] ?? padrao;
}

function conteudoDe(mensagem: Obj, idOriginal: string): ConteudoNormalizado {
  const texto = str(mensagem["conversation"]);
  if (texto) return { tipo: "texto", texto, url: null, nome: null, mime: null, paginas: null };

  const estendida = ehObj(mensagem["extendedTextMessage"]) ? str(mensagem["extendedTextMessage"]["text"]) : null;
  if (estendida) return { tipo: "texto", texto: estendida, url: null, nome: null, mime: null, paginas: null };

  // Mensagem temporária ("ver uma vez"): o conteúdo real fica dentro do envelope.
  const temporaria = ehObj(mensagem["viewOnceMessage"]) ? mensagem["viewOnceMessage"] : ehObj(mensagem["viewOnceMessageV2"]) ? mensagem["viewOnceMessageV2"] : null;
  const interna = temporaria && ehObj(temporaria["message"]) ? (temporaria["message"] as Obj) : null;
  if (interna) return conteudoDe(interna, idOriginal);

  if (ehObj(mensagem["imageMessage"])) {
    const m = mensagem["imageMessage"];
    const mime = str(m["mimetype"]) ?? "image/jpeg";
    return {
      tipo: "imagem",
      texto: str(m["caption"]) ?? "",
      url: null,
      nome: `imagem.${extensaoDoMime(mime, "jpg")}`,
      mime,
      paginas: null,
      midia: { idMensagem: idOriginal },
    };
  }

  if (ehObj(mensagem["documentMessage"])) {
    const m = mensagem["documentMessage"];
    const nome = (str(m["fileName"]) ?? str(m["title"]) ?? "arquivo").trim();
    const legenda = (str(m["caption"]) ?? "").trim();
    // Mesmo tratamento da Z-API: legenda igual ao nome do arquivo é metadado.
    const textoDoc = legenda.localeCompare(nome, undefined, { sensitivity: "accent" }) === 0 ? "" : legenda;
    const paginas = typeof m["pageCount"] === "number" ? (m["pageCount"] as number) : null;
    return {
      tipo: "documento",
      texto: textoDoc,
      url: null,
      nome,
      mime: str(m["mimetype"]) ?? "application/octet-stream",
      paginas,
      midia: { idMensagem: idOriginal },
    };
  }

  if (ehObj(mensagem["audioMessage"])) {
    const m = mensagem["audioMessage"];
    const mime = str(m["mimetype"]) ?? "audio/ogg";
    return {
      tipo: "audio",
      texto: "",
      url: null,
      nome: `audio.${extensaoDoMime(mime, "ogg")}`,
      mime,
      paginas: null,
      midia: { idMensagem: idOriginal },
    };
  }

  if (ehObj(mensagem["locationMessage"])) {
    const m = mensagem["locationMessage"];
    const texto = str(m["address"]) ?? str(m["name"]) ?? `${m["degreesLatitude"] ?? ""}, ${m["degreesLongitude"] ?? ""}`;
    return { tipo: "localizacao", texto, url: null, nome: null, mime: null, paginas: null };
  }

  for (const [campo, chave] of [
    ["buttonsResponseMessage", "selectedDisplayText"],
    ["templateButtonReplyMessage", "selectedDisplayText"],
    ["listResponseMessage", "title"],
  ] as const) {
    const m = mensagem[campo];
    const t = ehObj(m) ? str(m[chave]) : null;
    if (t) return { tipo: "botao", texto: t, url: null, nome: null, mime: null, paginas: null };
  }

  return SEM_CONTEUDO;
}

/** Telefone/LID a partir do JID (e do JID alternativo que a v2.3 envia quando o principal é LID). */
function destinatario(key: Obj): { telefone: string; lid: string | null; ehGrupo: boolean; ehDifusao: boolean } {
  const jid = str(key["remoteJid"]) ?? "";
  const alt = str(key["remoteJidAlt"]) ?? str(key["senderPn"]) ?? "";
  const ehGrupo = /@g\.us$/i.test(jid);
  const ehDifusao = /@broadcast$/i.test(jid) || /^status@/i.test(jid);

  if (/@lid$/i.test(jid)) {
    const lid = jid.replace(/@.*$/, "").replace(/\D/g, "") || null;
    if (/@s\.whatsapp\.net$/i.test(alt)) {
      return { telefone: normalizarTelefone(alt.replace(/@.*$/, "")), lid, ehGrupo, ehDifusao };
    }
    return { telefone: "", lid, ehGrupo, ehDifusao };
  }

  const digitos = jid.replace(/@.*$/, "");
  // Mesma proteção da Z-API: números longos demais não são telefone.
  const longo = digitos.replace(/\D/g, "").length > 15;
  return { telefone: longo ? "" : normalizarTelefone(digitos), lid: null, ehGrupo, ehDifusao };
}

/** Versão do payload SEM dados volumosos/sensíveis (chave do servidor, base64, miniaturas, chaves de mídia). */
function payloadSeguro(corpo: Obj, data: Obj): unknown {
  const key = ehObj(data["key"]) ? data["key"] : {};
  return {
    event: corpo["event"] ?? null,
    instance: corpo["instance"] ?? null,
    data: {
      key,
      pushName: data["pushName"] ?? null,
      messageType: data["messageType"] ?? null,
      messageTimestamp: data["messageTimestamp"] ?? null,
      source: data["source"] ?? null,
    },
  };
}

function ignorado(motivo: string | null, extra: Partial<Extract<EventoNormalizado, { tipo: "ignorado" }>> = {}): EventoNormalizado {
  return { tipo: "ignorado", motivo, ...extra };
}

export function normalizarWebhookEvolution(bruto: unknown, ctx: ContextoWebhook): EventoNormalizado {
  if (!ehObj(bruto)) return ignorado(null);

  const evento = String(bruto["event"] ?? "")
    .toLowerCase()
    .replace(/_/g, ".");
  const dadosBrutos = Array.isArray(bruto["data"]) ? bruto["data"][0] : bruto["data"];
  const data: Obj = ehObj(dadosBrutos) ? dadosBrutos : {};
  const pref = (id: string) => prefixarIdEvolution(ctx.conexaoId, id);

  // ------------------------------------------------------- estado da conexão
  if (evento === "connection.update") {
    const estado = String(data["state"] ?? "").toLowerCase();
    if (estado === "open") return ignorado("connection.update", { statusConexao: "conectado" });
    if (estado === "close") return ignorado("connection.update", { statusConexao: "desconectado" });
    return ignorado("connection.update");
  }

  // ------------------------------------------------------------- revogação
  if (evento === "messages.delete") {
    const id = str(data["id"]) ?? (ehObj(data["key"]) ? str(data["key"]["id"]) : null);
    return id
      ? { tipo: "mensagem_revogada", idExterno: pref(`delete:${id}`), idAlvo: pref(id) }
      : ignorado("messages.delete");
  }

  if (evento !== "messages.upsert" && evento !== "send.message") {
    return ignorado(evento || null);
  }

  // --------------------------------------------------------------- mensagem
  const key = ehObj(data["key"]) ? data["key"] : null;
  const idOriginal = key ? str(key["id"]) : null;
  if (!key || !idOriginal) return ignorado(null);

  const idExterno = pref(idOriginal);
  const dest = destinatario(key);
  if (dest.ehDifusao) return ignorado("status", { idExterno });
  if (dest.ehGrupo) return ignorado("grupo", { idExterno });

  const mensagemBruta = ehObj(data["message"]) ? data["message"] : {};
  const mensagem = desembrulhar(mensagemBruta);

  // Revogação e edição chegam como mensagem de protocolo.
  const editada = ehObj(mensagem["editedMessage"]) && ehObj(mensagem["editedMessage"]["message"])
    ? (mensagem["editedMessage"]["message"] as Obj)
    : null;
  const protocolo = ehObj(mensagem["protocolMessage"])
    ? mensagem["protocolMessage"]
    : editada && ehObj(editada["protocolMessage"])
      ? (editada["protocolMessage"] as Obj)
      : null;

  let edicao: { idAlvo: string; novoTexto: string } | null = null;
  let mensagemConteudo = mensagem;

  if (protocolo) {
    const tipoProtocolo = String(protocolo["type"] ?? "").toUpperCase();
    const alvoKey = ehObj(protocolo["key"]) ? str(protocolo["key"]["id"]) : null;

    if ((tipoProtocolo === "REVOKE" || tipoProtocolo === "0") && alvoKey) {
      return { tipo: "mensagem_revogada", idExterno, idAlvo: pref(alvoKey) };
    }

    if ((tipoProtocolo === "MESSAGE_EDIT" || tipoProtocolo === "14") && alvoKey) {
      const novo = ehObj(protocolo["editedMessage"]) ? (protocolo["editedMessage"] as Obj) : {};
      const novoConteudo = conteudoDe(novo, idOriginal);
      if (novoConteudo.texto) {
        edicao = { idAlvo: pref(alvoKey), novoTexto: novoConteudo.texto };
        mensagemConteudo = novo;
      }
    } else {
      // Outro tipo de mensagem de protocolo (sincronização, etc.): não é mensagem de cliente.
      return ignorado("protocolMessage", { idExterno });
    }
  }

  const ehSaidaPropria = key["fromMe"] === true;

  if (!dest.telefone && !(ehSaidaPropria && dest.lid)) return ignorado(null, { idExterno, edicao });

  const conteudo = conteudoDe(mensagemConteudo, idOriginal);
  if (conteudo.tipo === "desconhecido") return ignorado("sem_conteudo", { idExterno, edicao });

  return {
    tipo: ehSaidaPropria ? "mensagem_enviada_fora" : "mensagem_recebida",
    idExterno,
    telefone: dest.telefone,
    lid: dest.lid,
    // Nas mensagens do próprio número, `pushName` é o dono da conta, não o cliente.
    nomeContato: ehSaidaPropria ? null : (str(data["pushName"]) ?? null),
    conteudo,
    edicao,
    bruto: payloadSeguro(bruto, data),
  };
}

export { idOriginalEvolution };

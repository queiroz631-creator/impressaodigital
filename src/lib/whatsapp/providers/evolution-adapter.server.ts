/**
 * Adaptador da Evolution API (v2) para a camada multiprovedor. Somente servidor.
 *
 * Endpoints validados na versão instalada (v2.3.7, servidor do cliente):
 * as rotas abaixo EXISTEM (a resposta é "instância não existe", não "Cannot POST").
 * Formatos de corpo marcados "confirmar" são validados na instância de teste.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { chamarEvolution, erroDaResposta, resolverAlvoEvolution, type AlvoEvolution } from "./evolution-cliente.server";
import { idOriginalEvolution, prefixarIdEvolution } from "./evolution-ids";
import { normalizarWebhookEvolution } from "./evolution-webhook";
import { falhaNaoSuportada } from "./erros";
import type {
  ApagarMensagem,
  CapacidadesProvedor,
  ConfigurarWebhookEntrada,
  ContextoConexao,
  ContextoWebhook,
  EditarMensagem,
  EnvioMidia,
  EnvioTexto,
  MidiaBaixada,
  ProvedorWhatsApp,
  QrCodeConexao,
  Resultado,
  ResultadoEnvio,
  ResultadoWebhook,
  StatusConexao,
} from "./tipos";

const CAPACIDADES: CapacidadesProvedor = {
  enviarTexto: true,
  enviarImagem: true,
  enviarDocumento: true,
  enviarAudio: true,
  enviarVideo: true,
  presenca: true,
  apagarMensagem: true,
  editarMensagem: true,
  publicarStatus: false,
  consultarStatus: true,
  obterQrCode: true,
  criarInstancia: true,
  desconectar: true,
  configurarWebhook: true,
  baixarMidia: true,
};

/** Cabeçalho secreto que a Evolution devolve em cada chamada de webhook. */
export const CABECALHO_SEGREDO_WEBHOOK = "x-whatsapp-webhook-secret";

const EVENTOS_WEBHOOK = [
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
  "MESSAGES_DELETE",
  "SEND_MESSAGE",
  "CONNECTION_UPDATE",
  "QRCODE_UPDATED",
] as const;

/** Tipos de mídia da Evolution (em inglês). */
const MEDIATYPE = { imagem: "image", video: "video", documento: "document", audio: "audio" } as const;

const NOME_INSTANCIA = /^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/;

// ------------------------------------------------------------------- utilitários

/** Segredo do webhook de uma conexão: HMAC(WHATSAPP_WEBHOOK_SEGREDO, webhook_token). Nunca é guardado. */
export function derivarSegredoWebhook(webhookToken: string): string | null {
  const base = process.env["WHATSAPP_WEBHOOK_SEGREDO"];
  if (!base || base.length < 16) return null;
  return createHmac("sha256", base).update(webhookToken).digest("hex");
}

function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const MIME_POR_EXTENSAO: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  zip: "application/zip",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
};

/** Separa uma data URL (base64) em mimetype + conteúdo; URL comum passa como está. */
function prepararMidia(url: string): { media: string; mimetype: string | null } {
  const m = /^data:([^;,]+)?(?:;[^,]*)?;base64,(.*)$/is.exec(url);
  return m ? { media: m[2]!, mimetype: m[1] ?? null } : { media: url, mimetype: null };
}

function somenteDigitos(telefone: string): string {
  return telefone.replace(/\D/g, "");
}

async function alvoDaInstancia(ctx: ContextoConexao): Promise<{ ok: true; alvo: AlvoEvolution; instancia: string } | { ok: false; erro: ReturnType<typeof erroDaResposta> }> {
  const r = await resolverAlvoEvolution(ctx);
  if (!r.ok) return r;
  if (!r.alvo.instancia) {
    return { ok: false, erro: { codigo: "nao_configurado", mensagem: "Instância não informada.", httpStatus: null, retentavel: false } };
  }
  return { ok: true, alvo: r.alvo, instancia: r.alvo.instancia };
}

function idDoEnvio(dados: unknown): string | null {
  if (!dados || typeof dados !== "object") return null;
  const d = dados as { key?: { id?: unknown }; id?: unknown; messageId?: unknown };
  const id = d.key?.id ?? d.messageId ?? d.id ?? null;
  return id ? String(id) : null;
}

function enc(instancia: string): string {
  return encodeURIComponent(instancia);
}

// ---------------------------------------------------------------------- adaptador

export const evolutionAdapter: ProvedorWhatsApp = {
  id: "evolution",
  capacidades: CAPACIDADES,

  normalizarWebhook(bruto: unknown, ctx: ContextoWebhook) {
    return normalizarWebhookEvolution(bruto, ctx);
  },

  autenticarWebhook(headers: Headers, ctx: ContextoWebhook): boolean {
    if (!ctx.webhookToken) return false;
    const esperado = derivarSegredoWebhook(ctx.webhookToken);
    const recebido = headers.get(CABECALHO_SEGREDO_WEBHOOK);
    if (!esperado || !recebido) return false;
    return iguais(esperado, recebido);
  },

  async enviarTexto(ctx: ContextoConexao, e: EnvioTexto): Promise<Resultado<ResultadoEnvio>> {
    const a = await alvoDaInstancia(ctx);
    if (!a.ok) return a;
    const r = await chamarEvolution(a.alvo, `message/sendText/${enc(a.instancia)}`, {
      metodo: "POST",
      corpo: { number: somenteDigitos(e.telefone), text: e.texto },
    });
    if (!r.ok) return { ok: false, erro: erroDaResposta(r, "Falha no envio") };
    const id = idDoEnvio(r.dados);
    return { ok: true, dados: { mensagemId: id && a.alvo.conexaoId ? prefixarIdEvolution(a.alvo.conexaoId, id) : id } };
  },

  async enviarMidia(ctx: ContextoConexao, e: EnvioMidia): Promise<Resultado<ResultadoEnvio>> {
    const a = await alvoDaInstancia(ctx);
    if (!a.ok) return a;
    const { media, mimetype } = prepararMidia(e.url);
    const numero = somenteDigitos(e.telefone);

    let r;
    if (e.tipo === "audio") {
      r = await chamarEvolution(a.alvo, `message/sendWhatsAppAudio/${enc(a.instancia)}`, {
        metodo: "POST",
        corpo: { number: numero, audio: media },
      });
    } else {
      const nome = e.nomeArquivo || (e.tipo === "documento" ? "documento.pdf" : undefined);
      const extensao = (nome?.split(".").pop() ?? "").toLowerCase();
      r = await chamarEvolution(a.alvo, `message/sendMedia/${enc(a.instancia)}`, {
        metodo: "POST",
        corpo: {
          number: numero,
          mediatype: MEDIATYPE[e.tipo],
          media,
          caption: e.legenda ?? "",
          ...(nome ? { fileName: nome } : {}),
          ...((mimetype ?? MIME_POR_EXTENSAO[extensao]) ? { mimetype: mimetype ?? MIME_POR_EXTENSAO[extensao] } : {}),
        },
      });
    }
    if (!r.ok) return { ok: false, erro: erroDaResposta(r, "Falha no envio") };
    const id = idDoEnvio(r.dados);
    return { ok: true, dados: { mensagemId: id && a.alvo.conexaoId ? prefixarIdEvolution(a.alvo.conexaoId, id) : id } };
  },

  async enviarPresenca(ctx: ContextoConexao, telefone: string, duracaoMs: number): Promise<Resultado<null>> {
    // Falha silenciosa por contrato (nunca interrompe o envio da mensagem).
    try {
      const a = await alvoDaInstancia(ctx);
      if (a.ok) {
        await chamarEvolution(a.alvo, `chat/sendPresence/${enc(a.instancia)}`, {
          metodo: "POST",
          corpo: { number: somenteDigitos(telefone), presence: "composing", delay: Math.min(15000, Math.max(500, Math.round(duracaoMs))) },
          timeoutMs: 8_000,
        });
      }
    } catch {
      /* presença é opcional */
    }
    return { ok: true, dados: null };
  },

  async apagarMensagem(ctx: ContextoConexao, e: ApagarMensagem): Promise<Resultado<null>> {
    const a = await alvoDaInstancia(ctx);
    if (!a.ok) return a;
    const r = await chamarEvolution(a.alvo, `chat/deleteMessageForEveryone/${enc(a.instancia)}`, {
      metodo: "DELETE",
      corpo: { id: idOriginalEvolution(e.mensagemId), remoteJid: `${somenteDigitos(e.telefone)}@s.whatsapp.net`, fromMe: true },
    });
    if (!r.ok) return { ok: false, erro: erroDaResposta(r, "O WhatsApp recusou apagar a mensagem.") };
    return { ok: true, dados: null };
  },

  async editarMensagem(ctx: ContextoConexao, e: EditarMensagem): Promise<Resultado<null>> {
    const a = await alvoDaInstancia(ctx);
    if (!a.ok) return a;
    // Corpo conforme a documentação da v2 (confirmar na instância de teste).
    const r = await chamarEvolution(a.alvo, `chat/updateMessage/${enc(a.instancia)}`, {
      metodo: "POST",
      corpo: {
        number: somenteDigitos(e.telefone),
        text: e.texto,
        key: { remoteJid: `${somenteDigitos(e.telefone)}@s.whatsapp.net`, fromMe: true, id: idOriginalEvolution(e.mensagemId) },
      },
    });
    if (!r.ok) return { ok: false, erro: erroDaResposta(r, "Não foi possível editar a mensagem.") };
    return { ok: true, dados: null };
  },

  async publicarStatus() {
    return falhaNaoSuportada("evolution", "publicarStatus", "A publicação de status exige a lista de contatos e ainda não está implementada para a Evolution.");
  },

  async consultarStatus(ctx: ContextoConexao): Promise<Resultado<StatusConexao>> {
    const a = await alvoDaInstancia(ctx);
    if (!a.ok) return a;
    const r = await chamarEvolution(a.alvo, `instance/connectionState/${enc(a.instancia)}`);
    if (!r.ok) return { ok: false, erro: erroDaResposta(r, "Não foi possível consultar o status.") };

    const d = (r.dados ?? {}) as { instance?: { state?: string }; state?: string };
    const estado = String(d.instance?.state ?? d.state ?? "").toLowerCase();
    if (estado === "open") return { ok: true, dados: { conectado: true, detalhe: "Número conectado." } };
    if (estado === "connecting") return { ok: true, dados: { conectado: false, detalhe: "Conectando — leia o QR Code, se solicitado." } };
    return { ok: true, dados: { conectado: false, detalhe: "Número desconectado — leia o QR Code para conectar." } };
  },

  async obterQrCode(ctx: ContextoConexao): Promise<Resultado<QrCodeConexao>> {
    const a = await alvoDaInstancia(ctx);
    if (!a.ok) return a;
    const r = await chamarEvolution(a.alvo, `instance/connect/${enc(a.instancia)}`);
    if (!r.ok) return { ok: false, erro: erroDaResposta(r, "Não foi possível obter o QR Code.") };

    const d = (r.dados ?? {}) as { base64?: string; pairingCode?: string | null; code?: string; instance?: { state?: string } };
    const base64 = typeof d.base64 === "string" ? d.base64.replace(/^data:[^,]*,/, "") : null;
    return {
      ok: true,
      dados: {
        qrCodeBase64: base64 || null,
        codigoPareamento: d.pairingCode || null,
        estado: d.instance?.state ?? (base64 ? "connecting" : null),
      },
    };
  },

  async criarInstancia(ctx: ContextoConexao, nome: string): Promise<Resultado<{ idExterno: string }>> {
    if (!NOME_INSTANCIA.test(nome)) {
      return {
        ok: false,
        erro: { codigo: "invalido", mensagem: "Nome de instância inválido (3–40 caracteres: letras, números, _ e -).", httpStatus: null, retentavel: false },
      };
    }
    const r0 = await resolverAlvoEvolution({ conexaoId: null, servidorId: ctx.servidorId ?? null });
    if (!r0.ok) return r0;

    const r = await chamarEvolution(r0.alvo, "instance/create", {
      metodo: "POST",
      corpo: { instanceName: nome, qrcode: true, integration: "WHATSAPP-BAILEYS" },
    });
    if (!r.ok) {
      const e = erroDaResposta(r, "Não foi possível criar a instância.");
      // Nome já usado: erro explícito e não retentável.
      return { ok: false, erro: r.status === 403 || /already|em uso|in use/i.test(r.erro ?? "") ? { ...e, codigo: "invalido", retentavel: false } : e };
    }
    // A resposta traz a chave da instância (`hash`): NÃO é lida nem guardada.
    return { ok: true, dados: { idExterno: nome } };
  },

  async desconectar(ctx: ContextoConexao): Promise<Resultado<null>> {
    const a = await alvoDaInstancia(ctx);
    if (!a.ok) return a;
    const r = await chamarEvolution(a.alvo, `instance/logout/${enc(a.instancia)}`, { metodo: "DELETE" });
    if (!r.ok) return { ok: false, erro: erroDaResposta(r, "Não foi possível desconectar.") };
    return { ok: true, dados: null };
  },

  async configurarWebhook(ctx: ContextoConexao, e: ConfigurarWebhookEntrada): Promise<Resultado<ResultadoWebhook>> {
    const a = await alvoDaInstancia(ctx);
    if (!a.ok) return a;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (e.segredo) headers[CABECALHO_SEGREDO_WEBHOOK] = e.segredo;
    const eventos = [...EVENTOS_WEBHOOK];

    // A v2 aceita o objeto aninhado em `webhook`; versões próximas usam o corpo
    // plano. Tenta o formato aninhado e, se o servidor recusar o corpo (400),
    // o plano. Em ambos, confere depois lendo a configuração gravada.
    const aninhado = { webhook: { enabled: true, url: e.url, byEvents: false, base64: false, headers, events: eventos } };
    const plano = { enabled: true, url: e.url, webhookByEvents: false, webhookBase64: false, headers, events: eventos };

    const caminho = `webhook/set/${enc(a.instancia)}`;
    let r = await chamarEvolution(a.alvo, caminho, { metodo: "POST", corpo: aninhado });
    if (!r.ok && r.status === 400) r = await chamarEvolution(a.alvo, caminho, { metodo: "POST", corpo: plano });
    if (!r.ok) return { ok: false, erro: erroDaResposta(r, "A Evolution não aceitou o webhook.") };

    const conferencia = await chamarEvolution(a.alvo, `webhook/find/${enc(a.instancia)}`);
    const gravada = conferencia.ok && conferencia.dados && typeof conferencia.dados === "object" ? (conferencia.dados as { url?: string; enabled?: boolean }) : null;
    if (!gravada || gravada.url !== e.url) {
      return {
        ok: false,
        erro: { codigo: "desconhecido", mensagem: "O webhook foi enviado, mas a conferência não encontrou o endereço gravado.", httpStatus: null, retentavel: true },
      };
    }
    return { ok: true, dados: { configurados: [...EVENTOS_WEBHOOK], falhas: [] } };
  },

  async baixarMidia(ctx: ContextoConexao, e: { idMensagem: string }): Promise<Resultado<MidiaBaixada>> {
    const a = await alvoDaInstancia(ctx);
    if (!a.ok) return a;
    const r = await chamarEvolution(a.alvo, `chat/getBase64FromMediaMessage/${enc(a.instancia)}`, {
      metodo: "POST",
      corpo: { message: { key: { id: idOriginalEvolution(e.idMensagem) } }, convertToMp4: false },
      timeoutMs: 60_000,
    });
    if (!r.ok) return { ok: false, erro: erroDaResposta(r, "Não foi possível baixar a mídia.") };

    const d = (r.dados ?? {}) as { base64?: string; mimetype?: string; fileName?: string };
    if (typeof d.base64 !== "string" || !d.base64) {
      return { ok: false, erro: { codigo: "nao_encontrado", mensagem: "A Evolution não devolveu o conteúdo da mídia.", httpStatus: null, retentavel: false } };
    }
    // Limite de segurança (~50 MB de arquivo).
    if (d.base64.length > 70_000_000) {
      return { ok: false, erro: { codigo: "invalido", mensagem: "Arquivo grande demais.", httpStatus: null, retentavel: false } };
    }
    const bytes = new Uint8Array(Buffer.from(d.base64.replace(/^data:[^,]*,/, ""), "base64"));
    return { ok: true, dados: { bytes, mime: d.mimetype ?? null, nome: d.fileName ?? null } };
  },
};

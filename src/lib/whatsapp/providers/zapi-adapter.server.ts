/**
 * Adaptador da Z-API para a camada multiprovedor. Somente servidor.
 *
 * NÃO reimplementa a Z-API: DELEGA ao cliente existente (`zapi.server.ts`),
 * com as mesmas rotas, métodos, cabeçalhos e corpos já usados em produção.
 * Assim as conexões Z-API (inclusive o fallback nas variáveis ZAPI_*) seguem
 * exatamente como estão.
 */

import { chamarZapi, enviarPresencaDigitando, type RespostaZapi } from "@/lib/zapi.server";
import { classificarFalha, falhaNaoSuportada } from "./erros";
import { normalizarWebhookZapi } from "./zapi-webhook";
import type {
  ApagarMensagem,
  CapacidadesProvedor,
  ConfigurarWebhookEntrada,
  ContextoConexao,
  EnvioMidia,
  EnvioTexto,
  ProvedorWhatsApp,
  PublicarStatusEntrada,
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
  // A Z-API não possui edição de mensagem (o sistema apaga e reenvia).
  editarMensagem: false,
  publicarStatus: true,
  consultarStatus: true,
  configurarWebhook: true,
  // Ainda não expostos pela camada multiprovedor para a Z-API (o QR Code é
  // lido no painel da Z-API, como hoje).
  obterQrCode: false,
  criarInstancia: false,
  desconectar: false,
  // As mídias da Z-API chegam por URL direta (o sistema as baixa sem o provedor).
  baixarMidia: false,
};

const CAMINHOS_WEBHOOK = [
  { gravar: "update-webhook-received", rotulo: "Ao receber" },
  { gravar: "update-webhook-delivery", rotulo: "Ao enviar" },
  { gravar: "update-webhook-message-status", rotulo: "Status da mensagem" },
  { gravar: "update-webhook-disconnected", rotulo: "Ao desconectar" },
] as const;

function falha(r: RespostaZapi, padrao: string): Resultado<never> {
  return { ok: false, erro: classificarFalha(r.status, r.erro ?? padrao) };
}

/** Identificador devolvido pela Z-API (mesma precedência usada pelo envio atual). */
function idDaResposta(dados: unknown): string | null {
  if (!dados || typeof dados !== "object") return null;
  const d = dados as { messageId?: unknown; zaapId?: unknown };
  const bruto = d.messageId ?? d.zaapId ?? null;
  return bruto ? String(bruto) : null;
}

/** Endpoint e corpo conforme o tipo de arquivo (idêntico ao do bot atual). */
function envioDeMidia(e: EnvioMidia): { caminho: string; corpo: Record<string, unknown> } {
  const legenda = e.legenda ?? "";
  switch (e.tipo) {
    case "imagem":
      return { caminho: "send-image", corpo: { phone: e.telefone, image: e.url, caption: legenda } };
    case "audio":
      return { caminho: "send-audio", corpo: { phone: e.telefone, audio: e.url } };
    case "video":
      return { caminho: "send-video", corpo: { phone: e.telefone, video: e.url, caption: legenda } };
    case "documento": {
      const arquivo = e.nomeArquivo || "documento.pdf";
      const extensao = (arquivo.split(".").pop() || "pdf").toLowerCase();
      return {
        caminho: `send-document/${extensao}`,
        corpo: { phone: e.telefone, document: e.url, fileName: arquivo, caption: legenda },
      };
    }
  }
}

export const zapiAdapter: ProvedorWhatsApp = {
  id: "zapi",
  capacidades: CAPACIDADES,

  // A Z-API não usa o contexto (ids sem prefixo, como sempre foi).
  normalizarWebhook: (bruto) => normalizarWebhookZapi(bruto),

  async enviarTexto(ctx: ContextoConexao, e: EnvioTexto): Promise<Resultado<ResultadoEnvio>> {
    const r = await chamarZapi("send-text", {
      metodo: "POST",
      corpo: { phone: e.telefone, message: e.texto },
      conexaoId: ctx.conexaoId,
    });
    if (!r.ok) return falha(r, "Falha no envio");
    return { ok: true, dados: { mensagemId: idDaResposta(r.dados) } };
  },

  async enviarMidia(ctx: ContextoConexao, e: EnvioMidia): Promise<Resultado<ResultadoEnvio>> {
    const envio = envioDeMidia(e);
    const r = await chamarZapi(envio.caminho, {
      metodo: "POST",
      corpo: envio.corpo,
      conexaoId: ctx.conexaoId,
    });
    if (!r.ok) return falha(r, "Falha no envio");
    return { ok: true, dados: { mensagemId: idDaResposta(r.dados) } };
  },

  async enviarPresenca(ctx: ContextoConexao, telefone: string, duracaoMs: number): Promise<Resultado<null>> {
    // Falha silenciosa por contrato (nunca interrompe o envio da mensagem).
    await enviarPresencaDigitando(telefone, duracaoMs, ctx.conexaoId);
    return { ok: true, dados: null };
  },

  async apagarMensagem(ctx: ContextoConexao, e: ApagarMensagem): Promise<Resultado<null>> {
    const consulta = `messages?messageId=${encodeURIComponent(e.mensagemId)}&phone=${encodeURIComponent(e.telefone)}&owner=true`;
    const r = await chamarZapi(consulta, { metodo: "DELETE", conexaoId: ctx.conexaoId });
    if (!r.ok) return falha(r, "O WhatsApp recusou apagar a mensagem.");
    return { ok: true, dados: null };
  },

  async editarMensagem(): Promise<Resultado<null>> {
    return falhaNaoSuportada("zapi", "editarMensagem", "A Z-API não possui edição de mensagem; apague e reenvie.");
  },

  async publicarStatus(ctx: ContextoConexao, e: PublicarStatusEntrada): Promise<Resultado<null>> {
    const r =
      e.tipo === "imagem"
        ? await chamarZapi("send-image-status", {
            metodo: "POST",
            corpo: { image: e.imagemUrl ?? "", caption: e.legenda ?? "" },
            conexaoId: ctx.conexaoId,
          })
        : await chamarZapi("send-text-status", {
            metodo: "POST",
            corpo: { message: e.texto ?? "", backgroundColor: e.corFundo },
            conexaoId: ctx.conexaoId,
          });
    if (!r.ok) return falha(r, "Falha ao publicar o status.");
    return { ok: true, dados: null };
  },

  async consultarStatus(ctx: ContextoConexao): Promise<Resultado<StatusConexao>> {
    const r = await chamarZapi("status", { conexaoId: ctx.conexaoId });
    if (!r.ok) return falha(r, "Não foi possível consultar o status.");
    const dados = (r.dados ?? {}) as { connected?: boolean; error?: string };
    const conectado = Boolean(dados.connected);
    return {
      ok: true,
      dados: {
        conectado,
        detalhe: dados.error ?? (conectado ? "Número conectado." : "Número desconectado — leia o QR Code na Z-API."),
      },
    };
  },

  async obterQrCode() {
    return falhaNaoSuportada("zapi", "obterQrCode", "Para a Z-API, leia o QR Code no painel da Z-API.");
  },

  async criarInstancia() {
    return falhaNaoSuportada("zapi", "criarInstancia", "As instâncias da Z-API são criadas no painel da Z-API.");
  },

  async baixarMidia() {
    return falhaNaoSuportada("zapi", "baixarMidia", "As mídias da Z-API chegam por URL direta.");
  },

  async desconectar() {
    return falhaNaoSuportada("zapi", "desconectar", "Desconecte o número no painel da Z-API.");
  },

  async configurarWebhook(ctx: ContextoConexao, e: ConfigurarWebhookEntrada): Promise<Resultado<ResultadoWebhook>> {
    const configurados: string[] = [];
    const falhas: string[] = [];
    let ultimaFalha: RespostaZapi | null = null;

    for (const c of CAMINHOS_WEBHOOK) {
      const r = await chamarZapi(c.gravar, { metodo: "PUT", corpo: { value: e.url }, conexaoId: ctx.conexaoId });
      if (r.ok) configurados.push(c.rotulo);
      else {
        falhas.push(c.rotulo);
        ultimaFalha = r;
      }
    }

    // Inclui no webhook as mensagens enviadas pelo próprio número (resultado não bloqueia).
    await chamarZapi("update-notify-sent-by-me", {
      metodo: "PUT",
      corpo: { notifySentByMe: true },
      conexaoId: ctx.conexaoId,
    });

    if (falhas.length === CAMINHOS_WEBHOOK.length && ultimaFalha) {
      return { ok: false, erro: classificarFalha(ultimaFalha.status, "A Z-API não aceitou os novos endereços.") };
    }
    return { ok: true, dados: { configurados, falhas } };
  },
};

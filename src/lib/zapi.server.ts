/** Cliente HTTP da Z-API. Somente servidor (arquivo *.server.ts). */

export interface CredenciaisZapi {
  baseUrl: string;
  instanceId: string;
  instanceToken: string;
  clientToken: string;
}

export function lerCredenciaisZapi(): CredenciaisZapi | null {
  const instanceId = process.env["ZAPI_INSTANCE_ID"];
  const instanceToken = process.env["ZAPI_INSTANCE_TOKEN"];
  const clientToken = process.env["ZAPI_CLIENT_TOKEN"];
  const baseUrl = process.env["ZAPI_BASE_URL"] || "https://api.z-api.io";

  if (!instanceId || !instanceToken || !clientToken) return null;

  return { baseUrl: baseUrl.replace(/\/+$/, ""), instanceId, instanceToken, clientToken };
}

export interface RespostaZapi {
  ok: boolean;
  status: number;
  dados: unknown;
  erro?: string;
}

/**
 * Mostra o indicador "digitando..." no WhatsApp do cliente por `duracaoMs`
 * milissegundos. Falha silenciosa: nunca interrompe o envio da mensagem.
 */
export async function enviarPresencaDigitando(telefone: string, duracaoMs: number): Promise<void> {
  const delay = Math.min(15000, Math.max(500, Math.round(duracaoMs)));
  await chamarZapi("send-presence", {
    metodo: "POST",
    corpo: { phone: telefone, presence: "composing", delay },
  }).catch(() => undefined);
}

export async function chamarZapi(
  caminho: string,
  opcoes: { metodo?: "GET" | "POST"; corpo?: unknown } = {},
): Promise<RespostaZapi> {
  const cred = lerCredenciaisZapi();
  if (!cred) {
    return { ok: false, status: 0, dados: null, erro: "Credenciais da Z-API não configuradas." };
  }

  const url = `${cred.baseUrl}/instances/${cred.instanceId}/token/${cred.instanceToken}/${caminho.replace(/^\/+/, "")}`;

  try {
    const resposta = await fetch(url, {
      method: opcoes.metodo ?? "GET",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": cred.clientToken,
      },
      ...(opcoes.corpo ? { body: JSON.stringify(opcoes.corpo) } : {}),
    });

    const texto = await resposta.text();
    let dados: unknown = texto;
    try {
      dados = texto ? JSON.parse(texto) : null;
    } catch {
      /* resposta não-JSON */
    }

    if (!resposta.ok) {
      const detalhe =
        dados && typeof dados === "object" && "error" in dados
          ? String((dados as { error: unknown }).error)
          : `HTTP ${resposta.status}`;
      return { ok: false, status: resposta.status, dados, erro: detalhe };
    }

    return { ok: true, status: resposta.status, dados };
  } catch (e) {
    return { ok: false, status: 0, dados: null, erro: e instanceof Error ? e.message : "Falha de conexão" };
  }
}

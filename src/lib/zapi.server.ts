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

/**
 * Credenciais da Z-API de uma conexão cadastrada em "Conexões".
 *
 * Uma conexão que tenha credenciais Z-API próprias usa as suas. Se a conexão
 * NÃO tiver credenciais (ou não existir), o resultado depende do provedor:
 *
 *  - conexão de OUTRO provedor (ex.: Evolution) devolve `null`: jamais caímos
 *    nas credenciais da instância principal, o que enviaria a mensagem pelo
 *    número errado;
 *  - conexão Z-API sem credenciais próprias (ou sem conexão informada) mantém
 *    o fallback para as variáveis de ambiente — comportamento histórico da
 *    conexão principal.
 */
export async function credenciaisDaConexao(
  conexaoId?: string | null,
): Promise<CredenciaisZapi | null> {
  if (!conexaoId) return lerCredenciaisZapi();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("whatsapp_conexoes")
    .select("base_url, instance_id, instance_token, client_token, provedor")
    .eq("id", conexaoId)
    .maybeSingle();

  const c = data as {
    base_url: string | null;
    instance_id: string | null;
    instance_token: string | null;
    client_token: string | null;
    provedor: string | null;
  } | null;

  const temCredenciais = Boolean(c?.instance_id && c?.instance_token && c?.client_token);
  if (temCredenciais) {
    return {
      baseUrl: (c!.base_url || "https://api.z-api.io").replace(/\/+$/, ""),
      instanceId: c!.instance_id!,
      instanceToken: c!.instance_token!,
      clientToken: c!.client_token!,
    };
  }

  // Sem credenciais próprias: só a conexão Z-API (ou inexistente) usa o
  // fallback do ambiente. Qualquer outro provedor nunca é enviado pela Z-API.
  if (c && c.provedor && c.provedor !== "zapi") return null;

  return lerCredenciaisZapi();
}

/**
 * Conexão a que pertence a conversa de um telefone. Usada quando o envio parte
 * de outra tela (orçamento, currículo) e só temos o número do cliente.
 */
export async function conexaoPorTelefone(telefone: string): Promise<string | null> {
  const numero = telefone.replace(/\D/g, "");
  if (!numero) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("whatsapp_conversas")
    .select("conexao_id")
    .eq("telefone", numero)
    .maybeSingle();

  return (data as { conexao_id?: string | null } | null)?.conexao_id ?? null;
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
export async function enviarPresencaDigitando(
  telefone: string,
  duracaoMs: number,
  conexaoId?: string | null,
): Promise<void> {
  const delay = Math.min(15000, Math.max(500, Math.round(duracaoMs)));
  await chamarZapi("send-presence", {
    metodo: "POST",
    corpo: { phone: telefone, presence: "composing", delay },
    conexaoId: conexaoId ?? null,
  }).catch(() => undefined);
}

export async function chamarZapi(
  caminho: string,
  opcoes: {
    metodo?: "GET" | "POST" | "PUT" | "DELETE";
    corpo?: unknown;
    conexaoId?: string | null;
  } = {},
): Promise<RespostaZapi> {
  const cred = await credenciaisDaConexao(opcoes.conexaoId);
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
    return {
      ok: false,
      status: 0,
      dados: null,
      erro: e instanceof Error ? e.message : "Falha de conexão",
    };
  }
}

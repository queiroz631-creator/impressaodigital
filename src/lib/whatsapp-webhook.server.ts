/**
 * Webhook do WhatsApp (todos os provedores). Somente servidor.
 *
 * Fluxo:
 *  1. autentica pelo token do endereço e identifica a conexão (e o provedor);
 *  2. o adaptador do provedor NORMALIZA o corpo em um evento interno;
 *  3. o evento é registrado com idempotência (reforço, nunca bloqueante);
 *  4. o pipeline comum aplica as regras de atendimento e responde ao provedor.
 *
 * As regras de atendimento vivem em `whatsapp/pipeline.server.ts`; o formato
 * Z-API vive em `whatsapp/providers/zapi-webhook.ts`.
 */

import {
  concluirEvento,
  registrarEvento,
  registrarStatusDaConexao,
} from "@/lib/whatsapp/eventos.server";
import { processarEventoNormalizado } from "@/lib/whatsapp/pipeline.server";
import { obterProvedorPorId } from "@/lib/whatsapp/providers/registro.server";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

/** Erros que indicam "coluna ainda não existe" (migração multiprovedor não aplicada). */
function colunaAusente(erro: { code?: string; message?: string } | null | undefined): boolean {
  return Boolean(erro && (erro.code === "42703" || erro.code === "PGRST204" || /provedor/i.test(erro.message ?? "")));
}

/** Conexão pelo token do webhook, com o provedor (padrão `zapi` se a coluna não existir). */
async function conexaoPorToken(
  db: Admin,
  token: string,
): Promise<{ id: string; ativo: boolean | null; provedor: string; id_externo: string | null } | null> {
  const completa = await db
    .from("whatsapp_conexoes")
    .select("id, ativo, provedor, id_externo")
    .eq("webhook_token", token)
    .maybeSingle();

  if (!completa.error) {
    const c = completa.data as { id: string; ativo: boolean | null; provedor?: string | null; id_externo?: string | null } | null;
    return c ? { id: c.id, ativo: c.ativo, provedor: c.provedor || "zapi", id_externo: c.id_externo ?? null } : null;
  }

  // Banco sem a coluna `provedor`: mantém o comportamento original (tudo é Z-API).
  if (colunaAusente(completa.error)) {
    const simples = await db.from("whatsapp_conexoes").select("id, ativo").eq("webhook_token", token).maybeSingle();
    const c = simples.data as { id: string; ativo: boolean | null } | null;
    return c ? { id: c.id, ativo: c.ativo, provedor: "zapi", id_externo: null } : null;
  }
  return null;
}

export async function processarWebhookWhatsapp(request: Request, token: string): Promise<Response> {
  if (!token) return new Response("Token ausente", { status: 401 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // O token identifica a conexão: cada número tem o seu endereço de
  // webhook. Conexões antigas continuam válidas pelo token da config.
  const conexao = await conexaoPorToken(supabaseAdmin, token);

  let conexaoId: string | null = conexao?.id ?? null;
  const provedorId = conexao?.provedor ?? "zapi";

  if (!conexaoId) {
    const { data: config } = await supabaseAdmin
      .from("whatsapp_config")
      .select("id, webhook_token, conexao_id")
      .eq("webhook_token", token)
      .limit(1)
      .maybeSingle();
    if (!config?.webhook_token) return new Response("Token inválido", { status: 401 });
    conexaoId = (config as { conexao_id?: string | null }).conexao_id ?? null;
  } else if (conexao && conexao.ativo === false) {
    return Response.json({ ok: true, ignorado: true, motivo: "conexao_inativa" });
  }

  // Token antigo sem conexão vinculada: cai na primeira conexão cadastrada.
  if (!conexaoId) {
    const { data: primeira } = await supabaseAdmin
      .from("whatsapp_conexoes")
      .select("id")
      .order("ordem")
      .limit(1)
      .maybeSingle();
    conexaoId = primeira?.id ?? null;
  }
  if (!conexaoId) return new Response("Nenhuma conexão cadastrada", { status: 409 });

  const adaptador = obterProvedorPorId(provedorId);
  if (!adaptador) {
    // Conexão marcada com um provedor que este servidor não tem: responde 200
    // (evita reentregas em laço) e deixa claro o motivo.
    console.error(`Webhook recebido para conexão ${conexaoId} com provedor indisponível: ${provedorId}`);
    return Response.json({ ok: true, ignorado: true, motivo: "provedor_indisponivel" });
  }

  // Autenticação adicional por cabeçalho secreto (provedores que a suportam,
  // ex.: Evolution). Além do token no endereço; falha → 401 sem processar nada.
  const contextoWebhook = { conexaoId, webhookToken: token, instanciaEsperada: conexao?.id_externo ?? null };
  if (adaptador.autenticarWebhook && !adaptador.autenticarWebhook(request.headers, contextoWebhook)) {
    return new Response("Não autorizado", { status: 401 });
  }

  let bruto: unknown;
  try {
    bruto = await request.json();
  } catch {
    return new Response("Payload inválido", { status: 400 });
  }

  // Reforço de autenticidade: o evento deve declarar a instância desta conexão
  // (o segredo do cabeçalho já garante a origem; aqui evita reentrega cruzada).
  // Sem a informação no corpo, a autenticação pelo segredo basta.
  const { instanciaConfere } = await import("@/lib/whatsapp/webhook-url");
  if (!instanciaConfere(bruto, contextoWebhook.instanciaEsperada)) {
    console.warn(`Webhook da conexão ${conexaoId}: evento de outra instância foi descartado.`);
    return new Response("instancia_divergente", { status: 403 });
  }

  const evento = adaptador.normalizarWebhook(bruto, contextoWebhook);

  // Estado da conexão informado pelo provedor (conectado/desconectado).
  if (evento.tipo === "ignorado" && evento.statusConexao) {
    await registrarStatusDaConexao(conexaoId, evento.statusConexao);
  }

  // Idempotência: só descarta o que já foi PROCESSADO. Eventos em 'recebido'
  // (processamento interrompido) ou 'erro' são reprocessados quando o provedor
  // reenvia — a deduplicação definitiva continua no índice único de mensagens.
  const registro = await registrarEvento(conexaoId, adaptador.id, evento);
  if (registro && !registro.novo && registro.status === "processado") {
    return Response.json({ ok: true, ignorado: true, motivo: "duplicada" });
  }

  try {
    const resultado = await processarEventoNormalizado(conexaoId, evento);
    await concluirEvento(registro, resultado.desfecho, resultado.erro);
    return resultado.resposta;
  } catch (e) {
    await concluirEvento(registro, "erro", e instanceof Error ? e.message : String(e));
    throw e;
  }
}

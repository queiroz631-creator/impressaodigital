import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Conexões de WhatsApp (Z-API). As credenciais (instance token / client token)
 * nunca saem do servidor: a lista devolvida às telas traz somente dados não
 * sensíveis. Criar, editar, testar, reconfigurar e excluir é só para
 * administradores.
 */

export interface ConexaoPublica {
  id: string;
  nome: string;
  telefone: string;
  cor: string;
  ativo: boolean;
  ordem: number;
  base_url: string;
  webhook_url: string;
  tem_credenciais: boolean;
}

async function ehAdmin(supabase: {
  rpc: (
    nome: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown | null }>;
}): Promise<boolean> {
  return false as never;
}

/** Endereço público usado como base dos webhooks. */
async function urlBaseWebhook(): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("whatsapp_config").select("app_url").limit(1).maybeSingle();
  const bruto =
    (data as { app_url?: string | null } | null)?.app_url?.trim() ||
    process.env["SITE_URL"] ||
    "https://impressaodigital.lovable.app";
  return bruto.replace(/\/+$/, "");
}

function enderecoWebhook(base: string, token: string): string {
  return `${base}/api/public/whatsapp/webhook/${token}`;
}

/** Conexões que o usuário logado pode ver (administrador vê todas). */
export const listarConexoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConexaoPublica[]> => {
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    const { data: perfil } = await context.supabase
      .from("profiles")
      .select("conexao_id, ativo")
      .eq("id", context.userId)
      .maybeSingle();

    const p = perfil as { conexao_id?: string | null; ativo?: boolean | null } | null;
    if (!admin && (p?.ativo === false || !p?.conexao_id)) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const consulta = supabaseAdmin
      .from("whatsapp_conexoes")
      .select(
        "id, nome, telefone, cor, ativo, ordem, base_url, webhook_token, instance_id, instance_token, client_token",
      )
      .order("ordem");

    const { data } = await (admin ? consulta : consulta.eq("id", p!.conexao_id!));
    const base = await urlBaseWebhook();

    return (data ?? []).map((c) => ({
      id: c.id,
      nome: c.nome,
      telefone: c.telefone ?? "",
      cor: c.cor ?? "#25D366",
      ativo: Boolean(c.ativo),
      ordem: Number(c.ordem ?? 0),
      base_url: c.base_url ?? "https://api.z-api.io",
      webhook_url: enderecoWebhook(base, c.webhook_token),
      tem_credenciais: Boolean(c.instance_id && c.instance_token && c.client_token),
    }));
  });

const entradaConexao = z.object({
  nome: z.string().trim().min(2).max(60),
  telefone: z.string().trim().max(30).default(""),
  cor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#25D366"),
  baseUrl: z.string().trim().max(200).default("https://api.z-api.io"),
  instanceId: z.string().trim().max(120).default(""),
  instanceToken: z.string().trim().max(200).default(""),
  clientToken: z.string().trim().max(200).default(""),
  ativo: z.boolean().default(true),
  ordem: z.number().int().min(0).max(999).default(0),
});

/** Cria uma conexão nova, já com a configuração padrão do bot (desligado). */
export const criarConexao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => entradaConexao.parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!admin) return { ok: false as const, erro: "Somente administradores." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: nova, error } = await supabaseAdmin
      .from("whatsapp_conexoes")
      .insert({
        nome: data.nome,
        telefone: data.telefone,
        cor: data.cor,
        base_url: data.baseUrl.replace(/\/+$/, ""),
        instance_id: data.instanceId,
        instance_token: data.instanceToken,
        client_token: data.clientToken,
        ativo: data.ativo,
        ordem: data.ordem,
        webhook_token: crypto.randomUUID().replace(/-/g, ""),
      })
      .select("id")
      .maybeSingle();

    if (error || !nova?.id) {
      console.error("Falha ao criar conexão", error?.message);
      return { ok: false as const, erro: "Não foi possível criar a conexão." };
    }

    // Configuração própria: mensagens e horários padrão, bot desligado, sem
    // fluxos, respostas ou números — nada é copiado de outra conexão.
    await supabaseAdmin.from("whatsapp_config").insert({
      conexao_id: nova.id,
      conexao_nome: data.nome,
      bot_ativo: false,
      webhook_token: crypto.randomUUID().replace(/-/g, ""),
    });

    await supabaseAdmin.from("bot_horarios").insert(
      [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
        conexao_id: nova.id,
        dia_semana: dia,
        fechado: dia === 0,
      })),
    );

    return { ok: true as const, erro: null, id: nova.id };
  });

/** Edita uma conexão. Token em branco mantém o valor já guardado. */
export const atualizarConexao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    entradaConexao.partial().extend({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!admin) return { ok: false as const, erro: "Somente administradores." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const campos: Record<string, unknown> = {};
    if (data.nome !== undefined) campos["nome"] = data.nome;
    if (data.telefone !== undefined) campos["telefone"] = data.telefone;
    if (data.cor !== undefined) campos["cor"] = data.cor;
    if (data.baseUrl !== undefined) campos["base_url"] = data.baseUrl.replace(/\/+$/, "");
    if (data.instanceId) campos["instance_id"] = data.instanceId;
    if (data.instanceToken) campos["instance_token"] = data.instanceToken;
    if (data.clientToken) campos["client_token"] = data.clientToken;
    if (data.ativo !== undefined) campos["ativo"] = data.ativo;
    if (data.ordem !== undefined) campos["ordem"] = data.ordem;

    const { error } = await supabaseAdmin
      .from("whatsapp_conexoes")
      .update(campos)
      .eq("id", data.id);

    if (error) {
      console.error("Falha ao atualizar conexão", error.message);
      return { ok: false as const, erro: "Não foi possível salvar a conexão." };
    }
    return { ok: true as const, erro: null };
  });

/**
 * Exclui uma conexão. Só é permitido quando ela não tem nenhum dado vinculado;
 * havendo histórico, a conexão deve ser desativada.
 */
export const excluirConexao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!admin) return { ok: false as const, erro: "Somente administradores." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tabelas = [
      "whatsapp_conversas",
      "bot_fluxos",
      "bot_respostas",
      "bot_menu_opcoes",
      "bot_primeiro_contato",
      "bot_numeros",
      "bot_status_whatsapp",
    ] as const;

    for (const tabela of tabelas) {
      const { count } = await supabaseAdmin
        .from(tabela)
        .select("id", { count: "exact", head: true })
        .eq("conexao_id", data.id);
      if ((count ?? 0) > 0) {
        return {
          ok: false as const,
          erro: "Esta conexão já tem histórico. Desative-a em vez de excluir.",
        };
      }
    }

    await supabaseAdmin.from("bot_horarios").delete().eq("conexao_id", data.id);
    await supabaseAdmin.from("whatsapp_config").delete().eq("conexao_id", data.id);
    const { error } = await supabaseAdmin.from("whatsapp_conexoes").delete().eq("id", data.id);
    if (error) {
      console.error("Falha ao excluir conexão", error.message);
      return { ok: false as const, erro: "Não foi possível excluir a conexão." };
    }
    return { ok: true as const, erro: null };
  });

/** Consulta na Z-API se o número da conexão está conectado. */
export const testarConexao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!admin) return { ok: false as const, conectado: false, detalhe: "Somente administradores." };

    const { chamarZapi } = await import("@/lib/zapi.server");
    const r = await chamarZapi("status", { conexaoId: data.id });
    if (!r.ok) {
      return {
        ok: false as const,
        conectado: false,
        detalhe: r.erro ?? "Não foi possível consultar o status.",
      };
    }

    const dados = (r.dados ?? {}) as { connected?: boolean; error?: string };
    return {
      ok: true as const,
      conectado: Boolean(dados.connected),
      detalhe:
        dados.error ??
        (dados.connected ? "Número conectado." : "Número desconectado — leia o QR Code na Z-API."),
    };
  });

const CAMINHOS_WEBHOOK = [
  { gravar: "update-webhook-received", rotulo: "Ao receber" },
  { gravar: "update-webhook-delivery", rotulo: "Ao enviar" },
  { gravar: "update-webhook-message-status", rotulo: "Status da mensagem" },
  { gravar: "update-webhook-disconnected", rotulo: "Ao desconectar" },
] as const;

/** Grava na Z-API o endereço de webhook desta conexão (somente sob comando). */
export const reconfigurarWebhookConexao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!admin) return { ok: false as const, erro: "Somente administradores.", url: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conexao } = await supabaseAdmin
      .from("whatsapp_conexoes")
      .select("webhook_token")
      .eq("id", data.id)
      .maybeSingle();

    const token = (conexao as { webhook_token?: string } | null)?.webhook_token;
    if (!token) return { ok: false as const, erro: "Conexão não encontrada.", url: null };

    const url = enderecoWebhook(await urlBaseWebhook(), token);
    const { chamarZapi } = await import("@/lib/zapi.server");

    const falhas: string[] = [];
    for (const c of CAMINHOS_WEBHOOK) {
      const r = await chamarZapi(c.gravar, {
        metodo: "PUT",
        corpo: { value: url },
        conexaoId: data.id,
      });
      if (!r.ok) {
        console.error(`Falha ao gravar webhook ${c.gravar}`, r.erro);
        falhas.push(c.rotulo);
      }
    }

    await chamarZapi("update-notify-sent-by-me", {
      metodo: "PUT",
      corpo: { notifySentByMe: true },
      conexaoId: data.id,
    });

    if (falhas.length === CAMINHOS_WEBHOOK.length) {
      return { ok: false as const, erro: "A Z-API não aceitou os novos endereços.", url: null };
    }
    if (falhas.length > 0) {
      return { ok: true as const, erro: `Não foi possível atualizar: ${falhas.join(", ")}.`, url };
    }
    return { ok: true as const, erro: null as string | null, url };
  });

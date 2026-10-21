import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { reconfigurarWebhookConexao } from "@/lib/whatsapp/webhook-config.server";

/**
 * Gestão de provedores de WhatsApp (servidores, conexões Evolution, QR Code,
 * status, webhook e log de eventos). Somente administradores.
 *
 * As chaves dos servidores NUNCA passam por aqui: o servidor guarda só o NOME
 * da variável de ambiente (`segredo_ref`); o valor fica no `.env` do backend.
 */

export interface ServidorPublico {
  id: string;
  provedor: string;
  nome: string;
  base_url: string;
  segredo_ref: string | null;
  /** A variável de ambiente existe no servidor? (nunca o valor) */
  chave_configurada: boolean;
  ativo: boolean;
  ultimo_teste_em: string | null;
  ultimo_teste_ok: boolean | null;
  ultimo_erro: string | null;
}

export interface ResultadoSimples {
  ok: boolean;
  erro: string | null;
}

export interface ResultadoTesteServidor extends ResultadoSimples {
  versao: string | null;
  chaveValida: boolean;
  instancias: number | null;
}

export interface ResultadoQr extends ResultadoSimples {
  qrCodeBase64: string | null;
  codigoPareamento: string | null;
  estado: string | null;
}

export interface ResultadoStatus extends ResultadoSimples {
  conectado: boolean;
  detalhe: string;
}

export interface ResultadoCriarConexao extends ResultadoSimples {
  id: string | null;
  webhookConfigurado: boolean;
  aviso: string | null;
}

export interface EventoConexao {
  id: string;
  tipo: string;
  status: string;
  tentativas: number;
  erro: string | null;
  recebido_em: string;
  processado_em: string | null;
}

type Contexto = {
  supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>;
  userId: string;
};

async function exigirAdmin(context: Contexto): Promise<void> {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Somente administradores.");
}

async function auditar(context: Contexto, acao: string, dados: Record<string, unknown>): Promise<void> {
  try {
    await context.supabase.rpc("agente_registrar_auditoria", {
      _acao: acao,
      _dados: dados as never,
      _entidade: "whatsapp_conexoes",
    });
  } catch {
    /* auditoria nunca derruba a operação */
  }
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Reconfigura o webhook da conexão no provedor.
 * A lógica (base pública, segredo, validação) vive em `whatsapp/webhook-config.server`.
 */
const configurarWebhookDaConexao = reconfigurarWebhookConexao;

const SEGREDO_REF = /^EVOLUTION_API_KEY[A-Z0-9_]{0,40}$/;

const entradaServidor = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2).max(80),
  baseUrl: z.string().trim().min(8).max(300),
  segredoRef: z.string().trim().regex(SEGREDO_REF, "Use um nome como EVOLUTION_API_KEY ou EVOLUTION_API_KEY_2."),
  ativo: z.boolean().default(true),
});

// ------------------------------------------------------------------ servidores
export const listarServidoresProvedor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ServidorPublico[]> => {
    await exigirAdmin(context);
    const { chaveDoServidor } = await import("@/lib/whatsapp/providers/evolution-cliente.server");
    const db = await admin();
    const { data } = await db
      .from("whatsapp_servidores")
      .select("id, provedor, nome, base_url, segredo_ref, ativo, ultimo_teste_em, ultimo_teste_ok, ultimo_erro")
      .order("nome");
    return (data ?? []).map((s) => ({
      id: s.id,
      provedor: s.provedor,
      nome: s.nome,
      base_url: s.base_url,
      segredo_ref: s.segredo_ref,
      chave_configurada: Boolean(s.segredo_ref && chaveDoServidor(s.segredo_ref)),
      ativo: s.ativo,
      ultimo_teste_em: s.ultimo_teste_em,
      ultimo_teste_ok: s.ultimo_teste_ok,
      ultimo_erro: s.ultimo_erro,
    }));
  });

export const salvarServidorEvolution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => entradaServidor.parse(input))
  .handler(async ({ data, context }): Promise<ResultadoSimples & { id: string | null }> => {
    await exigirAdmin(context);

    // Proteção SSRF ANTES de gravar: a URL cadastrada será chamada pelo backend.
    const { validarUrlDoServidor } = await import("@/lib/whatsapp/seguranca/url-segura.server");
    const v = await validarUrlDoServidor(data.baseUrl);
    if (!v.ok) return { ok: false, erro: v.motivo, id: null };

    const baseUrl = `${v.url.origin}${v.url.pathname.replace(/\/+$/, "")}`;
    const db = await admin();
    const campos = { provedor: "evolution", nome: data.nome, base_url: baseUrl, segredo_ref: data.segredoRef, ativo: data.ativo };

    if (data.id) {
      const { error } = await db.from("whatsapp_servidores").update(campos).eq("id", data.id);
      if (error) return { ok: false, erro: erro23505(error) ?? "Não foi possível salvar o servidor.", id: null };
      await auditar(context, "whatsapp.servidor_editado", { servidor_id: data.id, nome: data.nome });
      return { ok: true, erro: null, id: data.id };
    }

    const { data: novo, error } = await db
      .from("whatsapp_servidores")
      .insert({ ...campos, criado_por: context.userId })
      .select("id")
      .maybeSingle();
    if (error || !novo?.id) return { ok: false, erro: erro23505(error) ?? "Não foi possível salvar o servidor.", id: null };
    await auditar(context, "whatsapp.servidor_criado", { servidor_id: novo.id, nome: data.nome });
    return { ok: true, erro: null, id: novo.id };
  });

function erro23505(e: { code?: string } | null): string | null {
  return e?.code === "23505" ? "Já existe um servidor cadastrado com esta URL." : null;
}

export const testarServidorEvolution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ResultadoTesteServidor> => {
    await exigirAdmin(context);
    const { resolverAlvoEvolution, chamarEvolution } = await import("@/lib/whatsapp/providers/evolution-cliente.server");
    const db = await admin();

    const registrar = async (ok: boolean, erro: string | null) => {
      await db
        .from("whatsapp_servidores")
        .update({ ultimo_teste_em: new Date().toISOString(), ultimo_teste_ok: ok, ultimo_erro: erro })
        .eq("id", data.id);
    };

    const r = await resolverAlvoEvolution({ conexaoId: null, servidorId: data.id });
    if (!r.ok) {
      await registrar(false, r.erro.mensagem);
      return { ok: false, erro: r.erro.mensagem, versao: null, chaveValida: false, instancias: null };
    }

    // `/` é público (traz a versão); `fetchInstances` exige a chave (valida credencial).
    const raiz = await chamarEvolution(r.alvo, "");
    if (!raiz.ok) {
      await registrar(false, raiz.erro ?? "Servidor inacessível.");
      return { ok: false, erro: raiz.erro ?? "Servidor inacessível.", versao: null, chaveValida: false, instancias: null };
    }
    const versao = (raiz.dados as { version?: string } | null)?.version ?? null;

    const lista = await chamarEvolution(r.alvo, "instance/fetchInstances");
    if (!lista.ok) {
      const msg = lista.status === 401 ? "A chave informada foi recusada pelo servidor." : (lista.erro ?? "Falha ao validar a chave.");
      await registrar(false, msg);
      return { ok: false, erro: msg, versao, chaveValida: false, instancias: null };
    }

    await registrar(true, null);
    // Só a contagem: a lista traz chaves das instâncias e não deve sair daqui.
    return { ok: true, erro: null, versao, chaveValida: true, instancias: Array.isArray(lista.dados) ? lista.dados.length : null };
  });

export const excluirServidorProvedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ResultadoSimples> => {
    await exigirAdmin(context);
    const db = await admin();
    const { count } = await db.from("whatsapp_conexoes").select("id", { count: "exact", head: true }).eq("servidor_id", data.id);
    if ((count ?? 0) > 0) return { ok: false, erro: "Há conexões usando este servidor. Remova-as ou desative o servidor." };
    const { error } = await db.from("whatsapp_servidores").delete().eq("id", data.id);
    if (error) return { ok: false, erro: "Não foi possível excluir o servidor." };
    await auditar(context, "whatsapp.servidor_excluido", { servidor_id: data.id });
    return { ok: true, erro: null };
  });

// ----------------------------------------------------------- conexões Evolution
const entradaConexaoEvolution = z.object({
  servidorId: z.string().uuid(),
  nome: z.string().trim().min(2).max(60),
  nomeInstancia: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/, "Instância: 3–40 caracteres (letras, números, _ e -)."),
  telefone: z.string().trim().max(30).default(""),
  cor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).default("#25D366"),
  ordem: z.number().int().min(0).max(999).default(0),
});

export const criarConexaoEvolution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => entradaConexaoEvolution.parse(input))
  .handler(async ({ data, context }): Promise<ResultadoCriarConexao> => {
    await exigirAdmin(context);
    const falha = (erro: string): ResultadoCriarConexao => ({ ok: false, erro, id: null, webhookConfigurado: false, aviso: null });
    const db = await admin();

    const { data: srv } = await db.from("whatsapp_servidores").select("id, provedor").eq("id", data.servidorId).maybeSingle();
    if (!srv || srv.provedor !== "evolution") return falha("Servidor Evolution não encontrado.");

    // 1) Registra a conexão (nasce ativa; o webhook ainda não aponta para ela).
    const { data: nova, error } = await db
      .from("whatsapp_conexoes")
      .insert({
        nome: data.nome,
        telefone: data.telefone,
        cor: data.cor,
        ordem: data.ordem,
        provedor: "evolution",
        servidor_id: data.servidorId,
        id_externo: data.nomeInstancia,
        status: "conectando",
        webhook_token: crypto.randomUUID().replace(/-/g, ""),
      })
      .select("id")
      .maybeSingle();
    if (error || !nova?.id) {
      return falha(error?.code === "23505" ? "Esta instância já está vinculada a outra conexão." : "Não foi possível criar a conexão.");
    }

    // 2) Cria a instância no servidor Evolution; se falhar, desfaz o registro.
    const { evolutionAdapter } = await import("@/lib/whatsapp/providers/evolution-adapter.server");
    const criada = await evolutionAdapter.criarInstancia({ conexaoId: null, servidorId: data.servidorId }, data.nomeInstancia);
    if (!criada.ok) {
      await db.from("whatsapp_conexoes").delete().eq("id", nova.id);
      return falha(criada.erro.mensagem);
    }

    // 3) Configuração própria (bot desligado, horários padrão), igual às conexões Z-API.
    await db.from("whatsapp_config").insert({
      conexao_id: nova.id,
      conexao_nome: data.nome,
      bot_ativo: false,
      webhook_token: crypto.randomUUID().replace(/-/g, ""),
    });
    await db.from("bot_horarios").insert(
      [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ conexao_id: nova.id, dia_semana: dia, fechado: dia === 0 })),
    );

    // 4) Webhook por instância (com segredo). Falha aqui não desfaz a conexão: é reconfigurável.
    const wh = await configurarWebhookDaConexao(nova.id);
    await auditar(context, "whatsapp.conexao_evolution_criada", { conexao_id: nova.id, instancia: data.nomeInstancia, webhook: wh.ok });
    return { ok: true, erro: null, id: nova.id, webhookConfigurado: wh.ok, aviso: wh.ok ? null : wh.erro };
  });

export const reconfigurarWebhookProvedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ResultadoSimples> => {
    await exigirAdmin(context);
    const r = await configurarWebhookDaConexao(data.id);
    await auditar(context, "whatsapp.webhook_reconfigurado", { conexao_id: data.id, ok: r.ok });
    return r;
  });

async function registrarStatus(conexaoId: string, status: "conectado" | "conectando" | "desconectado" | "erro", erro?: string) {
  const db = await admin();
  await db.rpc("whatsapp_conexao_registrar_status", { _conexao_id: conexaoId, _status: status, ...(erro ? { _erro: erro } : {}) });
}

export const obterQrCodeConexao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ResultadoQr> => {
    await exigirAdmin(context);
    const { obterProvedorDaConexao } = await import("@/lib/whatsapp/providers/registro.server");
    const p = await obterProvedorDaConexao(data.id);
    const vazio = { qrCodeBase64: null, codigoPareamento: null, estado: null };
    if (!p.ok) return { ok: false, erro: p.erro.mensagem, ...vazio };

    const r = await p.dados.obterQrCode({ conexaoId: data.id });
    if (!r.ok) return { ok: false, erro: r.erro.mensagem, ...vazio };
    if (r.dados.estado === "open") await registrarStatus(data.id, "conectado");
    else await registrarStatus(data.id, "conectando");
    await auditar(context, "whatsapp.qr_solicitado", { conexao_id: data.id });
    return { ok: true, erro: null, ...r.dados };
  });

export const consultarStatusConexaoProvedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ResultadoStatus> => {
    await exigirAdmin(context);
    const { consultarStatusDaConexao } = await import("@/lib/whatsapp/provedor.server");
    const r = await consultarStatusDaConexao(data.id);
    if (!r.ok) {
      await registrarStatus(data.id, "erro", r.erro.mensagem);
      return { ok: false, erro: r.erro.mensagem, conectado: false, detalhe: r.erro.mensagem };
    }
    await registrarStatus(data.id, r.dados.conectado ? "conectado" : "desconectado");
    return { ok: true, erro: null, ...r.dados };
  });

export const desconectarConexaoProvedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ResultadoSimples> => {
    await exigirAdmin(context);
    const { obterProvedorDaConexao } = await import("@/lib/whatsapp/providers/registro.server");
    const p = await obterProvedorDaConexao(data.id);
    if (!p.ok) return { ok: false, erro: p.erro.mensagem };
    const r = await p.dados.desconectar({ conexaoId: data.id });
    if (!r.ok) return { ok: false, erro: r.erro.mensagem };
    await registrarStatus(data.id, "desconectado");
    await auditar(context, "whatsapp.conexao_desconectada", { conexao_id: data.id });
    return { ok: true, erro: null };
  });

/**
 * Garante que a conexão tenha configuração de bot e horários padrão.
 *
 * Chamado pela tela "Configurar Bot" quando o registro da conexão ainda não
 * existe (conexões antigas ou criadas fora das telas atuais): sem isso a tela
 * ficava presa no esqueleto de carregamento. Cria só o que falta, com bot
 * desligado — nunca liga o atendimento automático por conta própria.
 */
export const garantirConfigBotConexao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ conexaoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ResultadoSimples> => {
    const db = await admin();
    // Admin enxerga qualquer conexão; o atendente só a vinculada a ele
    // (mesma regra das demais operações da tela).
    const { data: conexao } = await db
      .from("whatsapp_conexoes")
      .select("nome")
      .eq("id", data.conexaoId)
      .maybeSingle();
    if (!conexao) return { ok: false, erro: "Conexão não encontrada." };

    const { garantirConfiguracaoDaConexao } = await import("@/lib/whatsapp/config-bot.server");
    const criada = await garantirConfiguracaoDaConexao(data.conexaoId, conexao.nome);
    if (criada) await auditar(context, "whatsapp.config_bot_criada", { conexao_id: data.conexaoId });
    return { ok: true, erro: null };
  });

/** Log de eventos de uma conexão (somente metadados; sem telefone/texto). */
export const listarEventosConexao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ conexaoId: z.string().uuid(), somenteErros: z.boolean().default(false), limite: z.number().int().min(1).max(200).default(50) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<EventoConexao[]> => {
    await exigirAdmin(context);
    let consulta = context.supabase
      .from("whatsapp_eventos")
      .select("id, tipo, status, tentativas, erro, recebido_em, processado_em")
      .eq("conexao_id", data.conexaoId)
      .order("recebido_em", { ascending: false })
      .limit(data.limite);
    if (data.somenteErros) consulta = consulta.eq("status", "erro");
    const { data: eventos, error } = await consulta;
    if (error) throw new Error(error.message);
    return (eventos ?? []) as EventoConexao[];
  });

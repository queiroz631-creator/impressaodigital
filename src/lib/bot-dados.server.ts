/** Carrega as configurações do atendimento automático. Somente servidor. */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  BotConfig,
  BotDados,
  BotHorario,
  BotOpcao,
  BotResposta,
  RegraPrimeiroContato,
} from "@/lib/bot-motor";
import type { DadosFluxos, Fluxo, FluxoEtapa, FluxoOpcao } from "@/lib/bot-fluxos";

/** Carrega os fluxos, etapas e opções cadastrados. */
export async function carregarFluxos(): Promise<DadosFluxos> {
  const [f, e, o] = await Promise.all([
    supabaseAdmin.from("bot_fluxos").select("*").order("ordem"),
    supabaseAdmin.from("bot_fluxo_etapas").select("*").order("ordem"),
    supabaseAdmin.from("bot_fluxo_opcoes").select("*").order("ordem"),
  ]);

  return {
    fluxos: (f.data ?? []) as unknown as Fluxo[],
    etapas: (e.data ?? []) as unknown as FluxoEtapa[],
    opcoes: (o.data ?? []) as unknown as FluxoOpcao[],
  };
}

export async function carregarDadosBot(): Promise<BotDados | null> {
  const [cfg, hor, opc, resp, pal, reg] = await Promise.all([
    supabaseAdmin.from("whatsapp_config").select("*").limit(1).maybeSingle(),
    supabaseAdmin.from("bot_horarios").select("*").order("dia_semana"),
    supabaseAdmin.from("bot_menu_opcoes").select("*").order("ordem"),
    supabaseAdmin.from("bot_respostas").select("*").order("ordem"),
    supabaseAdmin.from("bot_palavras_chave").select("*"),
    supabaseAdmin.from("bot_primeiro_contato").select("*").order("ordem"),
  ]);

  const d = cfg.data;
  if (!d) return null;

  const palavras = (pal.data ?? []) as { opcao_id: string | null; resposta_id: string | null; texto: string }[];

  const config: BotConfig = {
    bot_ativo: Boolean(d.bot_ativo),
    bot_24h: Boolean(d.bot_24h),
    usar_ia: Boolean(d.usar_ia),
    inatividade1_minutos: Number(d.inatividade1_minutos ?? 5),
    inatividade2_minutos: Number(d.inatividade2_minutos ?? 10),
    inatividade_status: d.inatividade_status ?? "finalizado",
    fluxo_finalizacao_id:
      (d as { fluxo_finalizacao_id?: string | null }).fluxo_finalizacao_id ?? null,
    fallback_inicial_minutos: Number(
      (d as { fallback_inicial_minutos?: number | null }).fallback_inicial_minutos ?? 2,
    ),
    msg_inatividade1: d.msg_inatividade1 ?? "",
    msg_inatividade_pendente: d.msg_inatividade_pendente ?? "",
    msg_inatividade_aguardando: d.msg_inatividade_aguardando ?? "",
    msg_inatividade_em_atendimento: d.msg_inatividade_em_atendimento ?? "",
    msg_inatividade_finalizado: d.msg_inatividade_finalizado ?? "",
    permitir_orcamento_automatico: Boolean(d.permitir_orcamento_automatico),
    enviar_msg_finalizacao: Boolean(d.enviar_msg_finalizacao),
    finalizacao_uma_vez_dia: Boolean(d.finalizacao_uma_vez_dia),
    msg_fora_horario: d.msg_fora_horario ?? "",
    msg_fora_horario_ativo: d.msg_fora_horario_ativo !== false,
    msg_transferencia: d.msg_transferencia ?? "",
    msg_transferencia_ativo: d.msg_transferencia_ativo !== false,
    msg_finalizacao: d.msg_finalizacao ?? "",
    msg_finalizacao_ativo: d.msg_finalizacao_ativo !== false,
  };

  const opcoes: BotOpcao[] = ((opc.data ?? []) as Omit<BotOpcao, "palavras">[]).map((o) => ({
    ...o,
    palavras: palavras.filter((p) => p.opcao_id === o.id).map((p) => p.texto),
  }));

  const respostas: BotResposta[] = ((resp.data ?? []) as Omit<BotResposta, "palavras">[]).map((r) => ({
    ...r,
    palavras: palavras.filter((p) => p.resposta_id === r.id).map((p) => p.texto),
  }));

  return {
    config,
    horarios: (hor.data ?? []) as BotHorario[],
    opcoes,
    respostas,
    regras: (reg.data ?? []) as unknown as RegraPrimeiroContato[],
  };
}

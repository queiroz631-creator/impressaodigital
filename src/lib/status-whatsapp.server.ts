/**
 * Status do WhatsApp: agendamento das publicações e arquivo de controle.
 *
 * O arquivo `status-whatsapp/agenda.json` (bucket privado `sistema`) guarda o
 * próximo horário a publicar. A verificação periódica lê só esse arquivo e,
 * quando ainda não chegou a hora, encerra sem consultar o banco.
 */

const BUCKET = "sistema";
const CAMINHO = "status-whatsapp/agenda.json";
const FUSO_OFFSET_MS = 3 * 60 * 60 * 1000; // America/Sao_Paulo (UTC-3)

export interface StatusRegistro {
  id: string;
  tipo: string;
  texto: string;
  cor_fundo: string;
  imagem_url: string | null;
  legenda: string;
  modo: string;
  agendado_em: string | null;
  dias_semana: number[] | null;
  hora: string | null;
  ativo: boolean;
  ultima_publicacao_em: string | null;
}

export interface AgendaArquivo {
  atualizado_em: string;
  versao: number;
  proximo_em: string | null;
  total_ativos: number;
  itens: { id: string; proximo_em: string | null }[];
}

let cache: { dados: AgendaArquivo; em: number } | null = null;
const CACHE_MS = 60_000;

/** Data/hora local (São Paulo) de um instante. */
function partesSP(d: Date) {
  const local = new Date(d.getTime() - FUSO_OFFSET_MS);
  return {
    ano: local.getUTCFullYear(),
    mes: local.getUTCMonth(),
    dia: local.getUTCDate(),
    diaSemana: local.getUTCDay(),
  };
}

/** Converte uma data/hora local (São Paulo) para instante UTC. */
function instanteSP(ano: number, mes: number, dia: number, hora: number, minuto: number) {
  return new Date(Date.UTC(ano, mes, dia, hora, minuto) + FUSO_OFFSET_MS);
}

function minutosDaHora(hora: string | null): [number, number] | null {
  if (!hora) return null;
  const partes = hora.split(":");
  const h = Number(partes[0]);
  const m = Number(partes[1] ?? "0");
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return [h, m];
}

/** Última ocorrência programada até `agora` (inclusive). */
export function ocorrenciaAnterior(reg: StatusRegistro, agora: Date): Date | null {
  if (reg.modo === "uma_vez") {
    if (!reg.agendado_em) return null;
    const d = new Date(reg.agendado_em);
    return d.getTime() <= agora.getTime() ? d : null;
  }
  const hm = minutosDaHora(reg.hora);
  const dias = reg.dias_semana ?? [];
  if (!hm || dias.length === 0) return null;

  for (let i = 0; i <= 7; i++) {
    const base = new Date(agora.getTime() - i * 86_400_000);
    const p = partesSP(base);
    if (!dias.includes(p.diaSemana)) continue;
    const candidato = instanteSP(p.ano, p.mes, p.dia, hm[0], hm[1]);
    if (candidato.getTime() <= agora.getTime()) return candidato;
  }
  return null;
}

/** Próxima ocorrência programada depois de `agora`. */
export function proximaOcorrencia(reg: StatusRegistro, agora: Date): Date | null {
  if (reg.modo === "uma_vez") {
    if (!reg.agendado_em) return null;
    const d = new Date(reg.agendado_em);
    return d.getTime() > agora.getTime() ? d : null;
  }
  const hm = minutosDaHora(reg.hora);
  const dias = reg.dias_semana ?? [];
  if (!hm || dias.length === 0) return null;

  for (let i = 0; i <= 7; i++) {
    const base = new Date(agora.getTime() + i * 86_400_000);
    const p = partesSP(base);
    if (!dias.includes(p.diaSemana)) continue;
    const candidato = instanteSP(p.ano, p.mes, p.dia, hm[0], hm[1]);
    if (candidato.getTime() > agora.getTime()) return candidato;
  }
  return null;
}

/** Está vencido? (ocorrência já passou e ainda não foi publicada) */
export function estaVencido(reg: StatusRegistro, agora: Date): Date | null {
  if (!reg.ativo) return null;
  const anterior = ocorrenciaAnterior(reg, agora);
  if (!anterior) return null;
  const ultima = reg.ultima_publicacao_em ? new Date(reg.ultima_publicacao_em) : null;
  if (ultima && ultima.getTime() >= anterior.getTime()) return null;
  return anterior;
}

function horarioAlvo(reg: StatusRegistro, agora: Date): Date | null {
  return estaVencido(reg, agora) ?? proximaOcorrencia(reg, agora);
}

async function listarAtivos(): Promise<StatusRegistro[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("bot_status_whatsapp")
    .select(
      "id, tipo, texto, cor_fundo, imagem_url, legenda, modo, agendado_em, dias_semana, hora, ativo, ultima_publicacao_em",
    )
    .eq("ativo", true);
  return (data ?? []) as StatusRegistro[];
}

/** Regrava o arquivo de controle a partir dos agendamentos atuais. */
export async function regravarAgenda(): Promise<AgendaArquivo> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const agora = new Date();
  const ativos = await listarAtivos();

  const itens = ativos.map((reg) => {
    const alvo = horarioAlvo(reg, agora);
    return { id: reg.id, proximo_em: alvo ? alvo.toISOString() : null };
  });

  const proximos = itens
    .map((i) => (i.proximo_em ? new Date(i.proximo_em).getTime() : null))
    .filter((t): t is number => t !== null);

  const agenda: AgendaArquivo = {
    atualizado_em: agora.toISOString(),
    versao: (cache?.dados.versao ?? 0) + 1,
    proximo_em: proximos.length ? new Date(Math.min(...proximos)).toISOString() : null,
    total_ativos: ativos.length,
    itens,
  };

  await supabaseAdmin.storage
    .from(BUCKET)
    .upload(CAMINHO, new Blob([JSON.stringify(agenda, null, 2)], { type: "application/json" }), {
      upsert: true,
      contentType: "application/json",
    });

  cache = { dados: agenda, em: Date.now() };
  return agenda;
}

/** Lê o arquivo de controle (recria se estiver faltando ou inválido). */
export async function lerAgenda(): Promise<AgendaArquivo> {
  if (cache && Date.now() - cache.em < CACHE_MS) return cache.dados;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage.from(BUCKET).download(CAMINHO);
  if (data) {
    try {
      const agenda = JSON.parse(await data.text()) as AgendaArquivo;
      if (agenda && typeof agenda === "object" && Array.isArray(agenda.itens)) {
        cache = { dados: agenda, em: Date.now() };
        return agenda;
      }
    } catch {
      /* arquivo inválido: recria abaixo */
    }
  }
  return regravarAgenda();
}

/**
 * Endereço público temporário da imagem. Aceita URL completa (colada pelo
 * usuário) ou caminho dentro do bucket privado bot-midia.
 */
async function urlDaImagem(valor: string): Promise<string | null> {
  if (/^https?:\/\//i.test(valor)) return valor;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage.from("bot-midia").createSignedUrl(valor, 60 * 60);
  return data?.signedUrl ?? null;
}

/** Publica um status na Z-API. */
export async function publicarStatus(
  reg: StatusRegistro,
): Promise<{ ok: boolean; erro: string | null }> {
  const { chamarZapi } = await import("@/lib/zapi.server");

  if (reg.tipo === "imagem") {
    const url = reg.imagem_url ? await urlDaImagem(reg.imagem_url) : null;
    if (!url) return { ok: false, erro: "Imagem não encontrada." };
    const ri = await chamarZapi("send-image-status", {
      metodo: "POST",
      corpo: { image: url, caption: reg.legenda || "" },
    });
    return { ok: ri.ok, erro: ri.ok ? null : (ri.erro ?? "Falha ao publicar o status.") };
  }

  const r = await chamarZapi("send-text-status", {
    metodo: "POST",
    corpo: { message: reg.texto, backgroundColor: reg.cor_fundo },
  });

  return { ok: r.ok, erro: r.ok ? null : (r.erro ?? "Falha ao publicar o status.") };
}

/** Publica um agendamento e registra o resultado. */
export async function publicarERegistrar(reg: StatusRegistro) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const r = await publicarStatus(reg);

  await supabaseAdmin
    .from("bot_status_whatsapp")
    .update({
      ultima_publicacao_em: new Date().toISOString(),
      ultimo_erro: r.erro,
      ...(r.ok && reg.modo === "uma_vez" ? { ativo: false } : {}),
    })
    .eq("id", reg.id);

  return r;
}

/** Rotina periódica: publica o que estiver vencido usando o arquivo de controle. */
export async function processarStatusAgendados(): Promise<{
  verificados: number;
  publicados: number;
  usouBanco: boolean;
}> {
  const agora = new Date();
  const agenda = await lerAgenda();

  if (!agenda.proximo_em || new Date(agenda.proximo_em).getTime() > agora.getTime()) {
    return { verificados: agenda.itens.length, publicados: 0, usouBanco: false };
  }

  const ativos = await listarAtivos();
  let publicados = 0;
  for (const reg of ativos) {
    if (!estaVencido(reg, agora)) continue;
    const r = await publicarERegistrar(reg);
    if (r.ok) publicados++;
  }

  await regravarAgenda();
  return { verificados: ativos.length, publicados, usouBanco: true };
}

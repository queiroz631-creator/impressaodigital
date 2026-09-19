/**
 * Saldo e geração de cupons do sorteio.
 *
 * Toda a gravação acontece dentro da função do banco
 * `public.sorteio_gerar_cupons_da_nota`, que roda em uma única transação com a
 * participação travada: confere a nota (VALIDA, sorteio ATIVO e ainda não
 * processada), soma o saldo ao valor da nota, cria os cupons com número
 * aleatório único, grava o novo saldo, marca a nota como processada e registra
 * a auditoria. Qualquer erro desfaz tudo.
 *
 * Nada aqui altera validação, cancelamento, participação ou sincronização.
 */

export type OrigemGeracao = "rotina" | "painel" | "portal";

export type ResultadoGeracao =
  | { resultado: "PROCESSADA"; cupons: number; saldoCentavos: number }
  | { resultado: "IGNORADA"; motivo: string };

async function cliente() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Gera (uma única vez) os cupons de uma nota válida. Idempotente. */
export async function gerarCuponsDaNota(
  notaId: string,
  origem: OrigemGeracao = "rotina",
  usuarioId: string | null = null,
): Promise<ResultadoGeracao> {
  const supabase = await cliente();
  const argumentos: { _nota_id: string; _origem: string; _usuario_id?: string } = {
    _nota_id: notaId,
    _origem: origem,
  };
  if (usuarioId) argumentos._usuario_id = usuarioId;
  const { data, error } = await supabase.rpc("sorteio_gerar_cupons_da_nota", argumentos);
  if (error) throw new Error(error.message);

  const r = (data ?? {}) as {
    resultado?: string;
    motivo?: string;
    cupons?: number;
    saldo_centavos?: number;
  };
  if (r.resultado === "PROCESSADA") {
    return {
      resultado: "PROCESSADA",
      cupons: r.cupons ?? 0,
      saldoCentavos: r.saldo_centavos ?? 0,
    };
  }
  return { resultado: "IGNORADA", motivo: r.motivo ?? "desconhecido" };
}

export interface ResumoGeracao {
  analisadas: number;
  processadas: number;
  cupons: number;
  ignoradas: number;
  erros: number;
}

function resumoVazio(): ResumoGeracao {
  return { analisadas: 0, processadas: 0, cupons: 0, ignoradas: 0, erros: 0 };
}

/**
 * Processa as notas VÁLIDAS ainda não processadas de um sorteio ATIVO,
 * em ordem de cadastro (o saldo acumula na sequência correta).
 */
export async function processarCuponsPendentes(
  sorteioId: string,
  limite = 200,
  origem: OrigemGeracao = "rotina",
  usuarioId: string | null = null,
): Promise<ResumoGeracao> {
  const supabase = await cliente();
  const resumo = resumoVazio();

  const { data: sorteio, error: erroSorteio } = await supabase
    .from("sorteios")
    .select("id, status")
    .eq("id", sorteioId)
    .maybeSingle();
  if (erroSorteio) throw new Error(erroSorteio.message);
  if (!sorteio || sorteio.status !== "ATIVO") return resumo;

  const { data: notas, error } = await supabase
    .from("sorteio_notas")
    .select("id")
    .eq("sorteio_id", sorteioId)
    .eq("status", "VALIDA")
    .is("cupons_processado_em", null)
    .order("cadastrado_em", { ascending: true })
    .limit(Math.min(Math.max(limite, 1), 500));
  if (error) throw new Error(error.message);

  for (const nota of notas ?? []) {
    resumo.analisadas += 1;
    try {
      const r = await gerarCuponsDaNota(nota.id, origem, usuarioId);
      if (r.resultado === "PROCESSADA") {
        resumo.processadas += 1;
        resumo.cupons += r.cupons;
      } else {
        resumo.ignoradas += 1;
      }
    } catch (e) {
      resumo.erros += 1;
      console.error("[sorteios-cupons] falha ao gerar cupons da nota", nota.id, e);
    }
  }

  return resumo;
}

/** Processa os pendentes de todos os sorteios ATIVOS (rotina automática). */
export async function processarCuponsPendentesAtivos(limite = 200): Promise<ResumoGeracao> {
  const supabase = await cliente();
  const resumo = resumoVazio();

  const { data: ativos, error } = await supabase.from("sorteios").select("id").eq("status", "ATIVO");
  if (error) throw new Error(error.message);

  for (const s of ativos ?? []) {
    const parcial = await processarCuponsPendentes(s.id, limite, "rotina", null);
    resumo.analisadas += parcial.analisadas;
    resumo.processadas += parcial.processadas;
    resumo.cupons += parcial.cupons;
    resumo.ignoradas += parcial.ignoradas;
    resumo.erros += parcial.erros;
  }

  return resumo;
}

/* --------------------------------------------------------- recálculo de saldo */

export interface ConferenciaSaldo {
  participanteId: string;
  saldoAnteriorCentavos: number;
  saldoCentavos: number;
  totalNotasCentavos: number;
  consumidoCentavos: number;
  cuponsConsiderados: number;
  /** Cupons emitidos com o saldo liberado pelo cancelamento (mesma transação). */
  cuponsGeradosAposRecalculo: number;
  alterado: boolean;

}

/**
 * Recalcula o saldo de uma participação pela ÚNICA regra do sistema:
 * notas VÁLIDAS já processadas menos os cupons que continuam valendo
 * (ativos ou utilizados). Nunca fica negativo. Grava só quando muda e
 * registra na auditoria.
 */
export async function recalcularSaldoParticipante(
  participanteId: string,
  origem: OrigemGeracao | "cancelamento" = "rotina",
  usuarioId: string | null = null,
): Promise<ConferenciaSaldo | null> {
  const supabase = await cliente();
  const argumentos: { _participante_id: string; _origem: string; _usuario_id?: string } = {
    _participante_id: participanteId,
    _origem: origem,
  };
  if (usuarioId) argumentos._usuario_id = usuarioId;

  const { data, error } = await supabase.rpc("sorteio_recalcular_saldo_participante", argumentos);
  if (error) throw new Error(error.message);

  const r = (data ?? {}) as {
    resultado?: string;
    alterado?: boolean;
    saldo_anterior_centavos?: number;
    saldo_centavos?: number;
    total_notas_centavos?: number;
    consumido_centavos?: number;
    cupons_considerados?: number;
    cupons_gerados_apos_recalculo?: number;
  };
  if (r.resultado !== "OK") return null;

  return {
    participanteId,
    saldoAnteriorCentavos: r.saldo_anterior_centavos ?? 0,
    saldoCentavos: r.saldo_centavos ?? 0,
    totalNotasCentavos: r.total_notas_centavos ?? 0,
    consumidoCentavos: r.consumido_centavos ?? 0,
    cuponsConsiderados: r.cupons_considerados ?? 0,
    cuponsGeradosAposRecalculo: r.cupons_gerados_apos_recalculo ?? 0,
    alterado: r.alterado === true,
  };
}


/** Recalcula (e corrige) o saldo de todos os participantes de um sorteio. */
export async function recalcularSaldosDoSorteio(
  sorteioId: string,
  origem: OrigemGeracao | "cancelamento" = "painel",
  usuarioId: string | null = null,
): Promise<{ analisados: number; corrigidos: number }> {
  const supabase = await cliente();
  const { data: participantes, error } = await supabase
    .from("sorteio_participantes")
    .select("id")
    .eq("sorteio_id", sorteioId);
  if (error) throw new Error(error.message);

  let analisados = 0;
  let corrigidos = 0;
  for (const p of participantes ?? []) {
    analisados += 1;
    try {
      const r = await recalcularSaldoParticipante(p.id, origem, usuarioId);
      if (r?.alterado) corrigidos += 1;
    } catch (e) {
      console.error("[sorteios-cupons] falha ao recalcular saldo", p.id, e);
    }
  }
  return { analisados, corrigidos };
}

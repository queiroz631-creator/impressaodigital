/**
 * Validação das notas do sorteio (Etapa 4).
 *
 * Confere a nota do participante contra `public.sorteio_notas_base` usando
 * SEMPRE o sorteio da própria nota + número + valor em centavos. A data da
 * nota nunca participa da comparação.
 *
 * Regra da marca d'água: quando a nota não é encontrada na base, ela só vira
 * INVALIDA se `sorteios.base_sincronizada_em` for posterior ao cadastro da
 * nota. Sem sincronização registrada (ou anterior ao cadastro), a nota
 * permanece PENDENTE e é reavaliada na próxima rodada.
 *
 * Nada aqui gera cupom, número de cupom nem altera saldo.
 */
import type { Json } from "@/integrations/supabase/types";
import { EVENTOS_AUDITORIA } from "@/modules/sorteios/types";

export type OrigemValidacao = "rotina" | "painel";

export type ResultadoValidacao =
  | { resultado: "VALIDA" }
  | { resultado: "INVALIDA" }
  | { resultado: "PENDENTE"; motivo: "sem_sincronizacao" | "sincronizacao_anterior" }
  | { resultado: "IGNORADA"; motivo: "nota_nao_pendente" | "sorteio_inativo" | "concorrencia" };

async function cliente() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Valida uma nota específica. Relê nota e sorteio do banco antes de gravar e
 * só altera o registro se ele ainda estiver PENDENTE.
 */
export async function validarNotaPorId(
  notaId: string,
  origem: OrigemValidacao,
  usuarioId: string | null,
): Promise<ResultadoValidacao> {
  const supabase = await cliente();

  const { data: nota, error: erroNota } = await supabase
    .from("sorteio_notas")
    .select("id, sorteio_id, participante_id, numero, valor_centavos, status, cadastrado_em")
    .eq("id", notaId)
    .maybeSingle();
  if (erroNota) throw new Error(erroNota.message);
  if (!nota) throw new Error("Nota não encontrada.");
  if (nota.status !== "PENDENTE") {
    return { resultado: "IGNORADA", motivo: "nota_nao_pendente" };
  }

  const { data: sorteio, error: erroSorteio } = await supabase
    .from("sorteios")
    .select("id, status, base_sincronizada_em")
    .eq("id", nota.sorteio_id)
    .maybeSingle();
  if (erroSorteio) throw new Error(erroSorteio.message);
  if (!sorteio) throw new Error("Sorteio não encontrado.");
  if (sorteio.status !== "ATIVO") {
    return { resultado: "IGNORADA", motivo: "sorteio_inativo" };
  }

  const { data: base, error: erroBase } = await supabase
    .from("sorteio_notas_base")
    .select("id")
    .eq("sorteio_id", nota.sorteio_id)
    .eq("numero", nota.numero)
    .eq("valor_centavos", nota.valor_centavos)
    .maybeSingle();
  if (erroBase) throw new Error(erroBase.message);

  const agora = new Date().toISOString();

  if (!base) {
    const marca = sorteio.base_sincronizada_em;
    if (!marca) return { resultado: "PENDENTE", motivo: "sem_sincronizacao" };
    if (new Date(marca).getTime() <= new Date(nota.cadastrado_em).getTime()) {
      return { resultado: "PENDENTE", motivo: "sincronizacao_anterior" };
    }

    const { data: alteradas, error } = await supabase
      .from("sorteio_notas")
      .update({
        status: "INVALIDA",
        invalidado_em: agora,
        motivo_invalidez: "Nota não localizada na base do sorteio.",
      })
      .eq("id", nota.id)
      .eq("status", "PENDENTE")
      .select("id");
    if (error) throw new Error(error.message);
    if ((alteradas?.length ?? 0) !== 1) {
      return { resultado: "IGNORADA", motivo: "concorrencia" };
    }

    await auditar(supabase, {
      sorteio_id: nota.sorteio_id,
      participante_id: nota.participante_id,
      nota_id: nota.id,
      evento: EVENTOS_AUDITORIA.notaInvalidada,
      origem,
      usuario_id: usuarioId,
      detalhe: {
        anterior: "PENDENTE",
        novo: "INVALIDA",
        resultado: "nao_encontrada_na_base",
        numero: nota.numero,
        valor_centavos: nota.valor_centavos,
        base_sincronizada_em: marca,
      },
    });
    return { resultado: "INVALIDA" };
  }

  const { data: alteradas, error } = await supabase
    .from("sorteio_notas")
    .update({
      status: "VALIDA",
      validado_em: agora,
      invalidado_em: null,
      motivo_invalidez: null,
      nota_base_id: base.id,
    })
    .eq("id", nota.id)
    .eq("status", "PENDENTE")
    .select("id");
  if (error) throw new Error(error.message);
  if ((alteradas?.length ?? 0) !== 1) {
    return { resultado: "IGNORADA", motivo: "concorrencia" };
  }

  await auditar(supabase, {
    sorteio_id: nota.sorteio_id,
    participante_id: nota.participante_id,
    nota_id: nota.id,
    evento: EVENTOS_AUDITORIA.notaValidada,
    origem,
    usuario_id: usuarioId,
    detalhe: {
      anterior: "PENDENTE",
      novo: "VALIDA",
      resultado: "encontrada_na_base",
      numero: nota.numero,
      valor_centavos: nota.valor_centavos,
      nota_base_id: base.id,
    },
  });
  return { resultado: "VALIDA" };
}

export interface ResumoRodada {
  analisadas: number;
  validas: number;
  invalidas: number;
  pendentes: number;
  ignoradas: number;
}

/** Processa um lote limitado de notas PENDENTES de sorteios ATIVOS. */
export async function validarNotasPendentes(limite = 100): Promise<ResumoRodada> {
  const supabase = await cliente();
  const resumo: ResumoRodada = {
    analisadas: 0,
    validas: 0,
    invalidas: 0,
    pendentes: 0,
    ignoradas: 0,
  };

  const { data: ativos, error: erroAtivos } = await supabase
    .from("sorteios")
    .select("id")
    .eq("status", "ATIVO");
  if (erroAtivos) throw new Error(erroAtivos.message);
  const ids = (ativos ?? []).map((s) => s.id);
  if (ids.length === 0) return resumo;

  const { data: notas, error } = await supabase
    .from("sorteio_notas")
    .select("id")
    .eq("status", "PENDENTE")
    .in("sorteio_id", ids)
    .order("cadastrado_em", { ascending: true })
    .limit(Math.min(Math.max(limite, 1), 500));
  if (error) throw new Error(error.message);

  for (const nota of notas ?? []) {
    resumo.analisadas += 1;
    try {
      const r = await validarNotaPorId(nota.id, "rotina", null);
      if (r.resultado === "VALIDA") resumo.validas += 1;
      else if (r.resultado === "INVALIDA") resumo.invalidas += 1;
      else if (r.resultado === "PENDENTE") resumo.pendentes += 1;
      else resumo.ignoradas += 1;
    } catch (e) {
      resumo.ignoradas += 1;
      console.error("[sorteios-validacao] falha ao validar nota", nota.id, e);
    }
  }

  return resumo;
}

/**
 * Validação orientada a evento: processa APENAS as notas PENDENTES do sorteio
 * informado (usada quando um lote da base daquele sorteio é confirmado).
 * A regra de validação é exatamente a mesma — nada aqui a altera.
 */
export async function validarNotasPendentesDoSorteio(
  sorteioId: string,
  limite = 200,
): Promise<ResumoRodada> {
  const supabase = await cliente();
  const resumo: ResumoRodada = {
    analisadas: 0,
    validas: 0,
    invalidas: 0,
    pendentes: 0,
    ignoradas: 0,
  };

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
    .eq("status", "PENDENTE")
    .order("cadastrado_em", { ascending: true })
    .limit(Math.min(Math.max(limite, 1), 500));
  if (error) throw new Error(error.message);

  for (const nota of notas ?? []) {
    resumo.analisadas += 1;
    try {
      const r = await validarNotaPorId(nota.id, "rotina", null);
      if (r.resultado === "VALIDA") resumo.validas += 1;
      else if (r.resultado === "INVALIDA") resumo.invalidas += 1;
      else if (r.resultado === "PENDENTE") resumo.pendentes += 1;
      else resumo.ignoradas += 1;
    } catch (e) {
      resumo.ignoradas += 1;
      console.error("[sorteios-validacao] falha ao validar nota", nota.id, e);
    }
  }

  return resumo;
}

type ClienteAdmin = Awaited<ReturnType<typeof cliente>>;

async function auditar(
  supabase: ClienteAdmin,
  dados: {
    sorteio_id: string;
    participante_id: string;
    nota_id: string;
    evento: string;
    origem: OrigemValidacao;
    usuario_id: string | null;
    detalhe: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("sorteio_auditoria").insert({
    sorteio_id: dados.sorteio_id,
    participante_id: dados.participante_id,
    nota_id: dados.nota_id,
    evento: dados.evento,
    origem: dados.origem,
    usuario_id: dados.usuario_id,
    detalhe: dados.detalhe as Json,
  });
  if (error) throw new Error(`Falha ao registrar auditoria: ${error.message}`);
}

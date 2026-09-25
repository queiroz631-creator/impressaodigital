import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  esquemaPremio,
  esquemaSorteio,
  esquemaTermos,
} from "@/modules/sorteios/validations/sorteio";
import {
  CAMPOS_CRITICOS,
  motivoBloqueioCriticos,
  podeTransicionar,
  somenteConsulta,
} from "@/modules/sorteios/services/status";
import type { StatusSorteio, TotaisConferencia } from "@/modules/sorteios/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

/**
 * Operações administrativas do módulo Sorteios.
 *
 * Nada aqui confia no navegador: permissão, existência do sorteio, situação
 * atual e movimentação são relidos do banco imediatamente antes de gravar.
 */

type Cliente = SupabaseClient<Database>;

/** Exige administrador OU permissão sensível de gerenciamento de sorteios. */
async function exigirGestao(context: { supabase: Cliente; userId: string }) {
  const { data: isAdmin, error: erroRole } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (erroRole) throw new Error(erroRole.message);
  if (isAdmin) return;

  const { data: permitido, error } = await context.supabase.rpc("tem_permissao", {
    _user_id: context.userId,
    _chave: "sorteios.gerenciar",
  });
  if (error) throw new Error(error.message);
  if (!permitido) throw new Error("Você não tem permissão para gerenciar sorteios.");
}

async function registrarAuditoria(
  supabase: Cliente,
  dados: {
    sorteio_id?: string | null;
    evento: string;
    usuario_id: string;
    detalhe?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("sorteio_auditoria").insert({
    sorteio_id: dados.sorteio_id ?? null,
    evento: dados.evento,
    origem: "painel",
    usuario_id: dados.usuario_id,
    detalhe: (dados.detalhe ?? {}) as Json,
  });
  // Auditoria nunca deve ser silenciosa.
  if (error) throw new Error(`Falha ao registrar auditoria: ${error.message}`);
}

/** Situação atual + total de movimentação histórica do sorteio, lidos do banco. */
type TabelaMovimentacao =
  "sorteio_participantes" | "sorteio_notas" | "sorteio_cupons" | "sorteio_historico";

async function lerSorteioAtual(supabase: Cliente, sorteioId: string) {
  const { data: sorteio, error } = await supabase
    .from("sorteios")
    .select("id, status, numero_sorteio")
    .eq("id", sorteioId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!sorteio) throw new Error("Sorteio não encontrado.");

  const contar = async (tabela: TabelaMovimentacao) => {
    const { count, error: erroCount } = await supabase
      .from(tabela)
      .select("id", { count: "exact", head: true })
      .eq("sorteio_id", sorteioId);
    if (erroCount) throw new Error(erroCount.message);
    return count ?? 0;
  };

  // Inclui registros cancelados e o histórico: cancelar/apagar não libera a
  // proteção dos campos críticos.
  const movimentacoes =
    (await contar("sorteio_participantes")) +
    (await contar("sorteio_notas")) +
    (await contar("sorteio_cupons")) +
    (await contar("sorteio_historico"));

  return {
    status: sorteio.status as StatusSorteio,
    numero_sorteio: sorteio.numero_sorteio as number,
    movimentacoes,
  };
}

function erroAmigavel(mensagem: string): Error {
  if (/numero_sorteio/i.test(mensagem) && /duplicate|unique/i.test(mensagem)) {
    return new Error("Já existe um sorteio com este número. Informe outro número.");
  }
  if (/sorteio_termos_sorteio_id_versao/i.test(mensagem) || /versao/i.test(mensagem)) {
    if (/duplicate|unique/i.test(mensagem)) {
      return new Error("Já existe esta versão de termos neste sorteio.");
    }
  }
  if (/duplicate|unique/i.test(mensagem)) {
    return new Error("Este registro já existe.");
  }
  return new Error(mensagem);
}

/* ------------------------------------------------------------------ sorteio */

export const criarSorteio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => esquemaSorteio.parse(input))
  .handler(async ({ data, context }) => {
    await exigirGestao(context);

    const { data: criado, error } = await context.supabase
      .from("sorteios")
      .insert({
        nome: data.nome,
        numero_sorteio: data.numero_sorteio,
        descricao: data.descricao,
        data_inicio: data.data_inicio,
        data_fim: data.data_fim,
        data_sorteio: data.data_sorteio,
        valor_por_cupom_centavos: data.valor_por_cupom_centavos,
        quantidade_maxima_cupons: data.quantidade_maxima_cupons,
        valor_minimo_nota_centavos: data.valor_minimo_nota_centavos,
        status: "RASCUNHO",
        criado_por: context.userId,
      })
      .select("id")
      .single();
    if (error) throw erroAmigavel(error.message);

    await registrarAuditoria(context.supabase, {
      sorteio_id: criado.id,
      evento: "sorteio.criado",
      usuario_id: context.userId,
      detalhe: {
        nome: data.nome,
        numero_sorteio: data.numero_sorteio,
        valor_por_cupom_centavos: data.valor_por_cupom_centavos,
      },
    });

    return { id: criado.id as string };
  });

export const atualizarSorteio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), dados: esquemaSorteio }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await exigirGestao(context);

    const atual = await lerSorteioAtual(context.supabase, data.id);
    if (somenteConsulta(atual.status)) {
      throw new Error("Este sorteio está somente para consulta e não pode ser alterado.");
    }

    const motivoBloqueio = motivoBloqueioCriticos(atual.status, atual.movimentacoes);
    const criticosLiberados = motivoBloqueio === null;

    const { data: antes, error: erroAntes } = await context.supabase
      .from("sorteios")
      .select(
        "nome, descricao, numero_sorteio, data_inicio, data_fim, data_sorteio, valor_por_cupom_centavos, quantidade_maxima_cupons, valor_minimo_nota_centavos",
      )
      .eq("id", data.id)
      .single();
    if (erroAntes) throw new Error(erroAntes.message);

    const alteracao: Database["public"]["Tables"]["sorteios"]["Update"] = {
      nome: data.dados.nome,
      descricao: data.dados.descricao,
      data_inicio: data.dados.data_inicio,
      data_fim: data.dados.data_fim,
      data_sorteio: data.dados.data_sorteio,
      quantidade_maxima_cupons: data.dados.quantidade_maxima_cupons,
      valor_minimo_nota_centavos: data.dados.valor_minimo_nota_centavos,
    };

    if (criticosLiberados) {
      alteracao.numero_sorteio = data.dados.numero_sorteio;
      alteracao.valor_por_cupom_centavos = data.dados.valor_por_cupom_centavos;
    } else {
      // Confere no servidor se o navegador tentou mexer em campo travado.
      const iguais = CAMPOS_CRITICOS.every(
        (campo) => data.dados[campo] === (antes as Record<string, unknown>)[campo],
      );
      if (!iguais) throw new Error(motivoBloqueio);
    }

    const ehData = (c: string) => c.startsWith("data_");
    const mudancas: Record<string, { antes: unknown; depois: unknown }> = {};
    for (const [campo, depois] of Object.entries(alteracao)) {
      const anterior = (antes as Record<string, unknown>)[campo];
      const igual = ehData(campo)
        ? new Date(String(anterior)).getTime() === new Date(String(depois)).getTime()
        : (anterior ?? null) === (depois ?? null);
      if (!igual) mudancas[campo] = { antes: anterior ?? null, depois: depois ?? null };
    }

    const { error } = await context.supabase
      .from("sorteios")
      .update(alteracao)
      .eq("id", data.id)
      .eq("status", atual.status);
    if (error) throw erroAmigavel(error.message);

    await registrarAuditoria(context.supabase, {
      sorteio_id: data.id,
      evento: "sorteio.alterado",
      usuario_id: context.userId,
      detalhe: {
        situacao: atual.status,
        mudancas,
        criticos_liberados: criticosLiberados,
      },
    });

    return { ok: true };
  });

export const alterarStatusSorteio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["RASCUNHO", "ATIVO", "ENCERRADO", "CANCELADO", "SORTEADO"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await exigirGestao(context);

    const atual = await lerSorteioAtual(context.supabase, data.id);
    // O encerramento nunca passa por aqui: ele exige a conferência completa.
    if (atual.status === "ATIVO" && data.status === "ENCERRADO") {
      throw new Error(
        "Use a conferência para encerramento no painel do sorteio para encerrá-lo.",
      );
    }
    // A reabertura também não: ela exige a função dedicada, que limpa os dados
    // do encerramento e grava a auditoria `sorteio.reaberto`.
    if (atual.status === "ENCERRADO" && data.status === "ATIVO") {
      throw new Error("Use o botão Reabrir sorteio na aba Encerramento para reabri-lo.");
    }
    if (atual.status === "CANCELADO") {
      throw new Error("Use o botão Reabrir sorteio no painel do sorteio para reabri-lo.");
    }
    if (!podeTransicionar(atual.status, data.status as StatusSorteio)) {
      throw new Error(`Não é possível mudar de ${atual.status} para ${data.status}.`);
    }


    const { error } = await context.supabase
      .from("sorteios")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("status", atual.status);
    if (error) throw new Error(error.message);

    await registrarAuditoria(context.supabase, {
      sorteio_id: data.id,
      evento: "sorteio.status_alterado",
      usuario_id: context.userId,
      detalhe: { de: atual.status, para: data.status },
    });

    return { ok: true };
  });

/* ------------------------------------------------------------------- termos */

export const salvarTermos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sorteioId: z.string().uuid(),
        termosId: z.string().uuid().nullable().default(null),
        dados: esquemaTermos,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await exigirGestao(context);

    const atual = await lerSorteioAtual(context.supabase, data.sorteioId);
    if (somenteConsulta(atual.status)) {
      throw new Error("Este sorteio está somente para consulta.");
    }

    if (data.termosId) {
      const { error } = await context.supabase
        .from("sorteio_termos")
        .update(data.dados)
        .eq("id", data.termosId)
        .eq("sorteio_id", data.sorteioId);
      if (error) throw erroAmigavel(error.message);

      await registrarAuditoria(context.supabase, {
        sorteio_id: data.sorteioId,
        evento: "termos.alterados",
        usuario_id: context.userId,
        detalhe: { termos_id: data.termosId, versao: data.dados.versao },
      });
      return { id: data.termosId };
    }

    const { data: criado, error } = await context.supabase
      .from("sorteio_termos")
      .insert({ ...data.dados, sorteio_id: data.sorteioId })
      .select("id")
      .single();
    if (error) throw erroAmigavel(error.message);

    await registrarAuditoria(context.supabase, {
      sorteio_id: data.sorteioId,
      evento: "termos.criados",
      usuario_id: context.userId,
      detalhe: { termos_id: criado.id, versao: data.dados.versao },
    });

    return { id: criado.id as string };
  });

export const definirTermosAtual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sorteioId: z.string().uuid(), termosId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await exigirGestao(context);

    const { data: termos, error: erroTermos } = await context.supabase
      .from("sorteio_termos")
      .select("id, versao, sorteio_id")
      .eq("id", data.termosId)
      .eq("sorteio_id", data.sorteioId)
      .maybeSingle();
    if (erroTermos) throw new Error(erroTermos.message);
    if (!termos) throw new Error("Versão de termos não encontrada neste sorteio.");

    // Troca atômica no banco: desmarca a anterior e marca a nova.
    const { error } = await context.supabase.rpc("sorteio_definir_termos_atual", {
      _termos_id: data.termosId,
    });
    if (error) throw new Error(error.message);

    await registrarAuditoria(context.supabase, {
      sorteio_id: data.sorteioId,
      evento: "termos.versao_atual_definida",
      usuario_id: context.userId,
      detalhe: { termos_id: data.termosId, versao: termos.versao },
    });

    return { ok: true };
  });

/* ------------------------------------------------------------------ prêmios */

export const salvarPremio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sorteioId: z.string().uuid(),
        premioId: z.string().uuid().nullable().default(null),
        dados: esquemaPremio,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await exigirGestao(context);

    const atual = await lerSorteioAtual(context.supabase, data.sorteioId);
    if (somenteConsulta(atual.status)) {
      throw new Error("Este sorteio está somente para consulta.");
    }

    if (data.premioId) {
      const { error } = await context.supabase
        .from("sorteio_premios")
        .update(data.dados)
        .eq("id", data.premioId)
        .eq("sorteio_id", data.sorteioId);
      if (error) throw erroAmigavel(error.message);

      await registrarAuditoria(context.supabase, {
        sorteio_id: data.sorteioId,
        evento: "premio.alterado",
        usuario_id: context.userId,
        detalhe: { premio_id: data.premioId, nome: data.dados.nome, ativo: data.dados.ativo },
      });
      return { id: data.premioId };
    }

    const { data: criado, error } = await context.supabase
      .from("sorteio_premios")
      .insert({ ...data.dados, sorteio_id: data.sorteioId })
      .select("id")
      .single();
    if (error) throw erroAmigavel(error.message);

    await registrarAuditoria(context.supabase, {
      sorteio_id: data.sorteioId,
      evento: "premio.criado",
      usuario_id: context.userId,
      detalhe: { premio_id: criado.id, nome: data.dados.nome },
    });

    return { id: criado.id as string };
  });

export const alternarPremio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sorteioId: z.string().uuid(),
        premioId: z.string().uuid(),
        ativo: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await exigirGestao(context);

    const atual = await lerSorteioAtual(context.supabase, data.sorteioId);
    if (somenteConsulta(atual.status)) {
      throw new Error("Este sorteio está somente para consulta.");
    }

    const { error } = await context.supabase
      .from("sorteio_premios")
      .update({ ativo: data.ativo })
      .eq("id", data.premioId)
      .eq("sorteio_id", data.sorteioId);
    if (error) throw new Error(error.message);

    await registrarAuditoria(context.supabase, {
      sorteio_id: data.sorteioId,
      evento: data.ativo ? "premio.ativado" : "premio.desativado",
      usuario_id: context.userId,
      detalhe: { premio_id: data.premioId },
    });

    return { ok: true };
  });

/* ----------------------------------------------------------- participantes */

/**
 * Liga/desliga a elegibilidade do participante NESTE sorteio.
 * Não altera cliente, notas, cupons, saldo nem outros sorteios.
 */
export const definirElegibilidadeParticipante = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sorteioId: z.string().uuid(),
        participanteId: z.string().uuid(),
        concorre: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await exigirGestao(context);

    const atual = await lerSorteioAtual(context.supabase, data.sorteioId);
    if (somenteConsulta(atual.status)) {
      throw new Error("Este sorteio está somente para consulta.");
    }

    const { data: participante, error: erroLeitura } = await context.supabase
      .from("sorteio_participantes")
      .select("id, concorre_sorteio")
      .eq("id", data.participanteId)
      .eq("sorteio_id", data.sorteioId)
      .maybeSingle();
    if (erroLeitura) throw new Error(erroLeitura.message);
    if (!participante) throw new Error("Participante não encontrado neste sorteio.");

    const anterior = participante.concorre_sorteio as boolean;
    if (anterior === data.concorre) return { ok: true, alterado: false };

    const { data: atualizados, error } = await context.supabase
      .from("sorteio_participantes")
      .update({ concorre_sorteio: data.concorre })
      .eq("id", data.participanteId)
      .eq("sorteio_id", data.sorteioId)
      .select("id");
    if (error) throw new Error(error.message);
    if ((atualizados?.length ?? 0) !== 1) {
      throw new Error("Não foi possível alterar a participação. Tente novamente.");
    }

    await registrarAuditoria(context.supabase, {
      sorteio_id: data.sorteioId,
      evento: "participante.elegibilidade_alterada",
      usuario_id: context.userId,
      detalhe: {
        participante_id: data.participanteId,
        anterior,
        novo: data.concorre,
      },
    });

    return { ok: true, alterado: true };
  });

/* ------------------------------------------------------- validação de notas */

/**
 * Validação manual de UMA nota pendente, pelo painel.
 * O sorteio é obtido do próprio registro da nota; nada vem do navegador além
 * do identificador da nota. Não gera cupons nem altera saldo.
 */
export const validarNotaSorteio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ notaId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await exigirGestao(context);

    const { data: nota, error } = await context.supabase
      .from("sorteio_notas")
      .select("id, sorteio_id, status")
      .eq("id", data.notaId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!nota) throw new Error("Nota não encontrada.");

    const atual = await lerSorteioAtual(context.supabase, nota.sorteio_id as string);
    if (atual.status !== "ATIVO") {
      throw new Error("Este sorteio não permite mais validação de notas.");
    }
    if (nota.status !== "PENDENTE") {
      throw new Error("Somente notas pendentes podem ser validadas.");
    }

    const { validarNotaPorId } = await import("@/lib/sorteios-validacao.server");
    const r = await validarNotaPorId(data.notaId, "painel", context.userId);

    if (r.resultado === "PENDENTE") {
      return {
        resultado: r.resultado,
        mensagem:
          r.motivo === "sem_sincronizacao"
            ? "A base de notas deste sorteio ainda não foi sincronizada. A nota continua pendente."
            : "A base de notas foi sincronizada antes do cadastro desta nota. Ela continua pendente.",
      };
    }
    if (r.resultado === "IGNORADA") {
      return { resultado: r.resultado, mensagem: "A nota já havia sido processada." };
    }
    return {
      resultado: r.resultado,
      mensagem: r.resultado === "VALIDA" ? "Nota validada." : "Nota marcada como inválida.",
    };
  });

/* ------------------------------------------------- saldo e geração de cupons */

/**
 * Processa o saldo e gera os cupons das notas válidas ainda não processadas
 * deste sorteio. O navegador informa apenas o identificador do sorteio: a
 * quantidade de cupons é sempre calculada no banco, nota por nota, e a
 * operação é idempotente (rodar de novo não duplica nada).
 */
export const processarCuponsDoSorteio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sorteioId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await exigirGestao(context);

    const atual = await lerSorteioAtual(context.supabase, data.sorteioId);
    if (atual.status !== "ATIVO") {
      throw new Error("Somente sorteios ativos geram cupons.");
    }

    const { processarCuponsPendentes, recalcularSaldosDoSorteio } = await import(
      "@/lib/sorteios-cupons.server"
    );
    const resumo = await processarCuponsPendentes(data.sorteioId, 500, "painel", context.userId);

    // Acerta saldos divergentes (ex.: notas canceladas antes desta rotina existir).
    const saldos = await recalcularSaldosDoSorteio(data.sorteioId, "painel", context.userId);

    return { ...resumo, saldosAnalisados: saldos.analisados, saldosCorrigidos: saldos.corrigidos };
  });

/* ------------------------------------------------------------- encerramento */

/**
 * Conferência somente leitura do sorteio (totais, pendências e inconsistências).
 * Não corrige, não recalcula e não gera cupom.
 */
export const conferenciaEncerramentoSorteio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sorteioId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await exigirGestao(context);
    const { conferenciaSorteio } = await import("@/lib/sorteios-encerramento.server");
    return conferenciaSorteio(data.sorteioId);
  });

/**
 * Encerra o sorteio (ATIVO → ENCERRADO). O navegador não decide nada: a função
 * do banco trava o sorteio, refaz a conferência dentro da mesma transação,
 * grava o retrato que autorizou o encerramento e registra a auditoria. Qualquer
 * falha desfaz tudo.
 */
export const encerrarSorteio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sorteioId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await exigirGestao(context);
    const { encerrarSorteioNoBanco } = await import("@/lib/sorteios-encerramento.server");
    return encerrarSorteioNoBanco(data.sorteioId, context.userId);
  });

/** Totais de leitura para alternar entre participantes concorrentes e todos. */
export const totaisSorteioPorElegibilidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sorteioId: z.string().uuid(), apenasConcorrentes: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: totais, error } = await context.supabase.rpc(
      "sorteio_totais_por_elegibilidade",
      {
        _sorteio_id: data.sorteioId,
        _apenas_concorrentes: data.apenasConcorrentes,
      },
    );
    if (error) throw new Error(error.message);
    return totais as unknown as Omit<TotaisConferencia, "participantes_concorrentes">;
  });

/**
 * Reabre o sorteio (ENCERRADO → ATIVO). Única exceção à regra de nunca voltar
 * a uma situação anterior. A decisão é do banco, em uma única transação: trava
 * o sorteio, confere a situação, limpa os dados do encerramento, preserva o
 * retrato da conferência como histórico e grava a auditoria `sorteio.reaberto`.
 */
export const reabrirSorteio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sorteioId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await exigirGestao(context);
    const { reabrirSorteioNoBanco } = await import("@/lib/sorteios-encerramento.server");
    return reabrirSorteioNoBanco(data.sorteioId, context.userId);
  });

/* ---------------------------------------------------------------- apuração */

/** Resumo somente leitura da apuração (indicadores, prêmios e ganhadores). */
export const resumoApuracaoSorteio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sorteioId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await exigirGestao(context);
    const { resumoApuracao } = await import("@/lib/sorteios-apuracao.server");
    return resumoApuracao(data.sorteioId);
  });

/**
 * Sorteia a próxima unidade de prêmio. Tudo acontece na função do banco, em uma
 * única transação: o navegador nunca escolhe o cupom vencedor.
 */
export const realizarSorteio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sorteioId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await exigirGestao(context);
    const { realizarSorteioNoBanco, mensagemRecusa } = await import(
      "@/lib/sorteios-apuracao.server"
    );
    const r = await realizarSorteioNoBanco(data.sorteioId, context.userId);
    if (r.resultado === "IGNORADO") {
      throw new Error(mensagemRecusa(r.motivo));
    }
    return r;
  });

/**
 * Dados completos do participante ganhador (CPF, telefone etc.), buscados sob
 * demanda no servidor. A listagem do histórico continua protegida; só quem
 * tem permissão de gestão revela os dados, um ganhador por vez.
 */
export const dadosCompletosGanhador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ganhadorId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await exigirGestao(context);
    const { supabase } = context;

    const { data: ganhador, error: erroGanhador } = await supabase
      .from("sorteio_ganhadores")
      .select("id, numero_cupom, unidade, sorteado_em, participante_id, premio_id")
      .eq("id", data.ganhadorId)
      .maybeSingle();
    if (erroGanhador) throw new Error(erroGanhador.message);
    if (!ganhador) throw new Error("Ganhador não encontrado.");

    const [{ data: participante, error: erroParticipante }, premio] = await Promise.all([
      supabase
        .from("sorteio_participantes")
        .select("cliente_id")
        .eq("id", ganhador.participante_id)
        .maybeSingle(),
      ganhador.premio_id
        ? supabase
            .from("sorteio_premios")
            .select("nome, quantidade")
            .eq("id", ganhador.premio_id)
            .maybeSingle()
            .then((r) => r.data)
        : Promise.resolve(null),
    ]);
    if (erroParticipante) throw new Error(erroParticipante.message);
    if (!participante) throw new Error("Participante do ganhador não encontrado.");

    const { data: cliente, error: erroCliente } = await supabase
      .from("clientes")
      .select("nome, cpf, telefone, data_nascimento, email")
      .eq("id", participante.cliente_id)
      .maybeSingle();
    if (erroCliente) throw new Error(erroCliente.message);
    if (!cliente) throw new Error("Cadastro do participante não encontrado.");

    return {
      ganhador_id: ganhador.id,
      numero_cupom: ganhador.numero_cupom,
      premio_nome: premio?.nome ?? null,
      premio_quantidade: premio?.quantidade ?? null,
      unidade: ganhador.unidade,
      sorteado_em: ganhador.sorteado_em,
      nome: cliente.nome,
      cpf: cliente.cpf,
      telefone: cliente.telefone,
      data_nascimento: cliente.data_nascimento,
      email: cliente.email,
    };
  });

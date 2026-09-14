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
import type { StatusSorteio } from "@/modules/sorteios/types";
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

    const alteracao: Database["public"]["Tables"]["sorteios"]["Update"] = {
      nome: data.dados.nome,
      descricao: data.dados.descricao,
      data_sorteio: data.dados.data_sorteio,
      quantidade_maxima_cupons: data.dados.quantidade_maxima_cupons,
    };

    if (criticosLiberados) {
      alteracao.numero_sorteio = data.dados.numero_sorteio;
      alteracao.data_inicio = data.dados.data_inicio;
      alteracao.data_fim = data.dados.data_fim;
      alteracao.valor_por_cupom_centavos = data.dados.valor_por_cupom_centavos;
    } else {
      // Confere no servidor se o navegador tentou mexer em campo crítico.
      const { data: antes, error: erroAntes } = await context.supabase
        .from("sorteios")
        .select("numero_sorteio, data_inicio, data_fim, valor_por_cupom_centavos")
        .eq("id", data.id)
        .single();
      if (erroAntes) throw new Error(erroAntes.message);

      const iguais = CAMPOS_CRITICOS.every((campo) => {
        const enviado = data.dados[campo];
        const gravado = (antes as Record<string, unknown>)[campo];
        if (campo === "data_inicio" || campo === "data_fim") {
          return new Date(String(enviado)).getTime() === new Date(String(gravado)).getTime();
        }
        return enviado === gravado;
      });
      if (!iguais) throw new Error(motivoBloqueio);
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
      detalhe: { campos: Object.keys(alteracao), criticos_liberados: criticosLiberados },
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

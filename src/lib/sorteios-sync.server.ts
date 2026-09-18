/**
 * Etapa 5 — Infraestrutura de sincronização (loja ⇄ Supabase).
 *
 * Princípios:
 * - o estado oficial é o banco (fila + cursores + log de execuções);
 * - a fila guarda apenas metadados de processamento, nunca cópia do cadastro;
 * - lotes são confirmados de forma independente e `sorteios.base_sincronizada_em`
 *   só avança na confirmação;
 * - tudo é idempotente: reenviar o mesmo lote não duplica nada;
 * - alteração vinda da LOJA nunca volta para a LOJA (sem loop).
 *
 * Nada aqui gera cupom, número de cupom ou saldo.
 */
import { enfileirar, dispararValidacaoDoSorteio } from "@/lib/sorteios-eventos.server";

export const ORIGENS = ["LOJA", "SUPABASE"] as const;
export type OrigemSync = (typeof ORIGENS)[number];

export interface NotaLoja {
  numero: string;
  valorCentavos: number;
  origemId?: string | null | undefined;
  dataNota?: string | null | undefined;
  /** Código do cliente da loja (id_entidade) dono da nota. */
  clienteOrigemId?: string | null | undefined;
}

export interface ClienteLoja {
  origemId: string;
  nome: string;
  cpf?: string | null | undefined;
  telefone?: string | null | undefined;
  email?: string | null | undefined;
  dataNascimento?: string | null | undefined;
}

async function cliente() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type ClienteAdmin = Awaited<ReturnType<typeof cliente>>;

function somenteDigitos(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const d = valor.replace(/\D/g, "");
  return d.length > 0 ? d : null;
}

/* -------------------------------------------------------------- log de lote */

/** Abre (ou reencontra) o registro de execução do lote. Idempotente por `loteId`. */
async function abrirLote(
  supabase: ClienteAdmin,
  dados: {
    loteId: string;
    /** Restrito aos valores aceitos pelo registro de execuções. */
    tipo: "NOTAS" | "CLIENTES";
    direcao: string;
    origem: OrigemSync;
    destino: OrigemSync;
    sorteioId?: string | null | undefined;
    enviados: number;
  },
) {
  const { data: existente } = await supabase
    .from("sorteio_sincronizacoes")
    .select("id, status")
    .eq("lote_id", dados.loteId)
    .maybeSingle();
  if (existente) return existente;

  const { data, error } = await supabase
    .from("sorteio_sincronizacoes")
    .insert({
      lote_id: dados.loteId,
      operacao_id: dados.loteId,
      tipo: dados.tipo,
      direcao: dados.direcao,
      origem: dados.origem,
      destino: dados.destino,
      sorteio_id: dados.sorteioId ?? null,
      status: "EXECUTANDO",
      registros_enviados: dados.enviados,
      registros_recebidos: dados.enviados,
    })
    .select("id, status")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function fecharLote(
  supabase: ClienteAdmin,
  loteId: string,
  dados: { status: "CONCLUIDA" | "ERRO" | "PARCIAL"; processados?: number; erro?: string | null },
) {
  const { data: registro } = await supabase
    .from("sorteio_sincronizacoes")
    .select("iniciado_em")
    .eq("lote_id", loteId)
    .maybeSingle();

  const inicio = registro?.iniciado_em ? new Date(registro.iniciado_em).getTime() : null;
  const agora = new Date();

  await supabase
    .from("sorteio_sincronizacoes")
    .update({
      status: dados.status,
      finalizado_em: agora.toISOString(),
      duracao_ms: inicio ? agora.getTime() - inicio : null,
      registros_processados: dados.processados ?? 0,
      erro: dados.erro ?? null,
    })
    .eq("lote_id", loteId);
}

/* ------------------------------------------------- NOTAS: loja → Supabase */

export interface ResultadoNotasLote {
  loteId: string;
  recebidas: number;
  gravadas: number;
}

/**
 * Recebe um lote de notas da base do sorteio. NÃO atualiza
 * `base_sincronizada_em` — isso só acontece em `confirmarNotasLote`.
 */
export async function receberNotasLote(entrada: {
  loteId: string;
  sorteioId: string;
  notas: NotaLoja[];
}): Promise<ResultadoNotasLote> {
  const supabase = await cliente();

  const { data: sorteio, error: erroSorteio } = await supabase
    .from("sorteios")
    .select("id")
    .eq("id", entrada.sorteioId)
    .maybeSingle();
  if (erroSorteio) throw new Error(erroSorteio.message);
  if (!sorteio) throw new Error("Sorteio não encontrado.");

  await abrirLote(supabase, {
    loteId: entrada.loteId,
    tipo: "NOTAS",
    direcao: "LOCAL_PARA_SUPABASE",
    origem: "LOJA",
    destino: "SUPABASE",
    sorteioId: entrada.sorteioId,
    enviados: entrada.notas.length,
  });

  try {
    const linhas = entrada.notas.map((n) => ({
      sorteio_id: entrada.sorteioId,
      numero: n.numero,
      valor_centavos: n.valorCentavos,
      data_nota: n.dataNota ?? null,
      origem_id: n.origemId ?? null,
      cliente_origem_id: n.clienteOrigemId ?? null,
      sincronizado_em: new Date().toISOString(),
    }));

    // Idempotência: a unicidade (sorteio_id, numero) impede duplicar a nota.
    const { data, error } = await supabase
      .from("sorteio_notas_base")
      .upsert(linhas, { onConflict: "sorteio_id,numero" })
      .select("id");
    if (error) throw new Error(error.message);

    // Clientes já ligados à loja recebem na hora a participação e as notas.
    const origens = [
      ...new Set(entrada.notas.map((n) => n.clienteOrigemId).filter((v): v is string => !!v)),
    ];
    for (const origemId of origens) {
      await vincularParticipacaoPorOrigemLoja(supabase, { origemId });
    }

    return {
      loteId: entrada.loteId,
      recebidas: entrada.notas.length,
      gravadas: data?.length ?? 0,
    };
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Erro inesperado";
    await fecharLote(supabase, entrada.loteId, { status: "ERRO", erro: mensagem });
    throw new Error(mensagem);
  }
}

export interface ResultadoConfirmacao {
  loteId: string;
  sorteioId: string;
  baseSincronizadaEm: string;
  validacao: { analisadas: number; validas: number; invalidas: number; pendentes: number };
}

/**
 * Confirma o lote: só aqui `base_sincronizada_em` avança, o evento é
 * registrado e a validação das notas PENDENTES é acionada — somente para o
 * sorteio do lote.
 */
export async function confirmarNotasLote(entrada: {
  loteId: string;
  sorteioId: string;
  processadas?: number | undefined;
}): Promise<ResultadoConfirmacao> {
  const supabase = await cliente();

  const { data: lote, error: erroLote } = await supabase
    .from("sorteio_sincronizacoes")
    .select("id, status, sorteio_id, registros_recebidos")
    .eq("lote_id", entrada.loteId)
    .maybeSingle();
  if (erroLote) throw new Error(erroLote.message);
  if (!lote) throw new Error("Lote não encontrado.");
  if (lote.sorteio_id && lote.sorteio_id !== entrada.sorteioId) {
    throw new Error("Lote pertence a outro sorteio.");
  }

  const agora = new Date().toISOString();

  await fecharLote(supabase, entrada.loteId, {
    status: "CONCLUIDA",
    processados: entrada.processadas ?? lote.registros_recebidos ?? 0,
  });

  const { error: erroMarca } = await supabase
    .from("sorteios")
    .update({ base_sincronizada_em: agora })
    .eq("id", entrada.sorteioId);
  if (erroMarca) throw new Error(erroMarca.message);

  // Evento (idempotente por lote) + validação apenas deste sorteio.
  await enfileirar(supabase, {
    tipo: "NOTAS_LOJA_SUPABASE",
    entidade: "BASE_NOTAS",
    entidadeId: entrada.sorteioId,
    sorteioId: entrada.sorteioId,
    origem: "LOJA",
    destino: "SUPABASE",
    operacao: "BASE_CONFIRMADA",
    operacaoId: `lote:${entrada.loteId}`,
    status: "SINCRONIZADO",
    metadados: { lote_id: entrada.loteId },
  });

  const validacao = await dispararValidacaoDoSorteio(entrada.sorteioId);

  return {
    loteId: entrada.loteId,
    sorteioId: entrada.sorteioId,
    baseSincronizadaEm: agora,
    validacao,
  };
}

/* ------------------------------------------- NOTAS: sorteio ativo + situação */

export interface SorteioAtivoSync {
  id: string;
  numeroSorteio: number;
  dataInicio: string | null;
  dataFim: string | null;
}

/**
 * Sorteio ATIVO para a API local consultar UMA vez por ciclo/lote.
 * Devolve apenas o mínimo necessário — nada de configuração ou token.
 */
export async function lerSorteioAtivoParaSync(): Promise<SorteioAtivoSync | null> {
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("sorteios")
    .select("id, numero_sorteio, data_inicio, data_fim")
    .eq("status", "ATIVO")
    .order("numero_sorteio", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id,
    numeroSorteio: data.numero_sorteio,
    dataInicio: data.data_inicio,
    dataFim: data.data_fim,
  };
}

export interface NotaSituacaoLoja {
  /** Identidade lógica da nota: sorteio + número. */
  numero: string;
  /** Referência adicional da origem (id interno da loja). Nunca identifica a nota. */
  origemId?: string | null | undefined;
  /** Código do cliente da loja (id_entidade) dono da nota. */
  clienteOrigemId?: string | null | undefined;
  /** 1 = normal, 3 = cancelada (Lojamix). */
  situacao: number;
  canceladaEm?: string | null | undefined;
}

export interface ResultadoSituacaoNotas {
  loteId: string;
  sorteioId: string;
  recebidas: number;
  baseAtualizadas: number;
  notasCanceladas: number;
  ignoradas: number;
}

/**
 * Aplica alteração de situação de notas já sincronizadas (principalmente
 * cancelamento). Busca SEMPRE por sorteio + número; `origemId` é só
 * referência. Nunca cria nota nova, nunca apaga registro; a nota do
 * participante passa a CANCELADA com auditoria.
 */
export async function registrarSituacaoNotas(entrada: {
  loteId: string;
  sorteioId: string;
  notas: NotaSituacaoLoja[];
}): Promise<ResultadoSituacaoNotas> {
  const supabase = await cliente();

  const { data: sorteio, error: erroSorteio } = await supabase
    .from("sorteios")
    .select("id")
    .eq("id", entrada.sorteioId)
    .maybeSingle();
  if (erroSorteio) throw new Error(erroSorteio.message);
  if (!sorteio) throw new Error("Sorteio não encontrado.");

  await abrirLote(supabase, {
    loteId: entrada.loteId,
    tipo: "NOTAS",
    direcao: "LOCAL_PARA_SUPABASE",
    origem: "LOJA",
    destino: "SUPABASE",
    sorteioId: entrada.sorteioId,
    enviados: entrada.notas.length,
  });

  const resumo: ResultadoSituacaoNotas = {
    loteId: entrada.loteId,
    sorteioId: entrada.sorteioId,
    recebidas: entrada.notas.length,
    baseAtualizadas: 0,
    notasCanceladas: 0,
    ignoradas: 0,
  };

  try {
    const { EVENTOS_AUDITORIA } = await import("@/modules/sorteios/types");

    for (const n of entrada.notas) {
      const cancelada = n.situacao === 3;
      const quando = n.canceladaEm ?? new Date().toISOString();

      const { data: base, error: erroBase } = await supabase
        .from("sorteio_notas_base")
        .update({
          situacao: cancelada ? 3 : 1,
          cancelada_em: cancelada ? quando : null,
          ...(n.origemId ? { origem_id: n.origemId } : {}),
          ...(n.clienteOrigemId ? { cliente_origem_id: n.clienteOrigemId } : {}),
        })
        .eq("sorteio_id", entrada.sorteioId)
        .eq("numero", n.numero)
        .select("id");
      if (erroBase) {
        resumo.ignoradas += 1;
        continue;
      }
      resumo.baseAtualizadas += base?.length ?? 0;

      if (!cancelada) continue;

      const { data: notas, error: erroNotas } = await supabase
        .from("sorteio_notas")
        .update({
          status: "CANCELADA",
          cancelado_em: quando,
          motivo_invalidez: "Nota cancelada na loja.",
        })
        .eq("sorteio_id", entrada.sorteioId)
        .eq("numero", n.numero)
        .neq("status", "CANCELADA")
        .select("id, participante_id, status");
      if (erroNotas) {
        resumo.ignoradas += 1;
        continue;
      }

      for (const nota of notas ?? []) {
        resumo.notasCanceladas += 1;
        await supabase.from("sorteio_auditoria").insert({
          sorteio_id: entrada.sorteioId,
          participante_id: nota.participante_id,
          nota_id: nota.id,
          evento: EVENTOS_AUDITORIA.notaCancelada,
          origem: "sincronizacao",
          usuario_id: null,
          detalhe: {
            novo: "CANCELADA",
            resultado: "cancelada_na_loja",
            numero: n.numero,
            cancelada_em: quando,
            lote_id: entrada.loteId,
          } as never,
        });
      }
    }

    // A revisão também preenche o dono da nota: quem já está ligado à loja
    // ganha aqui a participação e as notas correspondentes.
    const origensRevisao = [
      ...new Set(entrada.notas.map((n) => n.clienteOrigemId).filter((v): v is string => !!v)),
    ];
    for (const origemId of origensRevisao) {
      await vincularParticipacaoPorOrigemLoja(supabase, { origemId });
    }



    await enfileirar(supabase, {
      tipo: "NOTAS_LOJA_SUPABASE",
      entidade: "BASE_NOTAS",
      entidadeId: entrada.sorteioId,
      sorteioId: entrada.sorteioId,
      origem: "LOJA",
      destino: "SUPABASE",
      operacao: "SITUACAO_ATUALIZADA",
      operacaoId: `situacao:${entrada.loteId}`,
      status: "SINCRONIZADO",
      metadados: { lote_id: entrada.loteId, itens: entrada.notas.length },
    });

    await fecharLote(supabase, entrada.loteId, {
      status: resumo.ignoradas > 0 ? "PARCIAL" : "CONCLUIDA",
      processados: resumo.baseAtualizadas,
    });
    return resumo;
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Erro inesperado";
    await fecharLote(supabase, entrada.loteId, { status: "ERRO", erro: mensagem });
    throw new Error(mensagem);
  }
}

/* ---------------------------------------------- CLIENTES: loja → Supabase */

export interface ResultadoClientesLote {
  loteId: string;
  recebidos: number;
  criados: number;
  atualizados: number;
  ignorados: number;
}

/**
 * Cria/atualiza clientes vindos da loja. Nunca exclui. Identificação:
 * 1) identificador permanente da loja (`origem_id`);
 * 2) CPF;
 * 3) telefone normalizado.
 * As alterações são marcadas com origem LOJA para não voltarem à loja.
 */
export async function receberClientesLote(entrada: {
  loteId: string;
  clientes: ClienteLoja[];
}): Promise<ResultadoClientesLote> {
  const supabase = await cliente();

  await abrirLote(supabase, {
    loteId: entrada.loteId,
    tipo: "CLIENTES",
    direcao: "LOCAL_PARA_SUPABASE",
    origem: "LOJA",
    destino: "SUPABASE",
    enviados: entrada.clientes.length,
  });

  const resumo: ResultadoClientesLote = {
    loteId: entrada.loteId,
    recebidos: entrada.clientes.length,
    criados: 0,
    atualizados: 0,
    ignorados: 0,
  };

  try {
    for (const c of entrada.clientes) {
      const cpf = somenteDigitos(c.cpf);
      const telefone = somenteDigitos(c.telefone);

      let existenteId: string | null = null;

      const porOrigem = await supabase
        .from("clientes")
        .select("id")
        .eq("origem_id", c.origemId)
        .maybeSingle();
      existenteId = porOrigem.data?.id ?? null;

      if (!existenteId && cpf) {
        const porCpf = await supabase.from("clientes").select("id").eq("cpf", cpf).maybeSingle();
        existenteId = porCpf.data?.id ?? null;
      }
      if (!existenteId && telefone) {
        const porTelefone = await supabase
          .from("clientes")
          .select("id")
          .eq("telefone_normalizado", telefone)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        existenteId = porTelefone.data?.id ?? null;
      }

      const campos = {
        nome: c.nome,
        cpf,
        telefone: c.telefone ?? null,
        telefone_normalizado: telefone,
        email: c.email ?? null,
        data_nascimento: c.dataNascimento ?? null,
        origem_id: c.origemId,
        origem_alteracao: "LOJA",
      };

      if (existenteId) {
        const { error } = await supabase.from("clientes").update(campos).eq("id", existenteId);
        if (error) {
          resumo.ignorados += 1;
          continue;
        }
        resumo.atualizados += 1;
        // Indicador informativo: o cliente já chega ligado à loja neste sentido.
        await marcarParticipantesSincronizados(supabase, existenteId);
        await vincularParticipacaoPorOrigemLoja(supabase, {
          origemId: c.origemId,
          clienteId: existenteId,
        });
      } else {
        const { data: criado, error } = await supabase
          .from("clientes")
          .insert(campos)
          .select("id")
          .maybeSingle();
        if (error) {
          resumo.ignorados += 1;
          continue;
        }
        resumo.criados += 1;
        if (criado?.id) {
          await marcarParticipantesSincronizados(supabase, criado.id);
          await vincularParticipacaoPorOrigemLoja(supabase, {
            origemId: c.origemId,
            clienteId: criado.id,
          });
        }
      }
    }

    await fecharLote(supabase, entrada.loteId, {
      status: resumo.ignorados > 0 ? "PARCIAL" : "CONCLUIDA",
      processados: resumo.criados + resumo.atualizados,
    });
    return resumo;
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Erro inesperado";
    await fecharLote(supabase, entrada.loteId, { status: "ERRO", erro: mensagem });
    throw new Error(mensagem);
  }
}

/* ---------------------------------------------- CLIENTES: Supabase → loja */

export interface AlteracaoCliente {
  sequencia: number;
  operacao: string;
  cliente: {
    id: string;
    origem_id: string | null;
    nome: string;
    cpf: string | null;
    telefone: string | null;
    email: string | null;
    data_nascimento: string | null;
  };
}

/**
 * Devolve só as alterações após o cursor confirmado. O cursor NÃO avança aqui:
 * a API local precisa confirmar depois de aplicar.
 */
export async function lerAlteracoesClientes(entrada: {
  consumidor: string;
  limite: number;
}): Promise<{ cursor: number; proximoCursor: number; itens: AlteracaoCliente[] }> {
  const supabase = await cliente();

  const { data: cursorAtual } = await supabase
    .from("sorteio_sincronizacao_cursores")
    .select("sequencia")
    .eq("consumidor", entrada.consumidor)
    .maybeSingle();
  const cursor = Number(cursorAtual?.sequencia ?? 0);

  const { data: itens, error } = await supabase
    .from("sorteio_sincronizacao_fila")
    .select("sequencia, entidade_id, operacao")
    .eq("tipo", "CLIENTES_SUPABASE_LOJA")
    .eq("destino", "LOJA")
    .gt("sequencia", cursor)
    .order("sequencia", { ascending: true })
    .limit(Math.min(Math.max(entrada.limite, 1), 500));
  if (error) throw new Error(error.message);

  const linhas = itens ?? [];
  if (linhas.length === 0) return { cursor, proximoCursor: cursor, itens: [] };

  const ids = linhas.map((i) => i.entidade_id);
  const { data: clientes, error: erroClientes } = await supabase
    .from("clientes")
    .select("id, origem_id, nome, cpf, telefone, email, data_nascimento")
    .in("id", ids);
  if (erroClientes) throw new Error(erroClientes.message);

  const porId = new Map((clientes ?? []).map((c) => [c.id, c]));
  const resultado: AlteracaoCliente[] = [];
  for (const item of linhas) {
    const c = porId.get(item.entidade_id);
    if (!c) continue; // cliente removido: nada a aplicar na loja
    resultado.push({
      sequencia: Number(item.sequencia),
      operacao: item.operacao,
      cliente: c,
    });
  }

  return {
    cursor,
    proximoCursor: Number(linhas[linhas.length - 1]!.sequencia),
    itens: resultado,
  };
}

/**
 * Confirma até onde a API local aplicou. Só aqui o cursor avança; nunca
 * retrocede. Itens confirmados são marcados como SINCRONIZADO.
 */
export async function confirmarCursorClientes(entrada: {
  consumidor: string;
  sequencia: number;
}): Promise<{ cursor: number }> {
  const supabase = await cliente();

  const { data: atual } = await supabase
    .from("sorteio_sincronizacao_cursores")
    .select("sequencia")
    .eq("consumidor", entrada.consumidor)
    .maybeSingle();
  const anterior = Number(atual?.sequencia ?? 0);
  const nova = Math.max(anterior, entrada.sequencia);

  const { error } = await supabase
    .from("sorteio_sincronizacao_cursores")
    .upsert({ consumidor: entrada.consumidor, sequencia: nova }, { onConflict: "consumidor" });
  if (error) throw new Error(error.message);

  const agora = new Date().toISOString();
  await supabase
    .from("sorteio_sincronizacao_fila")
    .update({ status: "SINCRONIZADO", processado_em: agora, erro: null })
    .eq("tipo", "CLIENTES_SUPABASE_LOJA")
    .lte("sequencia", nova)
    .neq("status", "SINCRONIZADO");

  return { cursor: nova };
}

/** Registra falha de um item, mantendo-o disponível para nova tentativa. */
export async function registrarErroItem(sequencia: number, erro: string) {
  const supabase = await cliente();
  const { data: item } = await supabase
    .from("sorteio_sincronizacao_fila")
    .select("id, tentativas")
    .eq("sequencia", sequencia)
    .maybeSingle();
  if (!item) return;

  await supabase
    .from("sorteio_sincronizacao_fila")
    .update({
      status: "ERRO",
      erro,
      tentativas: (item.tentativas ?? 0) + 1,
      ultima_tentativa_em: new Date().toISOString(),
    })
    .eq("id", item.id);
}

/* -------------------------------------------------------- reconciliação */

export interface ResumoReconciliacao {
  sorteiosVerificados: number;
  notasAnalisadas: number;
  validas: number;
  invalidas: number;
  pendentes: number;
  itensDesbloqueados: number;
}

/**
 * Rede de segurança de baixa frequência: procura apenas situações
 * potencialmente presas (evento perdido, fila travada, API desligada).
 * Não faz varredura completa.
 */
export async function reconciliar(): Promise<ResumoReconciliacao> {
  const supabase = await cliente();
  const resumo: ResumoReconciliacao = {
    sorteiosVerificados: 0,
    notasAnalisadas: 0,
    validas: 0,
    invalidas: 0,
    pendentes: 0,
    itensDesbloqueados: 0,
  };

  // 1) itens presos em PROCESSANDO há mais de 15 minutos voltam para PENDENTE.
  const limite = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: presos } = await supabase
    .from("sorteio_sincronizacao_fila")
    .update({ status: "PENDENTE" })
    .eq("status", "PROCESSANDO")
    .lt("atualizado_em", limite)
    .select("id");
  resumo.itensDesbloqueados = presos?.length ?? 0;

  // 2) somente sorteios ATIVOS cuja base já foi sincronizada alguma vez.
  const { data: sorteios } = await supabase
    .from("sorteios")
    .select("id")
    .eq("status", "ATIVO")
    .not("base_sincronizada_em", "is", null);

  const { validarNotasPendentesDoSorteio } = await import("@/lib/sorteios-validacao.server");
  const { processarCuponsPendentes } = await import("@/lib/sorteios-cupons.server");
  for (const s of sorteios ?? []) {
    resumo.sorteiosVerificados += 1;
    const r = await validarNotasPendentesDoSorteio(s.id, 100);
    resumo.notasAnalisadas += r.analisadas;
    resumo.validas += r.validas;
    resumo.invalidas += r.invalidas;
    resumo.pendentes += r.pendentes;
    // Notas válidas que ficaram sem saldo/cupons (inclusive as criadas pelo
    // vínculo automático): nunca deixa nenhuma parada. Falha aqui não
    // interrompe a reconciliação.
    try {
      await processarCuponsPendentes(s.id, 200, "rotina", null);
    } catch (e) {
      console.error("[sorteios-sync] falha ao processar cupons pendentes", s.id, e);
    }
  }


  const agora = new Date().toISOString();
  await supabase.from("sorteio_sincronizacoes").insert({
    tipo: "NOTAS",
    direcao: "SUPABASE_PARA_LOCAL",
    origem: "SUPABASE",
    destino: "SUPABASE",
    status: "CONCLUIDA",
    finalizado_em: agora,
    registros_processados: resumo.notasAnalisadas,
  });

  return resumo;
}

/* -------------------------------------------- clientes SISTEMA -> LOJA */

export interface ClientePendenteLoja {
  id: string;
  nome: string | null;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  data_nascimento: string | null;
}

/**
 * Registra a ligação permanente com o cadastro da loja. A alteração é marcada
 * como originada na LOJA, então o gatilho de envio não gera um novo evento de
 * volta (anti-eco). Recusa se o cliente já estiver ligado a outro id.
 */
export async function vincularOrigemCliente(entrada: {
  clienteId: string;
  origemId: string;
}): Promise<{ vinculado: boolean }> {
  const supabase = await cliente();

  const { data: atual, error } = await supabase
    .from("clientes")
    .select("id, origem_id")
    .eq("id", entrada.clienteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!atual) throw new Error("Cliente não encontrado");

  if (atual.origem_id && atual.origem_id !== entrada.origemId) {
    throw new Error("Cliente já vinculado a outro cadastro da loja");
  }
  if (atual.origem_id === entrada.origemId) {
    await marcarParticipantesSincronizados(supabase, entrada.clienteId);
    await vincularParticipacaoPorOrigemLoja(supabase, {
      origemId: entrada.origemId,
      clienteId: entrada.clienteId,
    });
    return { vinculado: true };
  }

  const { error: erroUpdate } = await supabase
    .from("clientes")
    .update({ origem_id: entrada.origemId, origem_alteracao: "LOJA" })
    .eq("id", entrada.clienteId)
    .is("origem_id", null);
  if (erroUpdate) throw new Error(erroUpdate.message);

  await marcarParticipantesSincronizados(supabase, entrada.clienteId);
  await vincularParticipacaoPorOrigemLoja(supabase, {
    origemId: entrada.origemId,
    clienteId: entrada.clienteId,
  });

  return { vinculado: true };
}

/**
 * Cliente que veio da loja porque tem nota no período de um sorteio ATIVO entra
 * automaticamente como participante e recebe as notas dele já como VÁLIDAS —
 * a nota existe na base oficial da loja, não há o que validar. Fica pendente
 * apenas o aceite dos termos, feito por ele no portal público.
 *
 * Não gera cupom, número de cupom nem saldo. Notas canceladas na loja e notas
 * já usadas por outro participante são ignoradas. Falha aqui nunca derruba o
 * recebimento do cliente/nota: a ligação é o dado oficial.
 */
async function vincularParticipacaoPorOrigemLoja(
  supabase: Awaited<ReturnType<typeof cliente>>,
  entrada: { origemId: string; clienteId?: string },
): Promise<void> {
  try {
    let clienteId = entrada.clienteId ?? null;
    if (!clienteId) {
      const { data } = await supabase
        .from("clientes")
        .select("id")
        .eq("origem_id", entrada.origemId)
        .maybeSingle();
      clienteId = data?.id ?? null;
    }
    if (!clienteId) return;

    const { data: ativos } = await supabase.from("sorteios").select("id").eq("status", "ATIVO");
    const sorteioIds = (ativos ?? []).map((s) => s.id);
    if (sorteioIds.length === 0) return;

    for (const sorteioId of sorteioIds) {
      const { data: notasBase } = await supabase
        .from("sorteio_notas_base")
        .select("id, numero, valor_centavos")
        .eq("sorteio_id", sorteioId)
        .eq("cliente_origem_id", entrada.origemId)
        .is("cancelada_em", null);
      if (!notasBase || notasBase.length === 0) continue;

      // Participação garantida (idempotente pela unicidade sorteio + cliente).
      await supabase
        .from("sorteio_participantes")
        .upsert(
          {
            sorteio_id: sorteioId,
            cliente_id: clienteId,
            concorre_sorteio: true,
            sincronizacao_status: "SINCRONIZADO",
            sincronizado_em: new Date().toISOString(),
          },
          { onConflict: "sorteio_id,cliente_id", ignoreDuplicates: true },
        );

      const { data: participante } = await supabase
        .from("sorteio_participantes")
        .select("id")
        .eq("sorteio_id", sorteioId)
        .eq("cliente_id", clienteId)
        .maybeSingle();
      if (!participante) continue;

      const agora = new Date().toISOString();
      for (const nb of notasBase) {
        // A unicidade (sorteio_id, numero) garante que a nota não é duplicada
        // nem roubada de outro participante.
        const { error } = await supabase.from("sorteio_notas").insert({
          sorteio_id: sorteioId,
          participante_id: participante.id,
          numero: nb.numero,
          valor_centavos: nb.valor_centavos,
          nota_base_id: nb.id,
          status: "VALIDA",
          validado_em: agora,
          cupons_gerados: 0,
          saldo_gerado_centavos: 0,
        });
        // Nota já cadastrada (por ele ou por outro participante): segue adiante.
        if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
      }
    }
  } catch {
    // Vínculo automático é conveniência: nunca interrompe a sincronização.
  }
}

/**
 * Indicador informativo: marca as participações do cliente como sincronizadas.
 * Nunca desfaz a ligação — falha aqui é registrada e ignorada, pois a ligação
 * (`clientes.origem_id`) é o dado oficial e permanente.
 */
async function marcarParticipantesSincronizados(
  supabase: Awaited<ReturnType<typeof cliente>>,
  clienteId: string,
): Promise<void> {
  try {
    await supabase
      .from("sorteio_participantes")
      .update({
        sincronizacao_status: "SINCRONIZADO",
        sincronizado_em: new Date().toISOString(),
      })
      .eq("cliente_id", clienteId)
      .neq("sincronizacao_status", "SINCRONIZADO");
  } catch {
    // Indicador informativo: não interrompe a vinculação.
  }
}


/**
 * Lista clientes elegíveis ainda sem ligação com a loja, paginados por id:
 * pessoa física com CPF válido (11 dígitos + verificadores), telefone com
 * 10+ dígitos e participação em pelo menos um sorteio ATIVO. Nota fiscal
 * NÃO é critério neste fluxo. O marcador é apenas de paginação da varredura:
 * ao esgotar a lista, a API local o reinicia e recomeça do início.
 */
export async function listarClientesSemOrigem(entrada: {
  desdeId: string | null;
  limite: number;
}): Promise<{ itens: ClientePendenteLoja[]; marcador: string | null; descartadosSemParticipacao: number }> {
  const supabase = await cliente();
  const limite = Math.min(Math.max(entrada.limite, 1), 500);

  const { data: ativos } = await supabase.from("sorteios").select("id").eq("status", "ATIVO");
  const sorteioIds = (ativos ?? []).map((s) => s.id);
  if (sorteioIds.length === 0) return { itens: [], marcador: null, descartadosSemParticipacao: 0 };

  const { data: participantes } = await supabase
    .from("sorteio_participantes")
    .select("cliente_id")
    .in("sorteio_id", sorteioIds);
  const idsParticipantes = [...new Set((participantes ?? []).map((p) => p.cliente_id))].filter(
    (id): id is string => Boolean(id),
  );
  if (idsParticipantes.length === 0) {
    return { itens: [], marcador: null, descartadosSemParticipacao: 0 };
  }

  // Filtra PRIMEIRO por participação: assim o bloco já vem com candidatos reais
  // em vez de varrer centenas de cadastros que nunca seriam enviados.
  const FATIA = 200;
  const encontrados: Array<{
    id: string;
    nome: string | null;
    cpf: string | null;
    telefone: string | null;
    telefone_normalizado: string | null;
    email: string | null;
    data_nascimento: string | null;
  }> = [];

  for (let i = 0; i < idsParticipantes.length; i += FATIA) {
    const fatia = idsParticipantes.slice(i, i + FATIA);
    let consulta = supabase
      .from("clientes")
      .select("id, nome, cpf, telefone, telefone_normalizado, email, data_nascimento")
      .is("origem_id", null)
      .in("id", fatia)
      .order("id", { ascending: true })
      .limit(limite);
    if (entrada.desdeId) consulta = consulta.gt("id", entrada.desdeId);

    const { data, error } = await consulta;
    if (error) throw new Error(error.message);
    encontrados.push(...(data ?? []));
  }

  encontrados.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const pagina = encontrados.slice(0, limite);
  if (pagina.length === 0) return { itens: [], marcador: null, descartadosSemParticipacao: 0 };

  const marcador = pagina[pagina.length - 1]!.id;
  const { cpfValido } = await import("@/lib/curriculo");

  const descartadosSemParticipacao = 0;
  const itens: ClientePendenteLoja[] = [];
  for (const c of pagina) {
    const cpf = somenteDigitos(c.cpf);
    if (!cpf || cpf.length !== 11 || !cpfValido(cpf)) continue;
    const telefone = somenteDigitos(c.telefone_normalizado) ?? somenteDigitos(c.telefone);
    if (!telefone || telefone.length < 10) continue;
    if (!c.nome?.trim()) continue;
    itens.push({
      id: c.id,
      nome: c.nome,
      cpf,
      telefone,
      email: c.email ?? null,
      data_nascimento: c.data_nascimento ?? null,
    });
  }

  return { itens, marcador, descartadosSemParticipacao };
}

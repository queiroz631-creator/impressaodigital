/**
 * Etapa 5C — eventos de sincronização.
 *
 * Enfileiramento idempotente (chave: origem + entidade + identificador da
 * operação) e disparo da validação orientada a evento: quando um lote é
 * confirmado, só as notas PENDENTES daquele sorteio são processadas.
 *
 * A fila guarda apenas metadados de processamento — nunca cópia do cadastro.
 */
import type { Json } from "@/integrations/supabase/types";

/**
 * Cliente com privilégio de servidor (service role).
 * Tipagem mínima: a fila é acessada apenas por este módulo.
 */
type ClienteServidor = {
  from(tabela: string): unknown;
};

type RespostaIds = { data: { id: string }[] | null; error: { message: string } | null };

type FiltroIds = {
  eq(coluna: string, valor: string): FiltroIds;
  select(colunas: string): PromiseLike<RespostaIds>;
};

type TabelaFila = {
  update(valores: Record<string, unknown>): FiltroIds;
  insert(valores: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
};

export interface EventoFila {
  tipo: string;
  entidade: string;
  entidadeId: string;
  sorteioId?: string | null | undefined;
  origem: "LOJA" | "SUPABASE";
  destino: "LOJA" | "SUPABASE";
  operacao: string;
  /** Chave de idempotência do evento. */
  operacaoId: string;
  status?: "PENDENTE" | "PROCESSANDO" | "SINCRONIZADO" | "ERRO" | undefined;
  metadados?: Record<string, unknown> | undefined;
}

/**
 * Insere ou atualiza o item da fila sem duplicar: o mesmo evento recebido
 * duas vezes não cria dois registros nem dois processamentos.
 *
 * A unicidade da fila é garantida por índice ÚNICO PARCIAL
 * (origem, entidade, operacao_id) WHERE operacao_id IS NOT NULL — e um índice
 * parcial não pode ser usado em ON CONFLICT. Por isso a idempotência é feita
 * por leitura + gravação, com nova tentativa de atualização caso outra
 * execução simultânea tenha inserido o mesmo evento primeiro.
 */
export async function enfileirar(supabase: ClienteServidor, evento: EventoFila): Promise<void> {
  const fila = () => supabase.from("sorteio_sincronizacao_fila") as TabelaFila;

  const campos = {
    tipo: evento.tipo,
    entidade: evento.entidade,
    entidade_id: evento.entidadeId,
    sorteio_id: evento.sorteioId ?? null,
    origem: evento.origem,
    destino: evento.destino,
    operacao: evento.operacao,
    operacao_id: evento.operacaoId,
    status: evento.status ?? "PENDENTE",
    alterado_em: new Date().toISOString(),
    metadados: (evento.metadados ?? null) as Json,
  };

  const atualizar = async (): Promise<boolean> => {
    const { data, error } = await fila()
      .update(campos)
      .eq("origem", evento.origem)
      .eq("entidade", evento.entidade)
      .eq("operacao_id", evento.operacaoId)
      .select("id");
    if (error) throw new Error(error.message);
    return (data?.length ?? 0) > 0;
  };

  if (await atualizar()) return;

  const { error } = await fila().insert(campos);
  if (!error) return;

  // Corrida: outra execução inseriu o mesmo evento — atualiza e segue.
  if (await atualizar()) return;
  throw new Error(error.message);
}

/**
 * Validação orientada a evento: processa APENAS as notas pendentes do sorteio
 * afetado pelo lote recém-confirmado. Não consulta outros sorteios.
 */
export async function dispararValidacaoDoSorteio(sorteioId: string, limite = 200) {
  const { validarNotasPendentesDoSorteio } = await import("@/lib/sorteios-validacao.server");
  const r = await validarNotasPendentesDoSorteio(sorteioId, limite);
  return {
    analisadas: r.analisadas,
    validas: r.validas,
    invalidas: r.invalidas,
    pendentes: r.pendentes,
  };
}

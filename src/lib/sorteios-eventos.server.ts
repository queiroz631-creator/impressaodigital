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

/** Cliente com privilégio de servidor (service role). */
type ClienteServidor = {
  from: (tabela: "sorteio_sincronizacao_fila") => {
    upsert: (
      valores: never,
      opcoes: { onConflict: string; ignoreDuplicates: boolean },
    ) => PromiseLike<{ error: { message: string } | null }>;
  };
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
 */
export async function enfileirar(
  supabase: ClienteServidor,
  evento: EventoFila,
): Promise<void> {
  const { error } = await supabase.from("sorteio_sincronizacao_fila").upsert(
    {
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
    } as never,
    { onConflict: "origem,entidade,operacao_id", ignoreDuplicates: false },
  );
  if (error) throw new Error(error.message);
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

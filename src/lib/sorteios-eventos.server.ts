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

type ClienteAdmin = Awaited<
  ReturnType<typeof import("@/integrations/supabase/client.server")["supabaseAdmin"]["from"]>
> extends never
  ? never
  : ReturnType<typeof obterTipo>;
declare function obterTipo(): never;

export interface EventoFila {
  tipo: string;
  entidade: string;
  entidadeId: string;
  sorteioId?: string | null;
  origem: "LOJA" | "SUPABASE";
  destino: "LOJA" | "SUPABASE";
  operacao: string;
  /** Chave de idempotência do evento. */
  operacaoId: string;
  status?: "PENDENTE" | "PROCESSANDO" | "SINCRONIZADO" | "ERRO";
  metadados?: Record<string, unknown>;
}

/**
 * Insere ou atualiza o item da fila sem duplicar: o mesmo evento recebido
 * duas vezes não cria dois registros nem dois processamentos.
 */
export async function enfileirar(
  supabase: { from: (t: string) => any },
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
    },
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

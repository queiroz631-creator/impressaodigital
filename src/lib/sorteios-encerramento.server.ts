/**
 * Fechamento do sorteio (ATIVO → ENCERRADO).
 *
 * Toda a regra vive nas funções do banco, já existentes a partir desta etapa:
 *
 * - `public.sorteio_conferencia` — somente leitura. Não corrige, não recalcula
 *   e não gera cupom. Devolve totais, pendências e inconsistências.
 * - `public.sorteio_encerrar` — uma única transação: trava o sorteio com
 *   `FOR UPDATE`, refaz a conferência ali dentro, exige aprovação, grava a
 *   situação, o retrato da conferência e a auditoria `sorteio.encerrado`.
 *   Qualquer falha desfaz tudo.
 *
 * Nada aqui altera saldo, fontes, contribuições, cupons, validação,
 * cancelamento ou sincronização.
 */

import type { ConferenciaSorteio } from "@/modules/sorteios/types";

async function cliente() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Conferência somente leitura do sorteio. */
export async function conferenciaSorteio(sorteioId: string): Promise<ConferenciaSorteio> {
  const supabase = await cliente();
  const { data, error } = await supabase.rpc("sorteio_conferencia", { _sorteio_id: sorteioId });
  if (error) throw new Error(error.message);
  return data as unknown as ConferenciaSorteio;
}

export type ResultadoEncerramento =
  | { resultado: "ENCERRADO"; encerradoEm: string | null; conferencia: ConferenciaSorteio }
  | { resultado: "IGNORADO"; motivo: string; conferencia?: ConferenciaSorteio | null };

/**
 * Encerra o sorteio. A conferência é refeita dentro da transação do banco: o
 * que a tela mostrou não decide nada.
 */
export async function encerrarSorteioNoBanco(
  sorteioId: string,
  usuarioId: string | null = null,
): Promise<ResultadoEncerramento> {
  const supabase = await cliente();
  const argumentos: { _sorteio_id: string; _usuario_id?: string } = { _sorteio_id: sorteioId };
  if (usuarioId) argumentos._usuario_id = usuarioId;

  const { data, error } = await supabase.rpc("sorteio_encerrar", argumentos);
  if (error) {
    // A função sinaliza a reprovação da conferência com um prefixo conhecido.
    if (error.message.includes("CONFERENCIA_REPROVADA")) {
      throw new Error(
        "A conferência não foi aprovada: existem pendências ou inconsistências. " +
          "Confira a lista na tela e resolva antes de encerrar.",
      );
    }
    throw new Error(error.message);
  }

  const r = (data ?? {}) as {
    resultado?: string;
    motivo?: string;
    encerrado_em?: string | null;
    conferencia?: unknown;
  };

  if (r.resultado === "ENCERRADO") {
    return {
      resultado: "ENCERRADO",
      encerradoEm: r.encerrado_em ?? null,
      conferencia: r.conferencia as ConferenciaSorteio,
    };
  }
  return {
    resultado: "IGNORADO",
    motivo: r.motivo ?? "desconhecido",
    conferencia: (r.conferencia ?? null) as ConferenciaSorteio | null,
  };
}

/**
 * Apuração do cupom vencedor (ENCERRADO → SORTEADO).
 *
 * Toda a regra vive nas funções do banco:
 *
 * - `public.sorteio_apuracao_resumo` — somente leitura (indicadores, prêmios,
 *   ganhadores já registrados e amostra de números para a animação).
 * - `public.sorteio_realizar` — uma única transação: trava o sorteio, confere
 *   que está ENCERRADO, escolhe o próximo prêmio/unidade na ordem cadastrada,
 *   monta a urna, sorteia, grava o ganhador, a auditoria e, quando não restar
 *   unidade, muda o sorteio para SORTEADO. Qualquer falha desfaz tudo.
 *
 * Nada aqui altera notas, saldo, fontes, contribuições, cupons ou o
 * fechamento do sorteio.
 */

import type { ApuracaoSorteio, ResultadoApuracao } from "@/modules/sorteios/types";

async function cliente() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Resumo somente leitura da apuração. */
export async function resumoApuracao(sorteioId: string): Promise<ApuracaoSorteio> {
  const supabase = await cliente();
  const { data, error } = await supabase.rpc("sorteio_apuracao_resumo", {
    _sorteio_id: sorteioId,
  });
  if (error) throw new Error(error.message);
  return data as unknown as ApuracaoSorteio;
}

/** Sorteia a próxima unidade de prêmio. O navegador nunca escolhe o vencedor. */
export async function realizarSorteioNoBanco(
  sorteioId: string,
  usuarioId: string | null = null,
): Promise<ResultadoApuracao> {
  const supabase = await cliente();
  const argumentos: { _sorteio_id: string; _usuario_id?: string } = { _sorteio_id: sorteioId };
  if (usuarioId) argumentos._usuario_id = usuarioId;

  const { data, error } = await supabase.rpc("sorteio_realizar", argumentos);
  if (error) throw new Error(error.message);

  const r = (data ?? {}) as unknown as ResultadoApuracao;
  return r;
}

/** Mensagem amigável para cada recusa controlada do servidor. */
export function mensagemRecusa(motivo: string): string {
  switch (motivo) {
    case "nao_encerrado":
      return "Este sorteio ainda não está encerrado.";
    case "ja_sorteado":
      return "Todos os prêmios deste sorteio já foram sorteados.";
    case "sem_premio_disponivel":
      return "Não há prêmio disponível para sortear.";
    case "unidade_ja_sorteada":
      return "Esta unidade do prêmio já foi sorteada.";
    case "sem_cupom_elegivel":
      return "Não há cupom elegível para este prêmio.";
    case "sorteio_nao_encontrado":
      return "Sorteio não encontrado.";
    default:
      return "Não foi possível realizar o sorteio agora.";
  }
}

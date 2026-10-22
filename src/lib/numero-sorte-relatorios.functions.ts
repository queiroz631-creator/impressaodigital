import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  COLUNAS_RELATORIO,
  formatarLinhaExportacao,
  gerarCsv,
  type TipoRelatorio,
} from "@/modules/numero-sorte/lib/indicadores";

const filtros = z.object({
  tipo: z.enum(["participantes", "consultas", "premiacoes", "retiradas"]),
  campanha: z.string().uuid().nullable(),
  de: z.string().nullable(),
  ate: z.string().nullable(),
  situacao: z.string().max(40).nullable(),
  busca: z.string().max(100).nullable(),
  premio: z.string().uuid().nullable(),
});

const MAX_LINHAS = 100_000;

/** Exporta um relatório em CSV no servidor, em blocos de 1.000 linhas, CPF sempre mascarado. */
export const exportarRelatorioNumeroSorte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => filtros.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pode, error: ePerm } = await supabase.rpc("tem_permissao", {
      _user_id: userId,
      _chave: "numero_sorte.exportar",
    });
    if (ePerm) throw new Error("Não foi possível verificar a permissão.");
    if (!pode) throw new Error("Você não tem permissão para exportar relatórios.");

    const linhas: Record<string, unknown>[] = [];
    for (let offset = 0; offset < MAX_LINHAS; offset += 1000) {
      const { data: r, error } = await supabase.rpc("numero_sorte_relatorio", {
        _tipo: data.tipo,
        _campanha: data.campanha ?? undefined,
        _de: data.de ?? undefined,
        _ate: data.ate ?? undefined,
        _situacao: data.situacao ?? undefined,
        _busca: data.busca ?? undefined,
        _premio: data.premio ?? undefined,
        _limite: 1000,
        _offset: offset,
      });
      if (error) {
        console.error("exportar relatorio", error);
        throw new Error("Não foi possível gerar o relatório.");
      }
      const bloco = ((r as { linhas?: Record<string, unknown>[] })?.linhas ?? []);
      linhas.push(...bloco.map(formatarLinhaExportacao));
      if (bloco.length < 1000) break;
    }
    const csv = gerarCsv(COLUNAS_RELATORIO[data.tipo as TipoRelatorio], linhas);
    return { csv, total: linhas.length };
  });

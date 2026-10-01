import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type LimpezaStorage = {
  limpeza_id: string;
  original_bucket: string;
  original_path: string;
  thumbnail_bucket: string;
  thumbnail_path: string;
  tentativas?: number;
};

async function executarLimpezaStorage(limpeza: LimpezaStorage) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [original, thumbnail] = await Promise.all([
    supabaseAdmin.storage.from(limpeza.original_bucket).remove([limpeza.original_path]),
    supabaseAdmin.storage.from(limpeza.thumbnail_bucket).remove([limpeza.thumbnail_path]),
  ]);
  const erros = [original.error?.message, thumbnail.error?.message].filter(Boolean);
  const { error: erroAtualizacao } = await supabaseAdmin
    .from("foto_express_limpezas_storage")
    .update({
      tentativas: (limpeza.tentativas ?? 0) + 1,
      status: erros.length === 0 ? "CONCLUIDA" : "PENDENTE",
      ultimo_erro: erros.length === 0 ? null : erros.join(" | "),
    })
    .eq("id", limpeza.limpeza_id);
  if (erroAtualizacao) erros.push(`Registro da limpeza: ${erroAtualizacao.message}`);
  return erros;
}

async function reprocessarLimpezasPendentes(limite = 10) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("foto_express_limpezas_storage")
    .select("id, original_bucket, original_path, thumbnail_bucket, thumbnail_path, tentativas")
    .eq("status", "PENDENTE")
    .order("criado_em")
    .limit(limite);
  if (error) return [`Consulta da limpeza: ${error.message}`];
  const resultados = await Promise.all(
    (data ?? []).map((item) =>
      executarLimpezaStorage({
        limpeza_id: item.id,
        original_bucket: item.original_bucket,
        original_path: item.original_path,
        thumbnail_bucket: item.thumbnail_bucket,
        thumbnail_path: item.thumbnail_path,
        tentativas: item.tentativas,
      }),
    ),
  );
  return resultados.flat();
}

const uploadSchema = z.object({
  trabalhoId: z.string().uuid(),
  nomeOriginal: z.string().min(1).max(500),
  tipoMime: z.enum(["image/jpeg", "image/png", "image/webp"]),
  tamanhoBytes: z.number().int().positive().max(20 * 1024 * 1024),
  larguraPx: z.number().int().positive(),
  alturaPx: z.number().int().positive(),
  originalPath: z.string().min(1).max(1000),
  thumbnailPath: z.string().min(1).max(1000),
  ordem: z.number().int().min(0),
});

export const registrarUploadFotoExpress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => uploadSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: itemId, error } = await context.supabase.rpc("foto_express_registrar_upload", {
      _trabalho_id: data.trabalhoId,
      _nome_original: data.nomeOriginal,
      _tipo_mime: data.tipoMime,
      _tamanho_bytes: data.tamanhoBytes,
      _largura_px: data.larguraPx,
      _altura_px: data.alturaPx,
      _original_path: data.originalPath,
      _thumbnail_path: data.thumbnailPath,
      _ordem: data.ordem,
    });
    if (!error) {
      await reprocessarLimpezasPendentes();
      return { itemId, limpezaPendente: false };
    }

    const { data: limpezaId, error: erroFila } = await context.supabase.rpc(
      "foto_express_registrar_limpeza_upload",
      {
        _original_path: data.originalPath,
        _thumbnail_path: data.thumbnailPath,
        _erro: `Falha ao registrar item: ${error.message}`,
      },
    );
    if (erroFila || !limpezaId) {
      throw new Error(
        `Falha ao registrar a foto. A limpeza automática também não pôde ser registrada: ${erroFila?.message ?? "sem identificador"}.`,
      );
    }

    const errosLimpeza = await executarLimpezaStorage({
      limpeza_id: limpezaId,
      original_bucket: "foto-express-originais",
      original_path: data.originalPath,
      thumbnail_bucket: "foto-express-thumbnails",
      thumbnail_path: data.thumbnailPath,
    });
    if (errosLimpeza.length > 0) {
      throw new Error(`Falha ao registrar a foto. A limpeza ficou pendente: ${errosLimpeza.join(" | ")}`);
    }
    throw new Error(`Falha ao registrar a foto: ${error.message}. Os arquivos enviados foram removidos.`);
  });

const limpezaUploadSchema = z.object({
  originalPath: z.string().min(1).max(1000),
  thumbnailPath: z.string().min(1).max(1000),
  erro: z.string().min(1).max(2000),
});

export const limparUploadIncompletoFotoExpress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => limpezaUploadSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: limpezaId, error } = await context.supabase.rpc(
      "foto_express_registrar_limpeza_upload",
      {
        _original_path: data.originalPath,
        _thumbnail_path: data.thumbnailPath,
        _erro: data.erro,
      },
    );
    if (error || !limpezaId) throw new Error(error?.message ?? "Não foi possível registrar a limpeza.");
    const avisos = await executarLimpezaStorage({
      limpeza_id: limpezaId,
      original_bucket: "foto-express-originais",
      original_path: data.originalPath,
      thumbnail_bucket: "foto-express-thumbnails",
      thumbnail_path: data.thumbnailPath,
    });
    return { limpezaPendente: avisos.length > 0, avisos };
  });

const exclusaoSchema = z.object({ itemIds: z.array(z.string().uuid()).min(1).max(500) });

export const excluirItensFotoExpress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => exclusaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: limpezas, error } = await context.supabase.rpc("foto_express_excluir_itens", {
      _item_ids: [...new Set(data.itemIds)],
    });
    if (error) throw new Error(error.message);

    const resultados = await Promise.all((limpezas ?? []).map(executarLimpezaStorage));
    const erros = resultados.flat();
    const errosAnteriores = await reprocessarLimpezasPendentes();
    return {
      itensExcluidos: new Set(data.itemIds).size,
      limpezasConcluidas: (limpezas ?? []).length - resultados.filter((lista) => lista.length > 0).length,
      limpezasPendentes: resultados.filter((lista) => lista.length > 0).length,
      avisos: [...erros, ...errosAnteriores],
    };
  });

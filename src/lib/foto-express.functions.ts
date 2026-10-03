import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type LimpezaStorage = {
  limpeza_id: string;
  arquivo_id?: string | null;
  original_bucket: string;
  original_path: string;
  thumbnail_bucket: string;
  thumbnail_path: string;
  tentativas?: number;
};

async function executarLimpezaStorage(limpeza: LimpezaStorage) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const referencia = supabaseAdmin
    .from("foto_express_arquivos")
    .select("id")
    .limit(1);
  const { data: arquivoAtivo, error: erroReferencia } = limpeza.arquivo_id
    ? await referencia.eq("id", limpeza.arquivo_id).maybeSingle()
    : await referencia.eq("original_path", limpeza.original_path).maybeSingle();
  if (erroReferencia) return [`Verificação da referência: ${erroReferencia.message}`];
  if (arquivoAtivo) return ["A limpeza foi mantida pendente porque o arquivo ainda está em uso."];
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
    .select("id, arquivo_id, original_bucket, original_path, thumbnail_bucket, thumbnail_path, tentativas")
    .eq("status", "PENDENTE")
    .order("criado_em")
    .limit(limite);
  if (error) return [`Consulta da limpeza: ${error.message}`];
  const resultados = await Promise.all(
    (data ?? []).map((item) =>
      executarLimpezaStorage({
        limpeza_id: item.id,
        arquivo_id: item.arquivo_id,
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
  formatoId: z.string().uuid(),
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
    const { data: itemId, error } = await context.supabase.rpc("foto_express_registrar_upload_com_formato", {
      _trabalho_id: data.trabalhoId,
      _formato_id: data.formatoId,
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

const edicaoSchema = z.object({
  trabalhoId: z.string().uuid(), itemId: z.string().uuid(), formatoId: z.string().uuid(), zoom: z.number().min(1).max(5),
  posicaoX: z.number().min(-1).max(1), posicaoY: z.number().min(-1).max(1),
  rotacao: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  cropX: z.number().min(0).max(1), cropY: z.number().min(0).max(1),
  cropLargura: z.number().positive().max(1), cropAltura: z.number().positive().max(1),
  espelharHorizontal: z.boolean(), espelharVertical: z.boolean(),
  modoAjuste: z.enum(["PREENCHER", "AJUSTAR"]), orientacao: z.enum(["AUTOMATICA", "RETRATO", "PAISAGEM"]),
}).refine((v) => v.cropX + v.cropLargura <= 1.000001 && v.cropY + v.cropAltura <= 1.000001, "Crop inválido");

export const salvarEdicaoFotoExpress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => edicaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: salvoEm, error } = await context.supabase.rpc("foto_express_salvar_edicao_com_formato", {
      _trabalho_id: data.trabalhoId, _item_id: data.itemId, _formato_id: data.formatoId, _zoom: data.zoom,
      _posicao_x: data.posicaoX, _posicao_y: data.posicaoY, _rotacao: data.rotacao,
      _crop_x: data.cropX, _crop_y: data.cropY, _crop_largura: data.cropLargura, _crop_altura: data.cropAltura,
      _espelhar_horizontal: data.espelharHorizontal, _espelhar_vertical: data.espelharVertical,
      _modo_ajuste: data.modoAjuste, _orientacao: data.orientacao,
    });
    if (error) throw new Error(error.message);
    return { salvoEm };
  });

const identificacaoTextoSchema = z.object({
  trabalhoId: z.string().uuid(),
  itemId: z.string().uuid(),
});

const textoSchema = identificacaoTextoSchema.extend({
  textoId: z.string().uuid(),
  conteudo: z.string().max(500),
  posicaoX: z.number().min(0).max(1),
  posicaoY: z.number().min(0).max(1),
  larguraNormalizada: z.number().positive().max(1),
  tamanhoNormalizado: z.number().positive().max(1),
  fonteId: z.enum(["SANS", "SERIF", "MONO", "DECORATIVA"]),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  alinhamento: z.enum(["ESQUERDA", "CENTRO", "DIREITA"]),
  negrito: z.boolean(),
  italico: z.boolean(),
  rotacao: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  versao: z.number().int().positive(),
});

export const criarTextoFotoExpress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => identificacaoTextoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: texto, error } = await context.supabase.rpc("foto_express_criar_texto", {
      _trabalho_id: data.trabalhoId,
      _item_id: data.itemId,
    });
    if (error) throw new Error(error.message);
    return texto;
  });

export const salvarTextoFotoExpress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => textoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: texto, error } = await context.supabase.rpc("foto_express_salvar_texto", {
      _trabalho_id: data.trabalhoId,
      _item_id: data.itemId,
      _texto_id: data.textoId,
      _conteudo: data.conteudo,
      _posicao_x: data.posicaoX,
      _posicao_y: data.posicaoY,
      _largura_normalizada: data.larguraNormalizada,
      _tamanho_normalizado: data.tamanhoNormalizado,
      _fonte_id: data.fonteId,
      _cor: data.cor,
      _alinhamento: data.alinhamento,
      _negrito: data.negrito,
      _italico: data.italico,
      _rotacao: data.rotacao,
      _versao_esperada: data.versao,
    });
    if (error) throw new Error(error.message);
    return texto;
  });

const textoAcaoSchema = identificacaoTextoSchema.extend({ textoId: z.string().uuid() });

export const duplicarTextoFotoExpress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => textoAcaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: texto, error } = await context.supabase.rpc("foto_express_duplicar_texto", {
      _trabalho_id: data.trabalhoId, _item_id: data.itemId, _texto_id: data.textoId,
    });
    if (error) throw new Error(error.message);
    return texto;
  });

export const aplicarTextoTodasFotosFotoExpress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => textoAcaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: total, error } = await context.supabase.rpc("foto_express_aplicar_texto_todas_fotos", {
      _trabalho_id: data.trabalhoId, _item_id: data.itemId, _texto_id: data.textoId,
    });
    if (error) throw new Error(error.message);
    return { total: total ?? 0 };
  });

export const removerTextoTodasFotosFotoExpress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => textoAcaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: total, error } = await context.supabase.rpc("foto_express_remover_texto_todas_fotos", {
      _trabalho_id: data.trabalhoId, _item_id: data.itemId, _texto_id: data.textoId,
    });
    if (error) throw new Error(error.message);
    return { total: total ?? 0 };
  });

export const excluirTextoFotoExpress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => textoAcaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("foto_express_excluir_texto", {
      _trabalho_id: data.trabalhoId, _item_id: data.itemId, _texto_id: data.textoId,
    });
    if (error) throw new Error(error.message);
  });

export const moverTextoFotoExpress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => textoAcaoSchema.extend({ direcao: z.union([z.literal(-1), z.literal(1)]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("foto_express_mover_texto", {
      _trabalho_id: data.trabalhoId, _item_id: data.itemId, _texto_id: data.textoId, _direcao: data.direcao,
    });
    if (error) throw new Error(error.message);
  });

const ocorrenciaMontagemSchema = z.object({ itemId: z.string().uuid(), indiceCopia: z.number().int().positive(), xMm: z.number().nonnegative(), yMm: z.number().nonnegative(), larguraMm: z.number().positive(), alturaMm: z.number().positive(), rotacaoFolha: z.union([z.literal(0), z.literal(90)]) });
const folhaMontagemSchema = z.object({ numero: z.number().int().positive(), larguraMm: z.number().positive(), alturaMm: z.number().positive(), ocorrencias: z.array(ocorrenciaMontagemSchema) });
const montagemSchema = z.object({
  trabalhoId: z.string().uuid(), assinatura: z.string().regex(/^[a-f0-9]{64}$/), versao: z.number().int().nonnegative(),
  grupos: z.array(z.object({ papelId: z.string().uuid(), orientacaoEscolhida: z.enum(["RETRATO", "PAISAGEM"]), folhas: z.array(folhaMontagemSchema).min(1) })).min(1),
});

export const salvarMontagemFotoExpress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => montagemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: montagem, error } = await context.supabase.rpc("foto_express_salvar_montagem_por_papeis", {
      _trabalho_id: data.trabalhoId, _assinatura: data.assinatura, _versao_esperada: data.versao,
      _grupos: data.grupos,
    });
    if (error) throw new Error(error.message);
    return montagem;
  });

const geracaoIdSchema = z.object({ geracaoId: z.string().uuid() });
const iniciarGeracaoSchema = z.object({ trabalhoId: z.string().uuid(), saida: z.enum(["PDF", "JPG", "PDF_JPG"]) });

function dimensoesJpeg(bytes: Uint8Array) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let indice = 2;
  while (indice + 9 < bytes.length) {
    if (bytes[indice] !== 0xff) { indice += 1; continue; }
    const marcador = bytes[indice + 1] ?? 0;
    if (marcador === 0xd8 || marcador === 0xd9) { indice += 2; continue; }
    const tamanho = ((bytes[indice + 2] ?? 0) << 8) | (bytes[indice + 3] ?? 0);
    if (tamanho < 2) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marcador)) {
      return { altura: ((bytes[indice + 5] ?? 0) << 8) | (bytes[indice + 6] ?? 0), largura: ((bytes[indice + 7] ?? 0) << 8) | (bytes[indice + 8] ?? 0) };
    }
    indice += tamanho + 2;
  }
  return null;
}

export const prepararGeracaoFotoExpress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => iniciarGeracaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: geracaoId, error: erroInicio } = await context.supabase.rpc("foto_express_iniciar_geracao", { _trabalho_id: data.trabalhoId, _saida: data.saida });
    if (erroInicio || !geracaoId) throw new Error(erroInicio?.message ?? "Não foi possível iniciar a geração.");
    const { data: geracao, error: erroGeracao } = await context.supabase.from("foto_express_geracoes").select("id, snapshot, criado_por, estado").eq("id", geracaoId).single();
    const { data: arquivos, error: erroArquivos } = await context.supabase.from("foto_express_arquivos_impressao").select("*").eq("geracao_id", geracaoId).order("folha_numero");
    if (erroGeracao || erroArquivos || !geracao || !arquivos) throw new Error(erroGeracao?.message ?? erroArquivos?.message ?? "Geração não encontrada.");
    if (geracao.criado_por !== context.userId || geracao.estado !== "PROCESSANDO") throw new Error("GERACAO_INVALIDA");
    const snapshot = geracao.snapshot as Record<string, unknown>;
    const itens = Array.isArray(snapshot["itens"]) ? snapshot["itens"] as Array<{ arquivo?: { id?: string; original_bucket?: string; original_path?: string } }> : [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const originais: Record<string, string> = {};
    for (const entrada of itens) {
      const arquivo = entrada.arquivo;
      if (!arquivo?.id || !arquivo.original_bucket || !arquivo.original_path) throw new Error("Manifesto contém original inválido.");
      const { data: url, error } = await supabaseAdmin.storage.from(arquivo.original_bucket).createSignedUrl(arquivo.original_path, 7200);
      if (error || !url?.signedUrl) throw new Error(error?.message ?? "Não foi possível autorizar um arquivo original.");
      originais[arquivo.id] = url.signedUrl;
    }
    const destinos = await Promise.all(arquivos.map(async (arquivo) => {
      if (arquivo.bucket !== "foto-express-impressoes" || !arquivo.caminho.startsWith(`${data.trabalhoId}/${geracaoId}/`)) throw new Error("Destino de impressão inválido.");
      const { data: autorizacao, error } = await supabaseAdmin.storage.from(arquivo.bucket).createSignedUploadUrl(arquivo.caminho, { upsert: false });
      if (error || !autorizacao?.token) throw new Error(error?.message ?? "Não foi possível autorizar o destino.");
      return { id: arquivo.id, tipo: arquivo.tipo, folhaNumero: arquivo.folha_numero, bucket: arquivo.bucket, caminho: arquivo.caminho, nomeArquivo: arquivo.nome_arquivo, mime: arquivo.mime, token: autorizacao.token };
    }));
    return { geracaoId, manifesto: geracao.snapshot, originais, destinos };
  });

export const atualizarGeracaoFotoExpress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => geracaoIdSchema.extend({ etapa: z.string().min(1).max(100) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("foto_express_atualizar_geracao", { _geracao_id: data.geracaoId, _etapa: data.etapa });
    if (error) throw new Error(error.message);
  });

export const concluirGeracaoFotoExpress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => geracaoIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: geracao, error: erroGeracao } = await context.supabase.from("foto_express_geracoes").select("id, criado_por, estado, snapshot").eq("id", data.geracaoId).single();
    const { data: esperados, error: erroEsperados } = await context.supabase.from("foto_express_arquivos_impressao").select("*").eq("geracao_id", data.geracaoId);
    if (erroGeracao || erroEsperados || !geracao || !esperados?.length) throw new Error(erroGeracao?.message ?? erroEsperados?.message ?? "Geração incompleta.");
    if (geracao.criado_por !== context.userId || geracao.estado !== "PROCESSANDO") throw new Error("GERACAO_INVALIDA");
    const snapshot = geracao.snapshot as Record<string, unknown>;
    const folhas = Array.isArray(snapshot["folhas"]) ? snapshot["folhas"] as Array<{ numero: number; largura_mm: number; altura_mm: number }> : [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const prefixoEsperado = `${geracao.snapshot && typeof geracao.snapshot === "object" && !Array.isArray(geracao.snapshot) ? String((geracao.snapshot as Record<string, unknown>)["trabalho"] && typeof (geracao.snapshot as Record<string, unknown>)["trabalho"] === "object" ? ((geracao.snapshot as Record<string, { id?: string }>)["trabalho"]?.id ?? "") : "") : ""}/${data.geracaoId}/`;
    const tiposEsperados = esperados.map((arquivo) => `${arquivo.tipo}:${arquivo.folha_numero ?? "PDF"}`);
    if (new Set(tiposEsperados).size !== esperados.length || !prefixoEsperado.startsWith("/") && !esperados.every((arquivo) => arquivo.caminho.startsWith(prefixoEsperado))) throw new Error("Conjunto de destinos inconsistente.");
    const validados: Array<{ id: string; tamanho: number; largura: number | null; altura: number | null; paginas: number | null }> = [];
    for (const esperado of esperados) {
      const caminhoExato = esperado.tipo === "PDF" ? `${prefixoEsperado}impressao.pdf` : `${prefixoEsperado}folha-${String(esperado.folha_numero).padStart(2, "0")}.jpg`;
      if (esperado.bucket !== "foto-express-impressoes" || esperado.caminho !== caminhoExato) throw new Error("Caminho final divergente do manifesto.");
      const { data: blob, error } = await supabaseAdmin.storage.from(esperado.bucket).download(esperado.caminho);
      if (error || !blob || blob.size <= 0) throw new Error(`Arquivo ausente ou vazio: ${esperado.nome_arquivo}.`);
      if (blob.type !== esperado.mime) throw new Error(`MIME inválido em ${esperado.nome_arquivo}.`);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (esperado.tipo === "JPG") {
        const dimensoes = dimensoesJpeg(bytes);
        const folha = folhas.find((f) => f.numero === esperado.folha_numero);
        if (!dimensoes || !folha) throw new Error(`JPG inválido: ${esperado.nome_arquivo}.`);
        const larguraEsperada = Math.round(Number(folha.largura_mm) / 25.4 * 300);
        const alturaEsperada = Math.round(Number(folha.altura_mm) / 25.4 * 300);
        if (dimensoes.largura !== larguraEsperada || dimensoes.altura !== alturaEsperada) throw new Error(`Dimensões inválidas em ${esperado.nome_arquivo}.`);
        validados.push({ id: esperado.id, tamanho: blob.size, largura: dimensoes.largura, altura: dimensoes.altura, paginas: null });
      } else {
        if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) throw new Error("PDF final inválido.");
        const { PDFDocument } = await import("pdf-lib");
        const documento = await PDFDocument.load(bytes, { updateMetadata: false });
        if (documento.getPageCount() !== folhas.length) throw new Error("Quantidade de páginas do PDF divergente.");
        documento.getPages().forEach((pagina, indice) => {
          const folha = folhas[indice]; if (!folha) throw new Error("Folha ausente no manifesto.");
          const { width, height } = pagina.getSize();
          const larguraPt = Number(folha.largura_mm) / 25.4 * 72; const alturaPt = Number(folha.altura_mm) / 25.4 * 72;
          if (Math.abs(width - larguraPt) > 0.5 || Math.abs(height - alturaPt) > 0.5) throw new Error(`Dimensão física inválida na página ${indice + 1}.`);
        });
        validados.push({ id: esperado.id, tamanho: blob.size, largura: null, altura: null, paginas: documento.getPageCount() });
      }
    }
    const { error: erroConclusao } = await context.supabase.rpc("foto_express_concluir_geracao", { _geracao_id: data.geracaoId, _arquivos: validados });
    if (erroConclusao) throw new Error(erroConclusao.message);
    return { arquivos: validados.length };
  });

export const falharGeracaoFotoExpress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => geracaoIdSchema.extend({ erro: z.string().min(1).max(1000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: geracao, error: erroGeracao } = await context.supabase.from("foto_express_geracoes").select("criado_por, estado").eq("id", data.geracaoId).single();
    if (erroGeracao || !geracao || geracao.criado_por !== context.userId) throw new Error("GERACAO_INVALIDA");
    const { data: arquivos } = await context.supabase.from("foto_express_arquivos_impressao").select("bucket, caminho").eq("geracao_id", data.geracaoId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const arquivo of arquivos ?? []) await supabaseAdmin.storage.from(arquivo.bucket).remove([arquivo.caminho]);
    const { error } = await context.supabase.rpc("foto_express_falhar_geracao", { _geracao_id: data.geracaoId, _erro: data.erro });
    if (error) throw new Error(error.message);
  });

export const obterDownloadGeracaoFotoExpress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ arquivoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: arquivo, error } = await context.supabase.from("foto_express_arquivos_impressao").select("bucket, caminho, nome_arquivo, estado").eq("id", data.arquivoId).single();
    if (error || !arquivo || arquivo.estado !== "VALIDADO") throw new Error(error?.message ?? "Arquivo ainda não está disponível.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: url, error: erroUrl } = await supabaseAdmin.storage.from(arquivo.bucket).createSignedUrl(arquivo.caminho, 300, { download: arquivo.nome_arquivo });
    if (erroUrl || !url?.signedUrl) throw new Error(erroUrl?.message ?? "Não foi possível preparar o download.");
    return { url: url.signedUrl, nome: arquivo.nome_arquivo };
  });

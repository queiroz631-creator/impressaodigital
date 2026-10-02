import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ArquivoImpressaoFoto, FolhaFoto, Formato, GeracaoFoto, ItemEditor, ItemGaleria, MontagemFoto, OcorrenciaFoto, PapelFoto, TextoFoto, Trabalho } from "../types";

export function useFormatos(todos = false) {
  return useQuery({
    queryKey: ["foto-express", "formatos", todos],
    queryFn: async () => {
      let q = supabase.from("foto_express_formatos").select("*").order("ordem").order("nome");
      if (!todos) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return data as Formato[];
    },
  });
}

export function usePapeis(todos = false) {
  return useQuery({
    queryKey: ["foto-express", "papeis", todos],
    queryFn: async () => {
      let consulta = supabase.from("foto_express_papeis").select("*").order("ordem").order("nome");
      if (!todos) consulta = consulta.eq("ativo", true);
      const { data, error } = await consulta;
      if (error) throw error;
      return data as PapelFoto[];
    },
  });
}

export function useTrabalhos() {
  return useQuery({
    queryKey: ["foto-express", "trabalhos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foto_express_trabalhos")
        .select("*, foto_express_itens(count)")
        .order("atualizado_em", { ascending: false });
      if (error) throw error;
      return data as Array<Trabalho & { foto_express_itens: Array<{ count: number }> }>;
    },
  });
}

export function useTrabalho(id: string) {
  return useQuery({
    queryKey: ["foto-express", "trabalho", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("foto_express_trabalhos").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Trabalho;
    },
  });
}

export function useItensGaleria(trabalhoId: string) {
  return useQuery({
    queryKey: ["foto-express", "itens", trabalhoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foto_express_itens")
        .select("*, arquivo:foto_express_arquivos!foto_express_itens_arquivo_trabalho_fkey(*), formato:foto_express_formatos(*), configuracao:foto_express_configuracoes(*)")
        .eq("trabalho_id", trabalhoId)
        .order("ordem").order("criado_em");
      if (error) throw error;
      const itens = data as unknown as ItemGaleria[];
      await Promise.all(itens.map(async (item) => {
        const { data: url } = await supabase.storage.from(item.arquivo.thumbnail_bucket).createSignedUrl(item.arquivo.thumbnail_path, 3600);
        if (url?.signedUrl) item.thumbnailUrl = url.signedUrl;
      }));
      return itens;
    },
  });
}

export function useItensNavegacao(trabalhoId: string) {
  return useQuery({
    queryKey: ["foto-express", "itens-navegacao", trabalhoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foto_express_itens")
        .select("id")
        .eq("trabalho_id", trabalhoId)
        .order("ordem")
        .order("criado_em");
      if (error) throw error;
      return data;
    },
  });
}

function erroTemporario(erro: unknown) {
  if (!erro || typeof erro !== "object") return true;
  const valor = erro as { status?: number; statusCode?: number; code?: string; message?: string };
  const status = valor.status ?? valor.statusCode;
  if (status === 429 || (status !== undefined && status >= 500)) return true;
  if (status !== undefined && status >= 400 && status < 500) return false;
  const texto = `${valor.code ?? ""} ${valor.message ?? ""}`.toLowerCase();
  return texto.includes("429") || texto.includes("rate") || texto.includes("timeout") || texto.includes("network") || texto.includes("fetch") || status === undefined;
}

export function useItemEditor(trabalhoId: string, itemId: string) {
  return useQuery({
    queryKey: ["foto-express", "editor", trabalhoId, itemId],
    retry: (tentativas, erro) => tentativas < 3 && erroTemporario(erro),
    retryDelay: (tentativa) => Math.min(750 * 2 ** tentativa, 3000),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foto_express_itens")
        .select("*, arquivo:foto_express_arquivos!foto_express_itens_arquivo_trabalho_fkey(*), formato:foto_express_formatos(*), configuracao:foto_express_configuracoes(*)")
        .eq("id", itemId)
        .eq("trabalho_id", trabalhoId)
        .single();
      if (error) throw error;
      const item = data as unknown as ItemEditor;
      const { data: url, error: urlError } = await supabase.storage
        .from(item.arquivo.original_bucket)
        .createSignedUrl(item.arquivo.original_path, 3600);
      if (urlError) throw urlError;
      if (!url?.signedUrl) throw new Error("Não foi possível abrir a imagem original.");
      item.originalUrl = url.signedUrl;
      return item;
    },
  });
}

export function useTextosItem(itemId: string) {
  return useQuery({
    queryKey: ["foto-express", "textos", itemId],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foto_express_textos")
        .select("*")
        .eq("item_id", itemId)
        .order("ordem")
        .order("id");
      if (error) throw error;
      return data as TextoFoto[];
    },
  });
}

export function useTextosTrabalho(itemIds: string[]) {
  return useQuery({
    queryKey: ["foto-express", "textos-trabalho", ...itemIds], enabled: itemIds.length > 0,
    queryFn: async () => { const { data, error } = await supabase.from("foto_express_textos").select("*").in("item_id", itemIds).order("ordem"); if (error) throw error; return data as TextoFoto[]; },
  });
}

export function useMontagem(trabalhoId: string) {
  return useQuery({
    queryKey: ["foto-express", "montagem", trabalhoId], retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.from("foto_express_montagens").select("*, folhas:foto_express_folhas(*, ocorrencias:foto_express_ocorrencias(*))").eq("trabalho_id", trabalhoId).maybeSingle();
      if (error) throw error;
      return data as (MontagemFoto & { folhas: Array<FolhaFoto & { ocorrencias: OcorrenciaFoto[] }> }) | null;
    },
  });
}

export function useGeracoes(trabalhoId: string) {
  return useQuery({
    queryKey: ["foto-express", "geracoes", trabalhoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foto_express_geracoes")
        .select("*, arquivos:foto_express_arquivos_impressao(*)")
        .eq("trabalho_id", trabalhoId)
        .order("criado_em", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as Array<GeracaoFoto & { arquivos: ArquivoImpressaoFoto[] }>;
    },
    refetchInterval: (query) => query.state.data?.some((geracao) => geracao.estado === "PROCESSANDO") ? 2000 : false,
  });
}

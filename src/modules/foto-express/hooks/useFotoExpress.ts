import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Formato, ItemGaleria, Trabalho } from "../types";

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
        .select("*, arquivo:foto_express_arquivos!foto_express_itens_arquivo_trabalho_fkey(*), formato:foto_express_formatos(*)")
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

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Material } from "@/lib/calc";

export function useMateriais(somenteAtivos = false) {
  return useQuery({
    queryKey: ["materiais", somenteAtivos],
    queryFn: async () => {
      let query = supabase.from("materiais").select("*").order("ordem");
      if (somenteAtivos) query = query.eq("ativo", true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Material[];
    },
  });
}

export interface Configuracao {
  id: string;
  empresa_nome: string;
  logo_url: string | null;
  telefone: string | null;
  whatsapp: string | null;
  endereco: string | null;
  instagram: string | null;
  email: string | null;
  rodape_orcamento: string;
  validade_padrao_dias: number;
}

export function useConfiguracao() {
  return useQuery({
    queryKey: ["configuracoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("configuracoes").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as Configuracao | null;
    },
  });
}

export function useOrcamentos() {
  return useQuery({
    queryKey: ["orcamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCalculos() {
  return useQuery({
    queryKey: ["calculos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calculos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
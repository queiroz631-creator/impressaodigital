import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Acabamento, Material } from "@/lib/calc";
import type { PerfilImpressao } from "@/lib/perfil-impressao";

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

/** Perfis de impressão cadastrados (papel, qualidade, bandeja, cor, duplex). */
export function usePerfisImpressao(somenteAtivos = false) {
  return useQuery({
    queryKey: ["perfis-impressao", somenteAtivos],
    queryFn: async () => {
      let query = supabase.from("perfis_impressao").select("*").order("ordem");
      if (somenteAtivos) query = query.eq("ativo", true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as PerfilImpressao[];
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
  impressora_padrao_nome: string | null;
  impressora_padrao_tipo: string | null;
  impressora_padrao_largura: number | null;
  impressoras_padrao: unknown;
  pix_ativo: boolean;
  pix_chave: string | null;
  pix_nome: string | null;
  pix_banco: string | null;
  pix_mensagem: string;
  mensagem_prazo_orcamento: string;
  areas_impressao: unknown;
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

/** Todos os pedidos (fonte principal do status e do pagamento). */
export function usePedidos() {
  return useQuery({
    queryKey: ["pedidos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
export function useAcabamentos(somenteAtivos = false) {
  return useQuery({
    queryKey: ["acabamentos", somenteAtivos],
    queryFn: async () => {
      let query = supabase.from("acabamentos").select("*").order("ordem");
      if (somenteAtivos) query = query.eq("ativo", true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Acabamento[];
    },
  });
}

/** Orçamentos vinculados a um pedido, em ordem de criação. */
export function useOrcamentosPedido(pedidoId: string | null) {
  return useQuery({
    queryKey: ["orcamentos-pedido", pedidoId],
    enabled: !!pedidoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("*")
        .eq("pedido_id", pedidoId!)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePedido(pedidoId: string | null) {
  return useQuery({
    queryKey: ["pedido", pedidoId],
    enabled: !!pedidoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .eq("id", pedidoId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Rascunho do orçamento em andamento do usuário logado. */
export function useRascunho(userId: string | undefined) {
  return useQuery({
    queryKey: ["rascunho", userId],
    enabled: !!userId,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rascunhos")
        .select("dados")
        .eq("usuario_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data?.dados ?? null) as Record<string, unknown> | null;
    },
  });
}

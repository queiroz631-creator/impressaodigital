import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissoes } from "@/hooks/usePermissoes";
import { listarConexoes } from "@/lib/conexoes.functions";

export const CHAVE_CONEXOES_VISIVEIS = "conexoes-visiveis";
const ARMAZEM = "whatsapp:conexao";

/** Conexões que o usuário logado pode ver (sem credenciais). */
export function useConexoesVisiveis() {
  const listar = useServerFn(listarConexoes);
  const { user } = useAuth();
  return useQuery({
    queryKey: [CHAVE_CONEXOES_VISIVEIS, user?.id ?? null],
    queryFn: () => listar(),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });
}

/** Conexão vinculada ao usuário logado (null quando não há vínculo). */
export function useConexaoDoUsuario() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["conexao-do-usuario", user?.id ?? null],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    queryFn: async () => {
      const { data: perfil } = await supabase
        .from("profiles")
        .select("conexao_id")
        .eq("id", user!.id)
        .maybeSingle();
      return (perfil?.conexao_id ?? null) as string | null;
    },
  });
  return { conexaoId: data ?? null, carregando: isLoading };
}

/**
 * Conexão em uso na tela. O administrador escolhe (inclusive "todas", que
 * devolve null); o atendente fica sempre na conexão vinculada a ele.
 */
export function useConexaoSelecionada() {
  const { user } = useAuth();
  const { isAdmin, carregando: carregandoPermissoes } = usePermissoes(user?.id);
  const { conexaoId, carregando } = useConexaoDoUsuario();
  const [escolha, setEscolha] = useState<string>("todas");

  useEffect(() => {
    const salvo = localStorage.getItem(ARMAZEM);
    if (salvo) setEscolha(salvo);
  }, []);

  const escolher = useCallback((valor: string) => {
    setEscolha(valor);
    localStorage.setItem(ARMAZEM, valor);
  }, []);

  const conexaoAtiva = isAdmin ? (escolha === "todas" ? null : escolha) : conexaoId;

  return {
    isAdmin,
    escolha: isAdmin ? escolha : (conexaoId ?? ""),
    escolher,
    /** Conexão a filtrar; null = todas (somente administrador). */
    conexaoId: conexaoAtiva,
    semVinculo: !isAdmin && !conexaoId,
    carregando: carregando || carregandoPermissoes,
  };
}

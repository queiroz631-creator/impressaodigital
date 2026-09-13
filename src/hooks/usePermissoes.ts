import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "./useAuth";

/**
 * Ponto único de verificação de permissões de menu/telas.
 *
 * Regras:
 * - administrador (user_roles, fonte de verdade) → tudo liberado;
 * - usuário inativo → nada liberado;
 * - usuário ativo sem perfil → nada além do Dashboard (que não exige permissão);
 * - usuário ativo com perfil ativo → somente as chaves do perfil.
 *
 * O backend (RLS + função tem_permissao + gatilho em profiles) é quem realmente
 * protege os dados; este hook cuida apenas do que a interface mostra.
 */

export const CHAVE_PERMISSOES = "permissoes-usuario";

export function usePermissoes(userId?: string) {
  const { data: isAdmin } = useIsAdmin(userId);

  const { data, isLoading } = useQuery({
    queryKey: [CHAVE_PERMISSOES, userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: perfil, error } = await supabase
        .from("profiles")
        .select("ativo, perfil_id, perfis_acesso ( ativo, permissoes )")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;

      const acesso = (perfil as { perfis_acesso?: { ativo: boolean; permissoes: unknown } | null })
        ?.perfis_acesso;
      const lista = Array.isArray(acesso?.permissoes) ? (acesso!.permissoes as string[]) : [];

      return {
        ativo: perfil?.ativo !== false,
        chaves: acesso?.ativo ? lista : [],
      };
    },
  });

  const pode = (permissao?: string) => {
    if (isAdmin) return true;
    if (!permissao) return true;
    if (!data) return false;
    if (!data.ativo) return false;
    return data.chaves.includes(permissao);
  };

  return { pode, isAdmin: !!isAdmin, ativo: data?.ativo !== false, carregando: isLoading };
}

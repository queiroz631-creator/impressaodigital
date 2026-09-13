import { useIsAdmin } from "./useAuth";

/**
 * Ponto único de verificação de permissões de menu/telas.
 *
 * Nesta etapa a regra é a mesma de sempre: tudo liberado, exceto as
 * permissões listadas em PERMISSOES_ADMINISTRADOR (hoje só "Configurar
 * Preços"). Futuramente este hook será ligado às tabelas de perfis e
 * usuários sem alterar quem o consome.
 */

const PERMISSOES_ADMINISTRADOR = new Set(["precos.visualizar"]);

export function usePermissoes(userId?: string) {
  const { data: isAdmin } = useIsAdmin(userId);

  const pode = (permissao?: string) => {
    if (!permissao) return true;
    if (!PERMISSOES_ADMINISTRADOR.has(permissao)) return true;
    return !!isAdmin;
  };

  return { pode, isAdmin: !!isAdmin };
}

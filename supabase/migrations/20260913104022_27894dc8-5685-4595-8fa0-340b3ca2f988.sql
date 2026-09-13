REVOKE ALL ON FUNCTION public.conexao_do_usuario(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.tem_permissao(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.conexao_do_usuario(uuid) TO authenticated;
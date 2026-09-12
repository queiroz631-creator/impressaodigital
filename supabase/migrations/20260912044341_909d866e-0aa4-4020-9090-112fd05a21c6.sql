REVOKE ALL ON FUNCTION public.disparar_rotina_bot(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.disparar_rotina_bot(text) TO postgres, service_role;
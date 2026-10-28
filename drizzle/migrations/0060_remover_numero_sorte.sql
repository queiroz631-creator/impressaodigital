DROP TABLE IF EXISTS public.numero_sorte_intervalo_historico, public.numero_sorte_retiradas, public.numero_sorte_comprovantes, public.numero_sorte_premiacoes, public.numero_sorte_consultas, public.numero_sorte_participacoes, public.numero_sorte_numeros, public.numero_sorte_premios, public.numero_sorte_sessoes, public.numero_sorte_tentativas, public.numero_sorte_auditoria, public.numero_sorte_campanhas CASCADE;

DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname LIKE 'numero\_sorte\_%'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || f.sig || ' CASCADE';
  END LOOP;
END $$;
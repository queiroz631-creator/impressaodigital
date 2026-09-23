-- =============================================================================
-- Pasta de arquivos da logo do portal de sorteios (portal-sorteios).
--
-- Cria a pasta privada (limite de 2 MB) caso ainda nao exista e garante as
-- regras de permissao de leitura, envio, troca e remocao. Seguro rodar mais
-- de uma vez: nada existente e apagado ou sobrescrito.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('portal-sorteios', 'portal-sorteios', false, 2097152)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='portal_sorteios_leitura_autenticada') THEN
    CREATE POLICY "portal_sorteios_leitura_autenticada"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'portal-sorteios');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='portal_sorteios_escrita_gestao') THEN
    CREATE POLICY "portal_sorteios_escrita_gestao"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'portal-sorteios'
        AND (public.has_role(auth.uid(), 'admin') OR public.tem_permissao(auth.uid(), 'sorteios.gerenciar'))
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='portal_sorteios_atualiza_gestao') THEN
    CREATE POLICY "portal_sorteios_atualiza_gestao"
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id = 'portal-sorteios'
        AND (public.has_role(auth.uid(), 'admin') OR public.tem_permissao(auth.uid(), 'sorteios.gerenciar'))
      )
      WITH CHECK (
        bucket_id = 'portal-sorteios'
        AND (public.has_role(auth.uid(), 'admin') OR public.tem_permissao(auth.uid(), 'sorteios.gerenciar'))
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='portal_sorteios_exclui_gestao') THEN
    CREATE POLICY "portal_sorteios_exclui_gestao"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'portal-sorteios'
        AND (public.has_role(auth.uid(), 'admin') OR public.tem_permissao(auth.uid(), 'sorteios.gerenciar'))
      );
  END IF;
END $$;

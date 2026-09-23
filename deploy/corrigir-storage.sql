-- =============================================================================
-- Corrige o armazenamento de arquivos (Storage) no banco da VPS.
--
-- Aplicar na VPS:
--   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < deploy/corrigir-storage.sql
--
-- O que faz:
--   - cria as pastas de arquivos do sistema caso não existam (privadas);
--   - cria as regras de permissão de arquivos (leitura, envio, atualização e
--     exclusão) iguais às do projeto, apenas quando estiverem faltando.
--
-- Seguro rodar mais de uma vez: nada existente é apagado ou sobrescrito,
-- nenhum arquivo é removido.
-- =============================================================================

BEGIN;

-- 1. Pastas de arquivos (só cria as que não existem) --------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('bot-midia', 'bot-midia', false),
       ('mensagens-rapidas', 'mensagens-rapidas', false),
       ('orcamento-arquivos', 'orcamento-arquivos', false),
       ('sistema', 'sistema', false),
       ('whatsapp', 'whatsapp', false),
       ('database_export_11_09_26', 'database_export_11_09_26', false)
ON CONFLICT (id) DO NOTHING;

-- portal-sorteios (logo do portal de sorteios, limite de 2 MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('portal-sorteios', 'portal-sorteios', false, 2097152)
ON CONFLICT (id) DO NOTHING;


-- 2. Regras de permissão (só cria as que não existem) --------------------------

-- mensagens-rapidas (espelha a migração 20260908223416)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Usuarios autenticados leem imagens de mensagens rapidas') THEN
    CREATE POLICY "Usuarios autenticados leem imagens de mensagens rapidas" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'mensagens-rapidas');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Usuarios autenticados enviam imagens de mensagens rapidas') THEN
    CREATE POLICY "Usuarios autenticados enviam imagens de mensagens rapidas" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'mensagens-rapidas');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Usuarios autenticados atualizam imagens de mensagens rapidas') THEN
    CREATE POLICY "Usuarios autenticados atualizam imagens de mensagens rapidas" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'mensagens-rapidas') WITH CHECK (bucket_id = 'mensagens-rapidas');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Usuarios autenticados excluem imagens de mensagens rapidas') THEN
    CREATE POLICY "Usuarios autenticados excluem imagens de mensagens rapidas" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'mensagens-rapidas');
  END IF;
END $$;

-- orcamento-arquivos (espelha a migração 20260827215659)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='orcamento_arquivos_auth_read') THEN
    CREATE POLICY "orcamento_arquivos_auth_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'orcamento-arquivos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='orcamento_arquivos_auth_insert') THEN
    CREATE POLICY "orcamento_arquivos_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'orcamento-arquivos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='orcamento_arquivos_auth_update') THEN
    CREATE POLICY "orcamento_arquivos_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'orcamento-arquivos') WITH CHECK (bucket_id = 'orcamento-arquivos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='orcamento_arquivos_auth_delete') THEN
    CREATE POLICY "orcamento_arquivos_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'orcamento-arquivos');
  END IF;
END $$;

-- whatsapp (espelha a migração 20260821051122)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='whatsapp_bucket_select') THEN
    CREATE POLICY whatsapp_bucket_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'whatsapp');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='whatsapp_bucket_insert') THEN
    CREATE POLICY whatsapp_bucket_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'whatsapp');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='whatsapp_bucket_update') THEN
    CREATE POLICY whatsapp_bucket_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'whatsapp') WITH CHECK (bucket_id = 'whatsapp');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='whatsapp_bucket_delete') THEN
    CREATE POLICY whatsapp_bucket_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'whatsapp');
  END IF;
END $$;

-- bot-midia (espelha a migração 20260826011946)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Autenticados leem midia do bot') THEN
    CREATE POLICY "Autenticados leem midia do bot" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'bot-midia');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Autenticados enviam midia do bot') THEN
    CREATE POLICY "Autenticados enviam midia do bot" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'bot-midia');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Autenticados atualizam midia do bot') THEN
    CREATE POLICY "Autenticados atualizam midia do bot" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'bot-midia') WITH CHECK (bucket_id = 'bot-midia');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Autenticados excluem midia do bot') THEN
    CREATE POLICY "Autenticados excluem midia do bot" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'bot-midia');
  END IF;
END $$;

COMMIT;

-- Resumo do resultado ---------------------------------------------------------
SELECT b.id AS pasta, b.public AS publica
  FROM storage.buckets b
 WHERE b.id IN ('bot-midia', 'mensagens-rapidas', 'orcamento-arquivos', 'sistema', 'whatsapp', 'database_export_11_09_26')
 ORDER BY b.id;

SELECT p.policyname AS regra
  FROM pg_policies p
 WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
 ORDER BY p.policyname;

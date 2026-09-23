ALTER TABLE public.configuracoes ADD COLUMN IF NOT EXISTS sorteio_logo_url TEXT;

COMMENT ON COLUMN public.configuracoes.sorteio_logo_url IS 'Caminho do arquivo da logo do portal de sorteios no bucket portal-sorteios (vazio = logo padrao).';

CREATE POLICY "portal_sorteios_leitura_autenticada"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'portal-sorteios');

CREATE POLICY "portal_sorteios_escrita_gestao"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'portal-sorteios'
    AND (public.has_role(auth.uid(), 'admin') OR public.tem_permissao(auth.uid(), 'sorteios.gerenciar'))
  );
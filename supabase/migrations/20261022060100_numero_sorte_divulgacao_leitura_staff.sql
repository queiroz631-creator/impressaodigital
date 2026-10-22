DROP POLICY IF EXISTS "ns divulgacao leitura" ON storage.objects;
CREATE POLICY "ns divulgacao leitura" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'numero-sorte-divulgacao' AND public.tem_permissao(auth.uid(), 'numero_sorte.visualizar'));
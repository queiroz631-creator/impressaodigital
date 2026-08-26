CREATE POLICY "Autenticados leem midia do bot"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'bot-midia');

CREATE POLICY "Autenticados enviam midia do bot"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'bot-midia');

CREATE POLICY "Autenticados atualizam midia do bot"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'bot-midia')
WITH CHECK (bucket_id = 'bot-midia');

CREATE POLICY "Autenticados excluem midia do bot"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'bot-midia');
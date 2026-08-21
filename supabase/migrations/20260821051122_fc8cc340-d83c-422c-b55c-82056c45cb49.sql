CREATE POLICY whatsapp_bucket_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'whatsapp');
CREATE POLICY whatsapp_bucket_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'whatsapp');
CREATE POLICY whatsapp_bucket_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'whatsapp') WITH CHECK (bucket_id = 'whatsapp');
CREATE POLICY whatsapp_bucket_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'whatsapp');
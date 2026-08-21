ALTER TABLE public.whatsapp_conversas REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_mensagens REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_mensagens;
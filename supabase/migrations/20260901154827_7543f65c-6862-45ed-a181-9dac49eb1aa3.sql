DO $$
DECLARE
  r RECORD;
  manter uuid;
BEGIN
  FOR r IN
    SELECT telefone FROM public.whatsapp_conversas GROUP BY telefone HAVING count(*) > 1
  LOOP
    SELECT id INTO manter FROM public.whatsapp_conversas
      WHERE telefone = r.telefone ORDER BY created_at DESC LIMIT 1;

    UPDATE public.whatsapp_mensagens SET conversa_id = manter
      WHERE conversa_id IN (SELECT id FROM public.whatsapp_conversas WHERE telefone = r.telefone AND id <> manter);
    UPDATE public.whatsapp_arquivos SET conversa_id = manter
      WHERE conversa_id IN (SELECT id FROM public.whatsapp_conversas WHERE telefone = r.telefone AND id <> manter);
    UPDATE public.whatsapp_auditoria SET conversa_id = manter
      WHERE conversa_id IN (SELECT id FROM public.whatsapp_conversas WHERE telefone = r.telefone AND id <> manter);

    DELETE FROM public.whatsapp_conversas WHERE telefone = r.telefone AND id <> manter;
  END LOOP;
END $$;

ALTER TABLE public.whatsapp_conversas
  ADD CONSTRAINT whatsapp_conversas_telefone_key UNIQUE (telefone);
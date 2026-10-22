ALTER TABLE public.whatsapp_mensagens
  ADD COLUMN IF NOT EXISTS paginas integer,
  ADD COLUMN IF NOT EXISTS pdf_situacao text,
  ADD COLUMN IF NOT EXISTS entregue_em timestamptz,
  ADD COLUMN IF NOT EXISTS lida_em timestamptz;

DO $$ BEGIN
  ALTER TABLE public.whatsapp_mensagens
    ADD CONSTRAINT whatsapp_mensagens_pdf_situacao_check
    CHECK (pdf_situacao IS NULL OR pdf_situacao IN ('ok','protegido','danificado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.whatsapp_mensagens
    ADD CONSTRAINT whatsapp_mensagens_paginas_check
    CHECK (paginas IS NULL OR paginas >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

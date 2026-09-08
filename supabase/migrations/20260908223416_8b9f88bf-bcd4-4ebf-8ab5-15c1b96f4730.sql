CREATE TABLE public.mensagens_rapidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  atalho text NOT NULL,
  tipo text NOT NULL DEFAULT 'texto',
  texto text,
  imagem_path text,
  imagem_nome text,
  mostrar_no_botao boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensagens_rapidas TO authenticated;
GRANT ALL ON public.mensagens_rapidas TO service_role;
ALTER TABLE public.mensagens_rapidas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios autenticados gerenciam mensagens rapidas" ON public.mensagens_rapidas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER mensagens_rapidas_updated_at BEFORE UPDATE ON public.mensagens_rapidas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "Usuarios autenticados leem imagens de mensagens rapidas" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'mensagens-rapidas');
CREATE POLICY "Usuarios autenticados enviam imagens de mensagens rapidas" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'mensagens-rapidas');
CREATE POLICY "Usuarios autenticados atualizam imagens de mensagens rapidas" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'mensagens-rapidas') WITH CHECK (bucket_id = 'mensagens-rapidas');
CREATE POLICY "Usuarios autenticados excluem imagens de mensagens rapidas" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'mensagens-rapidas');
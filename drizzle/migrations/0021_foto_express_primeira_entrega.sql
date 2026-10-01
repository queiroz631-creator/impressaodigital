CREATE OR REPLACE FUNCTION public.pode_foto_express(_chave text DEFAULT 'foto_express.visualizar')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR public.tem_permissao(auth.uid(), _chave)
$$;
REVOKE ALL ON FUNCTION public.pode_foto_express(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_foto_express(text) TO authenticated, service_role;

CREATE SEQUENCE public.foto_express_numero_seq START WITH 1;
GRANT USAGE, SELECT ON SEQUENCE public.foto_express_numero_seq TO authenticated;
GRANT ALL ON SEQUENCE public.foto_express_numero_seq TO service_role;

CREATE TABLE public.foto_express_formatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  largura_cm numeric(8,3) NOT NULL CHECK (largura_cm > 0),
  altura_cm numeric(8,3) NOT NULL CHECK (altura_cm > 0),
  ativo boolean NOT NULL DEFAULT true,
  padrao boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.foto_express_formatos TO authenticated;
GRANT ALL ON public.foto_express_formatos TO service_role;
ALTER TABLE public.foto_express_formatos ENABLE ROW LEVEL SECURITY;
CREATE POLICY foto_express_formatos_select ON public.foto_express_formatos FOR SELECT TO authenticated
  USING (public.pode_foto_express());
CREATE POLICY foto_express_formatos_manage ON public.foto_express_formatos FOR ALL TO authenticated
  USING (public.pode_foto_express('foto_express.formatos.gerenciar'))
  WITH CHECK (public.pode_foto_express('foto_express.formatos.gerenciar'));
CREATE TRIGGER foto_express_formatos_updated_at BEFORE UPDATE ON public.foto_express_formatos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.foto_express_trabalhos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigint NOT NULL DEFAULT nextval('public.foto_express_numero_seq') UNIQUE,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  cliente_nome text NOT NULL DEFAULT '',
  cliente_telefone text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO','EM_EDICAO','PRONTO_IMPRESSAO','IMPRESSO','FINALIZADO')),
  criado_por uuid NOT NULL DEFAULT auth.uid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.foto_express_trabalhos TO authenticated;
GRANT ALL ON public.foto_express_trabalhos TO service_role;
ALTER TABLE public.foto_express_trabalhos ENABLE ROW LEVEL SECURITY;
CREATE POLICY foto_express_trabalhos_select ON public.foto_express_trabalhos FOR SELECT TO authenticated
  USING (public.pode_foto_express());
CREATE POLICY foto_express_trabalhos_insert ON public.foto_express_trabalhos FOR INSERT TO authenticated
  WITH CHECK (public.pode_foto_express('foto_express.trabalhos.criar') AND criado_por = auth.uid());
CREATE POLICY foto_express_trabalhos_update ON public.foto_express_trabalhos FOR UPDATE TO authenticated
  USING (public.pode_foto_express('foto_express.trabalhos.editar'))
  WITH CHECK (public.pode_foto_express('foto_express.trabalhos.editar'));
CREATE POLICY foto_express_trabalhos_delete ON public.foto_express_trabalhos FOR DELETE TO authenticated
  USING (public.pode_foto_express('foto_express.trabalhos.editar'));
CREATE INDEX foto_express_trabalhos_busca_idx ON public.foto_express_trabalhos (numero, atualizado_em DESC);
CREATE INDEX foto_express_trabalhos_cliente_idx ON public.foto_express_trabalhos (cliente_id);
CREATE TRIGGER foto_express_trabalhos_updated_at BEFORE UPDATE ON public.foto_express_trabalhos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.foto_express_arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trabalho_id uuid NOT NULL REFERENCES public.foto_express_trabalhos(id) ON DELETE CASCADE,
  nome_original text NOT NULL,
  tipo_mime text NOT NULL CHECK (tipo_mime IN ('image/jpeg','image/png','image/webp')),
  tamanho_bytes bigint NOT NULL CHECK (tamanho_bytes > 0),
  largura_px integer NOT NULL CHECK (largura_px > 0),
  altura_px integer NOT NULL CHECK (altura_px > 0),
  original_bucket text NOT NULL DEFAULT 'foto-express-originais',
  original_path text NOT NULL UNIQUE,
  thumbnail_bucket text NOT NULL DEFAULT 'foto-express-thumbnails',
  thumbnail_path text NOT NULL UNIQUE,
  criado_por uuid NOT NULL DEFAULT auth.uid(),
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.foto_express_arquivos TO authenticated;
GRANT ALL ON public.foto_express_arquivos TO service_role;
ALTER TABLE public.foto_express_arquivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY foto_express_arquivos_select ON public.foto_express_arquivos FOR SELECT TO authenticated
  USING (public.pode_foto_express());
CREATE POLICY foto_express_arquivos_insert ON public.foto_express_arquivos FOR INSERT TO authenticated
  WITH CHECK (public.pode_foto_express('foto_express.fotos.enviar') AND criado_por = auth.uid());
CREATE POLICY foto_express_arquivos_update ON public.foto_express_arquivos FOR UPDATE TO authenticated
  USING (public.pode_foto_express('foto_express.trabalhos.editar'))
  WITH CHECK (public.pode_foto_express('foto_express.trabalhos.editar'));
CREATE POLICY foto_express_arquivos_delete ON public.foto_express_arquivos FOR DELETE TO authenticated
  USING (public.pode_foto_express('foto_express.fotos.excluir'));
CREATE INDEX foto_express_arquivos_trabalho_idx ON public.foto_express_arquivos (trabalho_id);

CREATE TABLE public.foto_express_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trabalho_id uuid NOT NULL REFERENCES public.foto_express_trabalhos(id) ON DELETE CASCADE,
  arquivo_id uuid NOT NULL REFERENCES public.foto_express_arquivos(id) ON DELETE RESTRICT,
  formato_id uuid REFERENCES public.foto_express_formatos(id) ON DELETE SET NULL,
  largura_personalizada_cm numeric(8,3) CHECK (largura_personalizada_cm IS NULL OR largura_personalizada_cm > 0),
  altura_personalizada_cm numeric(8,3) CHECK (altura_personalizada_cm IS NULL OR altura_personalizada_cm > 0),
  quantidade integer NOT NULL DEFAULT 1 CHECK (quantidade BETWEEN 1 AND 999),
  orientacao text NOT NULL DEFAULT 'AUTOMATICA' CHECK (orientacao IN ('AUTOMATICA','RETRATO','PAISAGEM')),
  ordem integer NOT NULL DEFAULT 0,
  status_edicao text NOT NULL DEFAULT 'NAO_CONFIGURADA' CHECK (status_edicao IN ('NAO_CONFIGURADA','CONFIGURADA')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.foto_express_itens TO authenticated;
GRANT ALL ON public.foto_express_itens TO service_role;
ALTER TABLE public.foto_express_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY foto_express_itens_select ON public.foto_express_itens FOR SELECT TO authenticated
  USING (public.pode_foto_express());
CREATE POLICY foto_express_itens_insert ON public.foto_express_itens FOR INSERT TO authenticated
  WITH CHECK (public.pode_foto_express('foto_express.fotos.enviar'));
CREATE POLICY foto_express_itens_update ON public.foto_express_itens FOR UPDATE TO authenticated
  USING (public.pode_foto_express('foto_express.trabalhos.editar'))
  WITH CHECK (public.pode_foto_express('foto_express.trabalhos.editar'));
CREATE POLICY foto_express_itens_delete ON public.foto_express_itens FOR DELETE TO authenticated
  USING (public.pode_foto_express('foto_express.fotos.excluir'));
CREATE INDEX foto_express_itens_trabalho_ordem_idx ON public.foto_express_itens (trabalho_id, ordem, criado_em);
CREATE INDEX foto_express_itens_arquivo_idx ON public.foto_express_itens (arquivo_id);
CREATE TRIGGER foto_express_itens_updated_at BEFORE UPDATE ON public.foto_express_itens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.foto_express_configuracoes (
  item_id uuid PRIMARY KEY REFERENCES public.foto_express_itens(id) ON DELETE CASCADE,
  zoom numeric(12,6) NOT NULL DEFAULT 1 CHECK (zoom > 0),
  posicao_x numeric(12,6) NOT NULL DEFAULT 0,
  posicao_y numeric(12,6) NOT NULL DEFAULT 0,
  rotacao numeric(10,4) NOT NULL DEFAULT 0,
  crop_x numeric(12,6),
  crop_y numeric(12,6),
  crop_largura numeric(12,6),
  crop_altura numeric(12,6),
  espelhar_horizontal boolean NOT NULL DEFAULT false,
  espelhar_vertical boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.foto_express_configuracoes TO authenticated;
GRANT ALL ON public.foto_express_configuracoes TO service_role;
ALTER TABLE public.foto_express_configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY foto_express_configuracoes_select ON public.foto_express_configuracoes FOR SELECT TO authenticated
  USING (public.pode_foto_express());
CREATE POLICY foto_express_configuracoes_write ON public.foto_express_configuracoes FOR ALL TO authenticated
  USING (public.pode_foto_express('foto_express.trabalhos.editar'))
  WITH CHECK (public.pode_foto_express('foto_express.trabalhos.editar'));
CREATE TRIGGER foto_express_configuracoes_updated_at BEFORE UPDATE ON public.foto_express_configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.foto_express_textos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.foto_express_itens(id) ON DELETE CASCADE,
  conteudo text NOT NULL DEFAULT '',
  posicao_x numeric(12,6) NOT NULL DEFAULT 0,
  posicao_y numeric(12,6) NOT NULL DEFAULT 0,
  largura numeric(12,6),
  altura numeric(12,6),
  rotacao numeric(10,4) NOT NULL DEFAULT 0,
  fonte text NOT NULL DEFAULT 'Arial',
  tamanho numeric(10,3) NOT NULL DEFAULT 24 CHECK (tamanho > 0),
  cor text NOT NULL DEFAULT '#000000',
  alinhamento text NOT NULL DEFAULT 'CENTRO' CHECK (alinhamento IN ('ESQUERDA','CENTRO','DIREITA')),
  negrito boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.foto_express_textos TO authenticated;
GRANT ALL ON public.foto_express_textos TO service_role;
ALTER TABLE public.foto_express_textos ENABLE ROW LEVEL SECURITY;
CREATE POLICY foto_express_textos_select ON public.foto_express_textos FOR SELECT TO authenticated
  USING (public.pode_foto_express());
CREATE POLICY foto_express_textos_write ON public.foto_express_textos FOR ALL TO authenticated
  USING (public.pode_foto_express('foto_express.trabalhos.editar'))
  WITH CHECK (public.pode_foto_express('foto_express.trabalhos.editar'));
CREATE INDEX foto_express_textos_item_idx ON public.foto_express_textos (item_id, ordem);
CREATE TRIGGER foto_express_textos_updated_at BEFORE UPDATE ON public.foto_express_textos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.foto_express_iniciar_configuracao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.foto_express_configuracoes (item_id) VALUES (NEW.id);
  UPDATE public.foto_express_trabalhos SET atualizado_em = now() WHERE id = NEW.trabalho_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER foto_express_item_configuracao AFTER INSERT ON public.foto_express_itens
  FOR EACH ROW EXECUTE FUNCTION public.foto_express_iniciar_configuracao();

CREATE OR REPLACE FUNCTION public.foto_express_duplicar_item(_item_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  origem public.foto_express_itens%ROWTYPE;
  novo_id uuid;
BEGIN
  IF NOT public.pode_foto_express('foto_express.trabalhos.editar') THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;
  SELECT * INTO origem FROM public.foto_express_itens WHERE id = _item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FOTO_NAO_ENCONTRADA'; END IF;
  INSERT INTO public.foto_express_itens
    (trabalho_id, arquivo_id, formato_id, largura_personalizada_cm, altura_personalizada_cm, quantidade, orientacao, ordem, status_edicao)
  VALUES
    (origem.trabalho_id, origem.arquivo_id, origem.formato_id, origem.largura_personalizada_cm, origem.altura_personalizada_cm, origem.quantidade, origem.orientacao, origem.ordem + 1, origem.status_edicao)
  RETURNING id INTO novo_id;
  UPDATE public.foto_express_configuracoes destino
     SET zoom = fonte.zoom, posicao_x = fonte.posicao_x, posicao_y = fonte.posicao_y,
         rotacao = fonte.rotacao, crop_x = fonte.crop_x, crop_y = fonte.crop_y,
         crop_largura = fonte.crop_largura, crop_altura = fonte.crop_altura,
         espelhar_horizontal = fonte.espelhar_horizontal, espelhar_vertical = fonte.espelhar_vertical
    FROM public.foto_express_configuracoes fonte
   WHERE destino.item_id = novo_id AND fonte.item_id = _item_id;
  INSERT INTO public.foto_express_textos
    (item_id, conteudo, posicao_x, posicao_y, largura, altura, rotacao, fonte, tamanho, cor, alinhamento, negrito, ordem)
  SELECT novo_id, conteudo, posicao_x, posicao_y, largura, altura, rotacao, fonte, tamanho, cor, alinhamento, negrito, ordem
    FROM public.foto_express_textos WHERE item_id = _item_id;
  RETURN novo_id;
END;
$$;
REVOKE ALL ON FUNCTION public.foto_express_duplicar_item(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foto_express_duplicar_item(uuid) TO authenticated, service_role;

CREATE POLICY foto_express_storage_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('foto-express-originais','foto-express-thumbnails','foto-express-impressoes') AND public.pode_foto_express());
CREATE POLICY foto_express_storage_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('foto-express-originais','foto-express-thumbnails') AND public.pode_foto_express('foto_express.fotos.enviar'));
CREATE POLICY foto_express_storage_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('foto-express-originais','foto-express-thumbnails') AND public.pode_foto_express('foto_express.fotos.enviar'))
  WITH CHECK (bucket_id IN ('foto-express-originais','foto-express-thumbnails') AND public.pode_foto_express('foto_express.fotos.enviar'));
CREATE POLICY foto_express_storage_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('foto-express-originais','foto-express-thumbnails') AND public.pode_foto_express('foto_express.fotos.excluir'));
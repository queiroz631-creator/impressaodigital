CREATE OR REPLACE FUNCTION public.foto_express_set_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS foto_express_formatos_updated_at ON public.foto_express_formatos;
CREATE TRIGGER foto_express_formatos_updated_at
BEFORE UPDATE ON public.foto_express_formatos
FOR EACH ROW EXECUTE FUNCTION public.foto_express_set_atualizado_em();

DROP TRIGGER IF EXISTS foto_express_trabalhos_updated_at ON public.foto_express_trabalhos;
CREATE TRIGGER foto_express_trabalhos_updated_at
BEFORE UPDATE ON public.foto_express_trabalhos
FOR EACH ROW EXECUTE FUNCTION public.foto_express_set_atualizado_em();

DROP TRIGGER IF EXISTS foto_express_itens_updated_at ON public.foto_express_itens;
CREATE TRIGGER foto_express_itens_updated_at
BEFORE UPDATE ON public.foto_express_itens
FOR EACH ROW EXECUTE FUNCTION public.foto_express_set_atualizado_em();

DROP TRIGGER IF EXISTS foto_express_configuracoes_updated_at ON public.foto_express_configuracoes;
CREATE TRIGGER foto_express_configuracoes_updated_at
BEFORE UPDATE ON public.foto_express_configuracoes
FOR EACH ROW EXECUTE FUNCTION public.foto_express_set_atualizado_em();

DROP TRIGGER IF EXISTS foto_express_textos_updated_at ON public.foto_express_textos;
CREATE TRIGGER foto_express_textos_updated_at
BEFORE UPDATE ON public.foto_express_textos
FOR EACH ROW EXECUTE FUNCTION public.foto_express_set_atualizado_em();

ALTER TABLE public.foto_express_arquivos
  ADD CONSTRAINT foto_express_arquivos_id_trabalho_key UNIQUE (id, trabalho_id);

ALTER TABLE public.foto_express_itens
  ADD CONSTRAINT foto_express_itens_arquivo_trabalho_fkey
  FOREIGN KEY (arquivo_id, trabalho_id)
  REFERENCES public.foto_express_arquivos (id, trabalho_id)
  ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.foto_express_validar_item_arquivo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  arquivo_trabalho_id uuid;
BEGIN
  SELECT trabalho_id
    INTO arquivo_trabalho_id
    FROM public.foto_express_arquivos
   WHERE id = NEW.arquivo_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ARQUIVO_NAO_ENCONTRADO';
  END IF;

  IF arquivo_trabalho_id <> NEW.trabalho_id THEN
    RAISE EXCEPTION 'ARQUIVO_DE_OUTRO_TRABALHO';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER foto_express_item_validar_arquivo
BEFORE INSERT OR UPDATE OF arquivo_id, trabalho_id ON public.foto_express_itens
FOR EACH ROW EXECUTE FUNCTION public.foto_express_validar_item_arquivo();

CREATE TABLE public.foto_express_limpezas_storage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_id uuid,
  original_bucket text NOT NULL,
  original_path text NOT NULL,
  thumbnail_bucket text NOT NULL,
  thumbnail_path text NOT NULL,
  motivo text NOT NULL CHECK (motivo IN ('EXCLUSAO_ULTIMO_ITEM','UPLOAD_INCOMPLETO')),
  status text NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','CONCLUIDA')),
  tentativas integer NOT NULL DEFAULT 0 CHECK (tentativas >= 0),
  ultimo_erro text,
  criado_por uuid NOT NULL DEFAULT auth.uid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.foto_express_limpezas_storage TO service_role;
ALTER TABLE public.foto_express_limpezas_storage ENABLE ROW LEVEL SECURITY;
CREATE INDEX foto_express_limpezas_storage_pendentes_idx
  ON public.foto_express_limpezas_storage (status, criado_em)
  WHERE status = 'PENDENTE';
CREATE TRIGGER foto_express_limpezas_storage_updated_at
BEFORE UPDATE ON public.foto_express_limpezas_storage
FOR EACH ROW EXECUTE FUNCTION public.foto_express_set_atualizado_em();

CREATE OR REPLACE FUNCTION public.foto_express_registrar_upload(
  _trabalho_id uuid,
  _nome_original text,
  _tipo_mime text,
  _tamanho_bytes bigint,
  _largura_px integer,
  _altura_px integer,
  _original_path text,
  _thumbnail_path text,
  _ordem integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  novo_arquivo_id uuid;
  novo_item_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.fotos.enviar') THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;

  IF _tipo_mime NOT IN ('image/jpeg','image/png','image/webp') THEN
    RAISE EXCEPTION 'TIPO_DE_ARQUIVO_INVALIDO';
  END IF;

  PERFORM 1 FROM public.foto_express_trabalhos WHERE id = _trabalho_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRABALHO_NAO_ENCONTRADO';
  END IF;

  INSERT INTO public.foto_express_arquivos
    (trabalho_id, nome_original, tipo_mime, tamanho_bytes, largura_px, altura_px,
     original_path, thumbnail_path, criado_por)
  VALUES
    (_trabalho_id, _nome_original, _tipo_mime, _tamanho_bytes, _largura_px, _altura_px,
     _original_path, _thumbnail_path, auth.uid())
  RETURNING id INTO novo_arquivo_id;

  INSERT INTO public.foto_express_itens
    (trabalho_id, arquivo_id, ordem, quantidade)
  VALUES
    (_trabalho_id, novo_arquivo_id, _ordem, 1)
  RETURNING id INTO novo_item_id;

  RETURN novo_item_id;
END;
$$;
REVOKE ALL ON FUNCTION public.foto_express_registrar_upload(uuid,text,text,bigint,integer,integer,text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foto_express_registrar_upload(uuid,text,text,bigint,integer,integer,text,text,integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.foto_express_registrar_limpeza_upload(
  _original_path text,
  _thumbnail_path text,
  _erro text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  limpeza_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.fotos.enviar') THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;

  INSERT INTO public.foto_express_limpezas_storage
    (original_bucket, original_path, thumbnail_bucket, thumbnail_path, motivo, ultimo_erro, criado_por)
  VALUES
    ('foto-express-originais', _original_path, 'foto-express-thumbnails', _thumbnail_path,
     'UPLOAD_INCOMPLETO', _erro, auth.uid())
  RETURNING id INTO limpeza_id;

  RETURN limpeza_id;
END;
$$;
REVOKE ALL ON FUNCTION public.foto_express_registrar_limpeza_upload(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foto_express_registrar_limpeza_upload(text,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.foto_express_excluir_itens(_item_ids uuid[])
RETURNS TABLE (
  limpeza_id uuid,
  original_bucket text,
  original_path text,
  thumbnail_bucket text,
  thumbnail_path text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_solicitado integer;
  total_encontrado integer;
  arquivo public.foto_express_arquivos%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.fotos.excluir') THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;

  SELECT count(DISTINCT id) INTO total_solicitado
    FROM unnest(COALESCE(_item_ids, ARRAY[]::uuid[])) AS id;
  IF total_solicitado = 0 THEN
    RAISE EXCEPTION 'SELECIONE_FOTOS';
  END IF;

  SELECT count(*) INTO total_encontrado
    FROM public.foto_express_itens
   WHERE id = ANY(_item_ids);
  IF total_encontrado <> total_solicitado THEN
    RAISE EXCEPTION 'FOTO_NAO_ENCONTRADA';
  END IF;

  PERFORM a.id
    FROM public.foto_express_arquivos a
   WHERE a.id IN (
     SELECT DISTINCT i.arquivo_id
       FROM public.foto_express_itens i
      WHERE i.id = ANY(_item_ids)
   )
   ORDER BY a.id
   FOR UPDATE;

  DELETE FROM public.foto_express_itens WHERE id = ANY(_item_ids);

  FOR arquivo IN
    SELECT a.*
      FROM public.foto_express_arquivos a
     WHERE a.id IN (
       SELECT DISTINCT i.arquivo_id
         FROM public.foto_express_itens i
        WHERE false
       UNION
       SELECT DISTINCT arquivo_id
         FROM public.foto_express_limpezas_storage
        WHERE false
     )
  LOOP
    NULL;
  END LOOP;

  FOR arquivo IN
    SELECT a.*
      FROM public.foto_express_arquivos a
     WHERE a.id IN (
       SELECT DISTINCT x.arquivo_id
         FROM unnest(_item_ids) AS selecionado(id)
         JOIN LATERAL (
           SELECT i.arquivo_id
             FROM public.foto_express_itens i
            WHERE i.id = selecionado.id
         ) x ON true
     )
  LOOP
    NULL;
  END LOOP;

  RETURN QUERY
  WITH arquivos_afetados AS (
    SELECT DISTINCT a.id, a.original_bucket, a.original_path, a.thumbnail_bucket, a.thumbnail_path
      FROM public.foto_express_arquivos a
     WHERE NOT EXISTS (SELECT 1 FROM public.foto_express_itens restante WHERE restante.arquivo_id = a.id)
       AND a.id IN (
         SELECT DISTINCT l.arquivo_id
           FROM public.foto_express_limpezas_storage l
          WHERE false
       )
  )
  SELECT NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text
   WHERE false;
END;
$$;

CREATE OR REPLACE FUNCTION public.foto_express_excluir_itens(_item_ids uuid[])
RETURNS TABLE (
  limpeza_id uuid,
  original_bucket text,
  original_path text,
  thumbnail_bucket text,
  thumbnail_path text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_solicitado integer;
  total_encontrado integer;
  arquivo_id_atual uuid;
  arquivo public.foto_express_arquivos%ROWTYPE;
  nova_limpeza_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.fotos.excluir') THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;

  SELECT count(DISTINCT id) INTO total_solicitado
    FROM unnest(COALESCE(_item_ids, ARRAY[]::uuid[])) AS id;
  IF total_solicitado = 0 THEN
    RAISE EXCEPTION 'SELECIONE_FOTOS';
  END IF;

  SELECT count(*) INTO total_encontrado
    FROM public.foto_express_itens
   WHERE id = ANY(_item_ids);
  IF total_encontrado <> total_solicitado THEN
    RAISE EXCEPTION 'FOTO_NAO_ENCONTRADA';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.foto_express_arquivos_afetados (
    arquivo_id uuid PRIMARY KEY
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.foto_express_arquivos_afetados;
  INSERT INTO pg_temp.foto_express_arquivos_afetados (arquivo_id)
  SELECT DISTINCT i.arquivo_id
    FROM public.foto_express_itens i
   WHERE i.id = ANY(_item_ids);

  PERFORM a.id
    FROM public.foto_express_arquivos a
    JOIN pg_temp.foto_express_arquivos_afetados x ON x.arquivo_id = a.id
   ORDER BY a.id
   FOR UPDATE;

  DELETE FROM public.foto_express_itens WHERE id = ANY(_item_ids);

  FOR arquivo_id_atual IN
    SELECT x.arquivo_id FROM pg_temp.foto_express_arquivos_afetados x ORDER BY x.arquivo_id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.foto_express_itens i WHERE i.arquivo_id = arquivo_id_atual
    ) THEN
      SELECT * INTO arquivo
        FROM public.foto_express_arquivos
       WHERE id = arquivo_id_atual;

      INSERT INTO public.foto_express_limpezas_storage
        (arquivo_id, original_bucket, original_path, thumbnail_bucket, thumbnail_path,
         motivo, criado_por)
      VALUES
        (arquivo.id, arquivo.original_bucket, arquivo.original_path,
         arquivo.thumbnail_bucket, arquivo.thumbnail_path,
         'EXCLUSAO_ULTIMO_ITEM', auth.uid())
      RETURNING id INTO nova_limpeza_id;

      DELETE FROM public.foto_express_arquivos WHERE id = arquivo.id;

      limpeza_id := nova_limpeza_id;
      original_bucket := arquivo.original_bucket;
      original_path := arquivo.original_path;
      thumbnail_bucket := arquivo.thumbnail_bucket;
      thumbnail_path := arquivo.thumbnail_path;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.foto_express_excluir_itens(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foto_express_excluir_itens(uuid[]) TO authenticated, service_role;

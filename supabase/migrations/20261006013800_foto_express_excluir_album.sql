CREATE OR REPLACE FUNCTION public.foto_express_excluir_album(_trabalho_id uuid)
RETURNS TABLE (
  limpeza_id uuid,
  arquivo_id uuid,
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
  registro record;
  nova_limpeza_id uuid;
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.pode_foto_express('foto_express.trabalhos.editar')
     OR NOT public.pode_foto_express('foto_express.fotos.excluir') THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;

  PERFORM 1
  FROM public.foto_express_trabalhos
  WHERE id = _trabalho_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ALBUM_NAO_ENCONTRADO';
  END IF;

  FOR registro IN
    SELECT a.id AS arquivo_id, a.original_bucket, a.original_path,
           a.thumbnail_bucket, a.thumbnail_path
    FROM public.foto_express_arquivos a
    WHERE a.trabalho_id = _trabalho_id
    ORDER BY a.criado_em, a.id
  LOOP
    INSERT INTO public.foto_express_limpezas_storage
      (arquivo_id, original_bucket, original_path, thumbnail_bucket, thumbnail_path, motivo, criado_por)
    VALUES
      (registro.arquivo_id, registro.original_bucket, registro.original_path,
       registro.thumbnail_bucket, registro.thumbnail_path, 'EXCLUSAO_ULTIMO_ITEM', auth.uid())
    RETURNING id INTO nova_limpeza_id;

    limpeza_id := nova_limpeza_id;
    arquivo_id := registro.arquivo_id;
    original_bucket := registro.original_bucket;
    original_path := registro.original_path;
    thumbnail_bucket := registro.thumbnail_bucket;
    thumbnail_path := registro.thumbnail_path;
    RETURN NEXT;
  END LOOP;

  FOR registro IN
    SELECT DISTINCT ai.bucket, ai.caminho
    FROM public.foto_express_arquivos_impressao ai
    JOIN public.foto_express_geracoes g ON g.id = ai.geracao_id
    WHERE g.trabalho_id = _trabalho_id
    ORDER BY ai.bucket, ai.caminho
  LOOP
    INSERT INTO public.foto_express_limpezas_storage
      (arquivo_id, original_bucket, original_path, thumbnail_bucket, thumbnail_path, motivo, criado_por)
    VALUES
      (NULL, registro.bucket, registro.caminho,
       registro.bucket, registro.caminho, 'EXCLUSAO_ULTIMO_ITEM', auth.uid())
    RETURNING id INTO nova_limpeza_id;

    limpeza_id := nova_limpeza_id;
    arquivo_id := NULL;
    original_bucket := registro.bucket;
    original_path := registro.caminho;
    thumbnail_bucket := registro.bucket;
    thumbnail_path := registro.caminho;
    RETURN NEXT;
  END LOOP;

  DELETE FROM public.foto_express_arquivos_impressao
  WHERE geracao_id IN (
    SELECT id FROM public.foto_express_geracoes WHERE trabalho_id = _trabalho_id
  );
  DELETE FROM public.foto_express_geracoes WHERE trabalho_id = _trabalho_id;
  DELETE FROM public.foto_express_montagens WHERE trabalho_id = _trabalho_id;
  DELETE FROM public.foto_express_itens WHERE trabalho_id = _trabalho_id;
  DELETE FROM public.foto_express_arquivos WHERE trabalho_id = _trabalho_id;
  DELETE FROM public.foto_express_trabalhos WHERE id = _trabalho_id;
END;
$$;

REVOKE ALL ON FUNCTION public.foto_express_excluir_album(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foto_express_excluir_album(uuid) TO authenticated, service_role;
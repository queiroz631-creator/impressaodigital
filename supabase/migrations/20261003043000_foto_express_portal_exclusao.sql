CREATE OR REPLACE FUNCTION public.foto_express_portal_excluir_itens(
  _trabalho_id uuid,
  _item_ids uuid[],
  _cliente_id uuid
)
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
  arquivo_id_atual uuid;
  arquivo public.foto_express_arquivos%ROWTYPE;
  nova_limpeza_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.foto_express_trabalhos
    WHERE id = _trabalho_id AND cliente_id = _cliente_id
      AND origem_portal = true AND portal_enviado_em IS NULL
  ) THEN RAISE EXCEPTION 'TRABALHO_BLOQUEADO'; END IF;
  IF COALESCE(array_length(_item_ids, 1), 0) = 0 OR EXISTS (
    SELECT 1 FROM unnest(_item_ids) x(id)
    WHERE NOT EXISTS (SELECT 1 FROM public.foto_express_itens i WHERE i.id=x.id AND i.trabalho_id=_trabalho_id)
  ) THEN RAISE EXCEPTION 'FOTO_NAO_ENCONTRADA'; END IF;
  CREATE TEMP TABLE IF NOT EXISTS pg_temp.portal_arquivos_afetados (arquivo_id uuid PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE pg_temp.portal_arquivos_afetados;
  INSERT INTO pg_temp.portal_arquivos_afetados SELECT DISTINCT arquivo_id FROM public.foto_express_itens WHERE id=ANY(_item_ids) AND trabalho_id=_trabalho_id;
  DELETE FROM public.foto_express_itens WHERE id=ANY(_item_ids) AND trabalho_id=_trabalho_id;
  FOR arquivo_id_atual IN SELECT p.arquivo_id FROM pg_temp.portal_arquivos_afetados p LOOP
    IF NOT EXISTS (SELECT 1 FROM public.foto_express_itens i WHERE i.arquivo_id=arquivo_id_atual) THEN
      SELECT * INTO arquivo FROM public.foto_express_arquivos WHERE id=arquivo_id_atual FOR UPDATE;
      INSERT INTO public.foto_express_limpezas_storage
        (arquivo_id,original_bucket,original_path,thumbnail_bucket,thumbnail_path,motivo,criado_por)
      VALUES (arquivo.id,arquivo.original_bucket,arquivo.original_path,arquivo.thumbnail_bucket,arquivo.thumbnail_path,'EXCLUSAO_ULTIMO_ITEM',_cliente_id)
      RETURNING id INTO nova_limpeza_id;
      DELETE FROM public.foto_express_arquivos WHERE id=arquivo.id;
      limpeza_id:=nova_limpeza_id; original_bucket:=arquivo.original_bucket; original_path:=arquivo.original_path;
      thumbnail_bucket:=arquivo.thumbnail_bucket; thumbnail_path:=arquivo.thumbnail_path; RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.foto_express_portal_excluir_itens(uuid,uuid[],uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.foto_express_portal_excluir_itens(uuid,uuid[],uuid) TO service_role;
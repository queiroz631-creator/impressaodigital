CREATE OR REPLACE FUNCTION public.foto_express_remover_texto_todas_fotos(
  _trabalho_id uuid,
  _item_id uuid,
  _texto_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ordem_origem integer;
  total integer := 0;
BEGIN
  IF auth.role() <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.trabalhos.editar')) THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;

  SELECT t.ordem INTO ordem_origem
    FROM public.foto_express_textos t
    JOIN public.foto_express_itens i ON i.id = t.item_id
   WHERE t.id = _texto_id
     AND t.item_id = _item_id
     AND i.trabalho_id = _trabalho_id
   FOR UPDATE OF t;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TEXTO_NAO_ENCONTRADO';
  END IF;

  DELETE FROM public.foto_express_textos t
   USING public.foto_express_itens i
   WHERE i.id = t.item_id
     AND i.trabalho_id = _trabalho_id
     AND t.ordem = ordem_origem;

  GET DIAGNOSTICS total = ROW_COUNT;
  RETURN total;
END;
$$;

REVOKE ALL ON FUNCTION public.foto_express_remover_texto_todas_fotos(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foto_express_remover_texto_todas_fotos(uuid, uuid, uuid) TO authenticated, service_role;
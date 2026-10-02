CREATE OR REPLACE FUNCTION public.foto_express_aplicar_texto_todas_fotos(
  _trabalho_id uuid,
  _item_id uuid,
  _texto_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  origem public.foto_express_textos%ROWTYPE;
  destino record;
  proxima_ordem integer;
  total integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.trabalhos.editar') THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;

  SELECT t.* INTO origem
    FROM public.foto_express_textos t
    JOIN public.foto_express_itens i ON i.id = t.item_id
   WHERE t.id = _texto_id
     AND t.item_id = _item_id
     AND i.trabalho_id = _trabalho_id
   FOR UPDATE OF t;
  IF NOT FOUND THEN RAISE EXCEPTION 'TEXTO_NAO_ENCONTRADO'; END IF;

  FOR destino IN
    SELECT i.id
      FROM public.foto_express_itens i
     WHERE i.trabalho_id = _trabalho_id
       AND i.id <> _item_id
     ORDER BY i.id
     FOR UPDATE
  LOOP
    SELECT COALESCE(max(ordem), -1) + 1 INTO proxima_ordem
      FROM public.foto_express_textos
     WHERE item_id = destino.id;

    INSERT INTO public.foto_express_textos
      (item_id, conteudo, posicao_x, posicao_y, largura_normalizada, tamanho_normalizado,
       fonte_id, cor, alinhamento, negrito, italico, rotacao, ordem)
    VALUES
      (destino.id, origem.conteudo, origem.posicao_x, origem.posicao_y,
       origem.largura_normalizada, origem.tamanho_normalizado, origem.fonte_id,
       origem.cor, origem.alinhamento, origem.negrito, origem.italico,
       origem.rotacao, proxima_ordem);

    total := total + 1;
  END LOOP;

  RETURN total;
END;
$$;

REVOKE ALL ON FUNCTION public.foto_express_aplicar_texto_todas_fotos(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foto_express_aplicar_texto_todas_fotos(uuid, uuid, uuid) TO authenticated, service_role;
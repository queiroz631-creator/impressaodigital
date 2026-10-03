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
  texto_destino_id uuid;
  total integer := 0;
BEGIN
  IF auth.role() <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.trabalhos.editar')) THEN
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
    texto_destino_id := NULL;

    SELECT t.id INTO texto_destino_id
      FROM public.foto_express_textos t
     WHERE t.item_id = destino.id
       AND t.ordem = origem.ordem
     ORDER BY t.criado_em, t.id
     LIMIT 1
     FOR UPDATE;

    IF texto_destino_id IS NULL THEN
      INSERT INTO public.foto_express_textos
        (item_id, conteudo, posicao_x, posicao_y, largura_normalizada, tamanho_normalizado,
         fonte_id, cor, alinhamento, negrito, italico, rotacao, ordem)
      VALUES
        (destino.id, origem.conteudo, origem.posicao_x, origem.posicao_y,
         origem.largura_normalizada, origem.tamanho_normalizado, origem.fonte_id,
         origem.cor, origem.alinhamento, origem.negrito, origem.italico,
         origem.rotacao, origem.ordem);
    ELSE
      UPDATE public.foto_express_textos
         SET conteudo = origem.conteudo,
             posicao_x = origem.posicao_x,
             posicao_y = origem.posicao_y,
             largura_normalizada = origem.largura_normalizada,
             tamanho_normalizado = origem.tamanho_normalizado,
             fonte_id = origem.fonte_id,
             cor = origem.cor,
             alinhamento = origem.alinhamento,
             negrito = origem.negrito,
             italico = origem.italico,
             rotacao = origem.rotacao,
             versao = versao + 1
       WHERE id = texto_destino_id;
    END IF;

    total := total + 1;
  END LOOP;

  RETURN total;
END;
$$;

REVOKE ALL ON FUNCTION public.foto_express_aplicar_texto_todas_fotos(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foto_express_aplicar_texto_todas_fotos(uuid, uuid, uuid) TO authenticated, service_role;
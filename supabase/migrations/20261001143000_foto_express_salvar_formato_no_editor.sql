CREATE OR REPLACE FUNCTION public.foto_express_salvar_edicao_com_formato(
  _trabalho_id uuid,
  _item_id uuid,
  _formato_id uuid,
  _zoom numeric,
  _posicao_x numeric,
  _posicao_y numeric,
  _rotacao numeric,
  _crop_x numeric,
  _crop_y numeric,
  _crop_largura numeric,
  _crop_altura numeric,
  _espelhar_horizontal boolean,
  _espelhar_vertical boolean,
  _modo_ajuste text,
  _orientacao text
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  salvo_em timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.trabalhos.editar') THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;

  IF _formato_id IS NULL THEN
    RAISE EXCEPTION 'FORMATO_OBRIGATORIO';
  END IF;
  IF _zoom < 1 OR _zoom > 5 THEN
    RAISE EXCEPTION 'ZOOM_INVALIDO';
  END IF;
  IF _posicao_x < -1 OR _posicao_x > 1 OR _posicao_y < -1 OR _posicao_y > 1 THEN
    RAISE EXCEPTION 'POSICAO_INVALIDA';
  END IF;
  IF _rotacao NOT IN (0, 90, 180, 270) THEN
    RAISE EXCEPTION 'ROTACAO_INVALIDA';
  END IF;
  IF _modo_ajuste NOT IN ('PREENCHER', 'AJUSTAR') THEN
    RAISE EXCEPTION 'MODO_AJUSTE_INVALIDO';
  END IF;
  IF _orientacao NOT IN ('AUTOMATICA', 'RETRATO', 'PAISAGEM') THEN
    RAISE EXCEPTION 'ORIENTACAO_INVALIDA';
  END IF;
  IF _crop_x IS NULL OR _crop_y IS NULL OR _crop_largura IS NULL OR _crop_altura IS NULL
     OR _crop_x < 0 OR _crop_y < 0 OR _crop_largura <= 0 OR _crop_altura <= 0
     OR _crop_x + _crop_largura > 1.000001 OR _crop_y + _crop_altura > 1.000001 THEN
    RAISE EXCEPTION 'CROP_INVALIDO';
  END IF;

  PERFORM 1
    FROM public.foto_express_itens
   WHERE id = _item_id AND trabalho_id = _trabalho_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FOTO_NAO_ENCONTRADA';
  END IF;

  PERFORM 1
    FROM public.foto_express_formatos
   WHERE id = _formato_id AND ativo = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FORMATO_INVALIDO';
  END IF;

  UPDATE public.foto_express_configuracoes
     SET zoom = _zoom,
         posicao_x = _posicao_x,
         posicao_y = _posicao_y,
         rotacao = _rotacao,
         crop_x = _crop_x,
         crop_y = _crop_y,
         crop_largura = _crop_largura,
         crop_altura = _crop_altura,
         espelhar_horizontal = _espelhar_horizontal,
         espelhar_vertical = _espelhar_vertical,
         modo_ajuste = _modo_ajuste
   WHERE item_id = _item_id
   RETURNING atualizado_em INTO salvo_em;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONFIGURACAO_NAO_ENCONTRADA';
  END IF;

  UPDATE public.foto_express_itens
     SET formato_id = _formato_id,
         orientacao = _orientacao,
         status_edicao = 'CONFIGURADA'
   WHERE id = _item_id AND trabalho_id = _trabalho_id;

  RETURN salvo_em;
END;
$$;

REVOKE ALL ON FUNCTION public.foto_express_salvar_edicao_com_formato(uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,boolean,boolean,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foto_express_salvar_edicao_com_formato(uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,boolean,boolean,text,text) TO authenticated, service_role;
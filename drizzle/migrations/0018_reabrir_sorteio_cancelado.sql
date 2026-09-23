-- Reabertura controlada: ENCERRADO -> ATIVO e CANCELADO -> situacao anterior (ATIVO/RASCUNHO).
CREATE OR REPLACE FUNCTION public.sorteio_reabrir(_sorteio_id uuid, _usuario_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _s public.sorteios;
  _motivo text;
  _destino text;
  _anterior text;
BEGIN
  SELECT * INTO _s FROM public.sorteios WHERE id = _sorteio_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('resultado', 'IGNORADO', 'motivo', 'sorteio_nao_encontrado');
  END IF;

  IF _s.status NOT IN ('ENCERRADO', 'CANCELADO') THEN
    _motivo := CASE _s.status
      WHEN 'ATIVO' THEN 'ja_ativo'
      WHEN 'SORTEADO' THEN 'ja_sorteado'
      WHEN 'RASCUNHO' THEN 'em_rascunho'
      ELSE 'status_invalido' END;
    RETURN jsonb_build_object('resultado', 'IGNORADO', 'motivo', _motivo, 'status', _s.status);
  END IF;

  IF EXISTS (SELECT 1 FROM public.sorteio_ganhadores WHERE sorteio_id = _sorteio_id) THEN
    RETURN jsonb_build_object('resultado', 'IGNORADO', 'motivo', 'ja_sorteado', 'status', _s.status);
  END IF;

  IF _s.status = 'ENCERRADO' THEN
    _destino := 'ATIVO';
  ELSE
    SELECT a.detalhe->>'de' INTO _anterior
      FROM public.sorteio_auditoria a
     WHERE a.sorteio_id = _sorteio_id
       AND a.evento = 'sorteio.status_alterado'
       AND a.detalhe->>'para' = 'CANCELADO'
     ORDER BY a.criado_em DESC
     LIMIT 1;
    IF _anterior = 'RASCUNHO' THEN
      _destino := 'RASCUNHO';
    ELSIF _anterior IN ('ATIVO', 'ENCERRADO') THEN
      _destino := 'ATIVO';
    ELSIF EXISTS (SELECT 1 FROM public.sorteio_participantes WHERE sorteio_id = _sorteio_id)
       OR EXISTS (SELECT 1 FROM public.sorteio_notas WHERE sorteio_id = _sorteio_id)
       OR EXISTS (SELECT 1 FROM public.sorteio_cupons WHERE sorteio_id = _sorteio_id) THEN
      _destino := 'ATIVO';
    ELSE
      _destino := 'RASCUNHO';
    END IF;
  END IF;

  UPDATE public.sorteios
     SET status = _destino,
         encerrado_em = NULL,
         encerrado_por = NULL
   WHERE id = _sorteio_id
     AND status = _s.status;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sorteio % alterado simultaneamente; reabertura desfeita', _sorteio_id;
  END IF;

  INSERT INTO public.sorteio_auditoria (sorteio_id, evento, origem, usuario_id, detalhe)
  VALUES (_sorteio_id, 'sorteio.reaberto', 'painel', _usuario_id,
    jsonb_build_object('de', _s.status, 'para', _destino, 'reaberto_em', now(),
      'encerramento_anterior_em', _s.encerrado_em,
      'encerramento_anterior_por', _s.encerrado_por));

  RETURN jsonb_build_object('resultado', 'REABERTO', 'sorteio_id', _sorteio_id,
    'reaberto_em', now(), 'reaberto_por', _usuario_id, 'status', _destino);
END;
$$;

REVOKE ALL ON FUNCTION public.sorteio_reabrir(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sorteio_reabrir(uuid, uuid) TO service_role;
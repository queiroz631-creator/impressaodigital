-- Reabertura controlada: ENCERRADO -> ATIVO (unica excecao a regra de nao voltar).
-- Tudo em uma unica transacao: LOCK -> validacao -> UPDATE -> auditoria.
CREATE OR REPLACE FUNCTION public.sorteio_reabrir(_sorteio_id uuid, _usuario_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _s public.sorteios;
  _motivo text;
BEGIN
  SELECT * INTO _s FROM public.sorteios WHERE id = _sorteio_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('resultado', 'IGNORADO', 'motivo', 'sorteio_nao_encontrado');
  END IF;

  IF _s.status <> 'ENCERRADO' THEN
    _motivo := CASE _s.status
      WHEN 'ATIVO' THEN 'ja_ativo'
      WHEN 'SORTEADO' THEN 'ja_sorteado'
      WHEN 'CANCELADO' THEN 'cancelado'
      WHEN 'RASCUNHO' THEN 'em_rascunho'
      ELSE 'status_invalido' END;
    RETURN jsonb_build_object('resultado', 'IGNORADO', 'motivo', _motivo,
      'status', _s.status);
  END IF;

  UPDATE public.sorteios
     SET status = 'ATIVO',
         encerrado_em = NULL,
         encerrado_por = NULL
   WHERE id = _sorteio_id
     AND status = 'ENCERRADO';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sorteio % alterado simultaneamente; reabertura desfeita', _sorteio_id;
  END IF;

  INSERT INTO public.sorteio_auditoria
    (sorteio_id, evento, origem, usuario_id, detalhe)
  VALUES
    (_sorteio_id, 'sorteio.reaberto', 'painel', _usuario_id,
     jsonb_build_object(
       'de', 'ENCERRADO',
       'para', 'ATIVO',
       'reaberto_em', now(),
       'encerramento_anterior_em', _s.encerrado_em,
       'encerramento_anterior_por', _s.encerrado_por));

  RETURN jsonb_build_object('resultado', 'REABERTO', 'sorteio_id', _sorteio_id,
    'reaberto_em', now(), 'reaberto_por', _usuario_id, 'status', 'ATIVO');
END;
$$;

REVOKE ALL ON FUNCTION public.sorteio_reabrir(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sorteio_reabrir(uuid, uuid) TO service_role;
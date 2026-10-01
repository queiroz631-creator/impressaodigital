CREATE OR REPLACE FUNCTION public.foto_express_concluir_geracao(_geracao_id uuid, _arquivos jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE esperado integer; recebido integer; registro jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.trabalhos.editar') THEN RAISE EXCEPTION 'SEM_PERMISSAO'; END IF;
  PERFORM 1 FROM public.foto_express_geracoes WHERE id=_geracao_id AND criado_por=auth.uid() AND estado='PROCESSANDO' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GERACAO_INVALIDA'; END IF;
  IF jsonb_typeof(_arquivos)<>'array' THEN RAISE EXCEPTION 'ARQUIVOS_INVALIDOS'; END IF;
  SELECT count(*) INTO esperado FROM public.foto_express_arquivos_impressao WHERE geracao_id=_geracao_id AND estado='ESPERADO';
  SELECT count(DISTINCT value->>'id') INTO recebido FROM jsonb_array_elements(_arquivos);
  IF esperado=0 OR recebido<>esperado OR jsonb_array_length(_arquivos)<>esperado THEN RAISE EXCEPTION 'CONJUNTO_INCOMPLETO'; END IF;
  FOR registro IN SELECT value FROM jsonb_array_elements(_arquivos) LOOP
    UPDATE public.foto_express_arquivos_impressao SET
      estado='VALIDADO', tamanho_bytes=(registro->>'tamanho')::bigint,
      largura_px=NULLIF(registro->>'largura','')::integer,
      altura_px=NULLIF(registro->>'altura','')::integer,
      paginas=NULLIF(registro->>'paginas','')::integer
    WHERE id=(registro->>'id')::uuid AND geracao_id=_geracao_id AND estado='ESPERADO'
      AND (registro->>'tamanho')::bigint>0;
    IF NOT FOUND THEN RAISE EXCEPTION 'ARQUIVO_INVALIDO'; END IF;
  END LOOP;
  UPDATE public.foto_express_geracoes SET estado='CONCLUIDA',etapa='CONCLUIDA',concluido_em=now(),erro=NULL WHERE id=_geracao_id;
END;
$$;
REVOKE ALL ON FUNCTION public.foto_express_concluir_geracao(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foto_express_concluir_geracao(uuid,jsonb) TO authenticated, service_role;
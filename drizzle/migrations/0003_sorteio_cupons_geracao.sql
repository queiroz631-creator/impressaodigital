ALTER TABLE public.sorteio_notas
  ADD COLUMN IF NOT EXISTS cupons_processado_em timestamptz;

CREATE INDEX IF NOT EXISTS sorteio_notas_cupons_pendentes_idx
  ON public.sorteio_notas (sorteio_id, cadastrado_em)
  WHERE status = 'VALIDA' AND cupons_processado_em IS NULL;

CREATE INDEX IF NOT EXISTS sorteio_cupons_sorteio_status_idx
  ON public.sorteio_cupons (sorteio_id, status);

CREATE INDEX IF NOT EXISTS sorteio_cupons_numero_idx
  ON public.sorteio_cupons (numero);

CREATE OR REPLACE FUNCTION public.sorteio_gerar_cupons_da_nota(_nota_id uuid, _origem text DEFAULT 'rotina', _usuario_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _nota public.sorteio_notas;
  _part public.sorteio_participantes;
  _sorteio public.sorteios;
  _total int;
  _cupons int;
  _emitidos int;
  _restante int;
  _saldo int;
  _num text;
  _tent int;
  _i int;
BEGIN
  SELECT * INTO _nota FROM public.sorteio_notas WHERE id = _nota_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('resultado', 'IGNORADA', 'motivo', 'nota_nao_encontrada');
  END IF;

  -- Serializa o saldo por participante: só um processamento por vez.
  SELECT * INTO _part FROM public.sorteio_participantes
   WHERE id = _nota.participante_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('resultado', 'IGNORADA', 'motivo', 'participante_nao_encontrado');
  END IF;

  -- Relê a nota já com a participação travada (idempotência).
  SELECT * INTO _nota FROM public.sorteio_notas WHERE id = _nota_id;
  IF _nota.cupons_processado_em IS NOT NULL THEN
    RETURN jsonb_build_object('resultado', 'IGNORADA', 'motivo', 'ja_processada',
      'cupons', _nota.cupons_gerados, 'saldo_centavos', _part.saldo_centavos);
  END IF;
  IF _nota.status <> 'VALIDA' THEN
    RETURN jsonb_build_object('resultado', 'IGNORADA', 'motivo', 'nota_nao_valida');
  END IF;

  SELECT * INTO _sorteio FROM public.sorteios WHERE id = _nota.sorteio_id;
  IF NOT FOUND OR _sorteio.status <> 'ATIVO' THEN
    RETURN jsonb_build_object('resultado', 'IGNORADA', 'motivo', 'sorteio_inativo');
  END IF;
  IF coalesce(_sorteio.valor_por_cupom_centavos, 0) <= 0 THEN
    RETURN jsonb_build_object('resultado', 'IGNORADA', 'motivo', 'valor_por_cupom_invalido');
  END IF;

  _total := _part.saldo_centavos + _nota.valor_centavos;
  _cupons := _total / _sorteio.valor_por_cupom_centavos;

  IF _sorteio.quantidade_maxima_cupons IS NOT NULL THEN
    SELECT count(*) INTO _emitidos FROM public.sorteio_cupons
     WHERE sorteio_id = _sorteio.id AND status <> 'CANCELADO';
    _restante := greatest(_sorteio.quantidade_maxima_cupons - _emitidos, 0);
    IF _cupons > _restante THEN _cupons := _restante; END IF;
  END IF;

  _saldo := _total - (_cupons * _sorteio.valor_por_cupom_centavos);

  FOR _i IN 1.._cupons LOOP
    _tent := 0;
    LOOP
      _tent := _tent + 1;
      _num := lpad(_sorteio.numero_sorteio::text, 2, '0') || '-'
              || lpad((floor(random() * 1000000))::int::text, 6, '0');
      BEGIN
        INSERT INTO public.sorteio_cupons
          (sorteio_id, participante_id, nota_id, numero, valor_base_centavos, status)
        VALUES
          (_nota.sorteio_id, _nota.participante_id, _nota.id, _num,
           _sorteio.valor_por_cupom_centavos, 'ATIVO');
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF _tent >= 10 THEN
          RAISE EXCEPTION 'Nao foi possivel gerar numero de cupom unico para o sorteio %', _sorteio.id;
        END IF;
      END;
    END LOOP;
  END LOOP;

  UPDATE public.sorteio_notas
     SET cupons_gerados = _cupons,
         saldo_gerado_centavos = _saldo,
         cupons_processado_em = now()
   WHERE id = _nota.id
     AND cupons_processado_em IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota % processada simultaneamente', _nota.id;
  END IF;

  UPDATE public.sorteio_participantes
     SET saldo_centavos = _saldo
   WHERE id = _part.id;

  INSERT INTO public.sorteio_auditoria
    (sorteio_id, participante_id, cliente_id, nota_id, evento, origem, usuario_id, detalhe)
  VALUES
    (_nota.sorteio_id, _part.id, _part.cliente_id, _nota.id, 'cupons.gerados',
     coalesce(_origem, 'rotina'), _usuario_id,
     jsonb_build_object(
       'numero_nota', _nota.numero,
       'valor_nota_centavos', _nota.valor_centavos,
       'saldo_anterior_centavos', _part.saldo_centavos,
       'cupons', _cupons,
       'saldo_centavos', _saldo,
       'valor_por_cupom_centavos', _sorteio.valor_por_cupom_centavos));

  RETURN jsonb_build_object('resultado', 'PROCESSADA', 'cupons', _cupons,
    'saldo_centavos', _saldo);
END;
$function$;

REVOKE ALL ON FUNCTION public.sorteio_gerar_cupons_da_nota(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sorteio_gerar_cupons_da_nota(uuid, text, uuid) TO service_role;
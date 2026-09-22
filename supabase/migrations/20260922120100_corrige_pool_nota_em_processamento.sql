-- Corrige o pool: a propria nota em processamento entra no pool antes de
-- receber cupons_processado_em.
CREATE OR REPLACE FUNCTION public.sorteio_emitir_cupons_do_pool(
  _participante_id uuid,
  _origem text DEFAULT 'rotina',
  _usuario_id uuid DEFAULT NULL::uuid,
  _nota_referencia uuid DEFAULT NULL::uuid,
  _pool_maximo bigint DEFAULT NULL::bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _part public.sorteio_participantes;
  _sorteio public.sorteios;
  _pool bigint := 0;
  _cupons int := 0;
  _emitidos int;
  _restante int;
  _saldo bigint;
  _num text;
  _tent int;
  _i int;
  _cupom_id uuid;
  _resto bigint;
  _f public.sorteio_saldo_fontes;
  _usa bigint;
  _ordem int;
  _nota_fecha uuid;
  _contribuicoes int := 0;
BEGIN
  SELECT * INTO _part FROM public.sorteio_participantes WHERE id = _participante_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('resultado', 'IGNORADA', 'motivo', 'participante_nao_encontrado');
  END IF;

  SELECT * INTO _sorteio FROM public.sorteios WHERE id = _part.sorteio_id;
  IF NOT FOUND OR _sorteio.status <> 'ATIVO'
     OR coalesce(_sorteio.valor_por_cupom_centavos, 0) <= 0 THEN
    SELECT coalesce(sum(f.valor_pendente_centavos), 0) INTO _saldo
      FROM public.sorteio_saldo_fontes f
     WHERE f.participante_id = _part.id AND f.status = 'PENDENTE';
    RETURN jsonb_build_object('resultado', 'IGNORADA', 'motivo', 'sorteio_indisponivel',
      'cupons', 0, 'contribuicoes', 0, 'saldo_centavos', _saldo);
  END IF;

  -- Pool = fontes PENDENTE de notas VALIDA ja processadas + a nota em processamento.
  SELECT coalesce(sum(f.valor_pendente_centavos), 0) INTO _pool
    FROM public.sorteio_saldo_fontes f
    JOIN public.sorteio_notas n ON n.id = f.nota_id
   WHERE f.participante_id = _part.id
     AND f.status = 'PENDENTE'
     AND n.status = 'VALIDA'
     AND (n.cupons_processado_em IS NOT NULL OR n.id = _nota_referencia);

  IF _pool_maximo IS NOT NULL AND _pool > _pool_maximo THEN
    _pool := _pool_maximo;
  END IF;

  _cupons := (_pool / _sorteio.valor_por_cupom_centavos)::int;

  IF _sorteio.quantidade_maxima_cupons IS NOT NULL THEN
    SELECT count(*) INTO _emitidos FROM public.sorteio_cupons
     WHERE sorteio_id = _sorteio.id AND status <> 'CANCELADO';
    _restante := greatest(_sorteio.quantidade_maxima_cupons - _emitidos, 0);
    IF _cupons > _restante THEN
      _cupons := _restante;
    END IF;
  END IF;

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
          (_sorteio.id, _part.id,
           coalesce(_nota_referencia,
             (SELECT f2.nota_id FROM public.sorteio_saldo_fontes f2
               WHERE f2.participante_id = _part.id AND f2.status = 'PENDENTE'
                 AND f2.valor_pendente_centavos > 0
               ORDER BY f2.sequencia ASC LIMIT 1)),
           _num, _sorteio.valor_por_cupom_centavos, 'ATIVO')
        RETURNING id INTO _cupom_id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF _tent >= 10 THEN
          RAISE EXCEPTION 'Nao foi possivel gerar numero de cupom unico para o sorteio %', _sorteio.id;
        END IF;
      END;
    END LOOP;

    -- Consome o pool em ordem FIFO e grava de onde veio cada centavo.
    _resto := _sorteio.valor_por_cupom_centavos;
    _ordem := 0;
    _nota_fecha := NULL;
    FOR _f IN
      SELECT f.* FROM public.sorteio_saldo_fontes f
       JOIN public.sorteio_notas n ON n.id = f.nota_id
       WHERE f.participante_id = _part.id
         AND f.status = 'PENDENTE'
         AND f.valor_pendente_centavos > 0
         AND n.status = 'VALIDA'
         AND (n.cupons_processado_em IS NOT NULL OR n.id = _nota_referencia)
       ORDER BY f.sequencia ASC
       FOR UPDATE OF f
    LOOP
      EXIT WHEN _resto <= 0;
      _usa := least(_resto, _f.valor_pendente_centavos);
      INSERT INTO public.sorteio_cupom_contribuicoes
        (sorteio_id, participante_id, cupom_id, nota_id, valor_centavos, ordem)
      VALUES
        (_sorteio.id, _part.id, _cupom_id, _f.nota_id, _usa, _ordem);
      _ordem := _ordem + 1;
      _contribuicoes := _contribuicoes + 1;
      _nota_fecha := _f.nota_id;
      UPDATE public.sorteio_saldo_fontes
         SET valor_pendente_centavos = (valor_pendente_centavos - _usa)::int,
             status = CASE WHEN valor_pendente_centavos - _usa = 0
                           THEN 'ESGOTADO' ELSE 'PENDENTE' END,
             atualizado_em = now()
       WHERE id = _f.id;
      _resto := _resto - _usa;
    END LOOP;

    IF _resto > 0 THEN
      RAISE EXCEPTION 'Fontes de saldo insuficientes para o cupom % do participante %',
        _num, _part.id;
    END IF;

    IF _nota_fecha IS NOT NULL THEN
      UPDATE public.sorteio_cupons SET nota_id = _nota_fecha WHERE id = _cupom_id;
    END IF;
  END LOOP;

  SELECT coalesce(sum(valor_pendente_centavos), 0) INTO _saldo
    FROM public.sorteio_saldo_fontes
   WHERE participante_id = _part.id AND status = 'PENDENTE';

  IF _saldo IS DISTINCT FROM _part.saldo_centavos THEN
    UPDATE public.sorteio_participantes SET saldo_centavos = _saldo::int
     WHERE id = _part.id;
  END IF;

  IF _cupons > 0 THEN
    INSERT INTO public.sorteio_auditoria
      (sorteio_id, participante_id, cliente_id, nota_id, evento, origem, usuario_id, detalhe)
    VALUES
      (_sorteio.id, _part.id, _part.cliente_id, _nota_referencia, 'cupons.gerados',
       coalesce(_origem, 'rotina'), _usuario_id,
       jsonb_build_object(
         'saldo_anterior_centavos', _part.saldo_centavos,
         'cupons', _cupons,
         'contribuicoes', _contribuicoes,
         'saldo_centavos', _saldo,
         'valor_por_cupom_centavos', _sorteio.valor_por_cupom_centavos));
  END IF;

  RETURN jsonb_build_object('resultado', 'PROCESSADA', 'cupons', _cupons,
    'contribuicoes', _contribuicoes, 'saldo_centavos', _saldo);
END;
$function$;

REVOKE ALL ON FUNCTION public.sorteio_emitir_cupons_do_pool(uuid, text, uuid, uuid, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sorteio_emitir_cupons_do_pool(uuid, text, uuid, uuid, bigint) FROM anon;
REVOKE ALL ON FUNCTION public.sorteio_emitir_cupons_do_pool(uuid, text, uuid, uuid, bigint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sorteio_emitir_cupons_do_pool(uuid, text, uuid, uuid, bigint) TO service_role;
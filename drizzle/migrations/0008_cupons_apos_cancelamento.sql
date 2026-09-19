-- Emissao de cupons a partir do pool de fontes PENDENTE, em uma unica rotina
-- compartilhada: processamento normal da nota E saldo liberado por cancelamento.
-- Pressupoe a participacao ja travada (FOR UPDATE) pelo chamador.

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

  -- Pool = somente fontes PENDENTE de notas que continuam VALIDA e processadas.
  SELECT coalesce(sum(f.valor_pendente_centavos), 0) INTO _pool
    FROM public.sorteio_saldo_fontes f
    JOIN public.sorteio_notas n ON n.id = f.nota_id
   WHERE f.participante_id = _part.id
     AND f.status = 'PENDENTE'
     AND n.status = 'VALIDA'
     AND n.cupons_processado_em IS NOT NULL;

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
         AND n.cupons_processado_em IS NOT NULL
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

    -- O cupom pertence a nota que o completou (a composicao completa fica nas
    -- contribuicoes).
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

-- Geracao da nota: mesma regra de sempre, agora delegando a emissao.
CREATE OR REPLACE FUNCTION public.sorteio_gerar_cupons_da_nota(
  _nota_id uuid,
  _origem text DEFAULT 'rotina',
  _usuario_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _nota public.sorteio_notas;
  _part public.sorteio_participantes;
  _sorteio public.sorteios;
  _fonte public.sorteio_saldo_fontes;
  _pool bigint;
  _esperado bigint;
  _limite bigint := NULL;
  _r jsonb;
  _cupons int;
  _saldo bigint;
BEGIN
  SELECT * INTO _nota FROM public.sorteio_notas WHERE id = _nota_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('resultado', 'IGNORADA', 'motivo', 'nota_nao_encontrada');
  END IF;

  SELECT * INTO _part FROM public.sorteio_participantes
   WHERE id = _nota.participante_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('resultado', 'IGNORADA', 'motivo', 'participante_nao_encontrado');
  END IF;

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

  INSERT INTO public.sorteio_saldo_fontes
    (sorteio_id, participante_id, nota_id, valor_original_centavos,
     valor_pendente_centavos, status, criado_em, atualizado_em)
  VALUES
    (_nota.sorteio_id, _nota.participante_id, _nota.id, _nota.valor_centavos,
     _nota.valor_centavos, 'PENDENTE', now(), now())
  ON CONFLICT (nota_id) DO NOTHING
  RETURNING * INTO _fonte;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota % ja possui fonte de saldo', _nota.id;
  END IF;

  _esperado := _part.saldo_centavos + _nota.valor_centavos;
  SELECT coalesce(sum(valor_pendente_centavos), 0) INTO _pool
    FROM public.sorteio_saldo_fontes
   WHERE participante_id = _part.id AND status = 'PENDENTE';

  IF _pool <> _esperado THEN
    INSERT INTO public.sorteio_auditoria
      (sorteio_id, participante_id, cliente_id, nota_id, evento, origem, usuario_id, detalhe)
    VALUES
      (_nota.sorteio_id, _part.id, _part.cliente_id, _nota.id, 'saldo.fontes_divergentes',
       coalesce(_origem, 'rotina'), _usuario_id,
       jsonb_build_object('pool_centavos', _pool, 'esperado_centavos', _esperado,
                          'saldo_centavos', _part.saldo_centavos,
                          'valor_nota_centavos', _nota.valor_centavos));
    IF _pool > _esperado THEN
      _limite := _esperado;
    END IF;
  END IF;

  _r := public.sorteio_emitir_cupons_do_pool(_part.id, coalesce(_origem, 'rotina'),
                                             _usuario_id, _nota.id, _limite);
  _cupons := coalesce((_r ->> 'cupons')::int, 0);
  _saldo := coalesce((_r ->> 'saldo_centavos')::bigint, 0);

  UPDATE public.sorteio_notas
     SET cupons_gerados = _cupons,
         saldo_gerado_centavos = _saldo::int,
         cupons_processado_em = now()
   WHERE id = _nota.id
     AND cupons_processado_em IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota % processada simultaneamente', _nota.id;
  END IF;

  RETURN jsonb_build_object('resultado', 'PROCESSADA', 'cupons', _cupons,
    'contribuicoes', coalesce((_r ->> 'contribuicoes')::int, 0),
    'saldo_centavos', _saldo);
END;
$function$;

REVOKE ALL ON FUNCTION public.sorteio_gerar_cupons_da_nota(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sorteio_gerar_cupons_da_nota(uuid, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.sorteio_gerar_cupons_da_nota(uuid, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sorteio_gerar_cupons_da_nota(uuid, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.sorteio_recalcular_saldo_participante(
  _participante_id uuid,
  _origem text DEFAULT 'rotina',
  _usuario_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _part public.sorteio_participantes;
  _total bigint := 0;
  _consumido bigint := 0;
  _pool bigint := 0;
  _saldo int;
  _cupons int := 0;
  _utilizados int := 0;
  _cancelados int := 0;
  _ajuste bigint := 0;
  _ajuste_inicial bigint := 0;
  _usa bigint;
  _fonte public.sorteio_saldo_fontes;
  _cupom public.sorteio_cupons;
  _r jsonb;
  _novos int := 0;
  _saldo_final int;
BEGIN
  SELECT * INTO _part FROM public.sorteio_participantes
   WHERE id = _participante_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('resultado', 'IGNORADA', 'motivo', 'participante_nao_encontrado');
  END IF;

  -- 1) Notas que deixaram de ser válidas/processadas saem do pool.
  UPDATE public.sorteio_saldo_fontes f
     SET status = 'CANCELADO',
         valor_pendente_centavos = 0,
         atualizado_em = now()
    FROM public.sorteio_notas n
   WHERE n.id = f.nota_id
     AND f.participante_id = _part.id
     AND f.status <> 'CANCELADO'
     AND NOT (n.status = 'VALIDA' AND n.cupons_processado_em IS NOT NULL);

  -- 2) Cancela exatamente os cupons cujo lastro (contribuições de notas ainda
  --    válidas) não cobre mais o valor do cupom. Cupons utilizados nunca são
  --    cancelados e cupons sem composição não podem ser julgados aqui.
  FOR _cupom IN
    SELECT c.* FROM public.sorteio_cupons c
     WHERE c.participante_id = _part.id
       AND c.status = 'ATIVO'
       AND EXISTS (SELECT 1 FROM public.sorteio_cupom_contribuicoes x
                    WHERE x.cupom_id = c.id)
       AND (SELECT coalesce(sum(x.valor_centavos), 0)
              FROM public.sorteio_cupom_contribuicoes x
              JOIN public.sorteio_notas n ON n.id = x.nota_id
             WHERE x.cupom_id = c.id
               AND n.status = 'VALIDA'
               AND n.cupons_processado_em IS NOT NULL) < c.valor_base_centavos
     ORDER BY c.gerado_em ASC, c.numero ASC
     FOR UPDATE
  LOOP
    UPDATE public.sorteio_cupons
       SET status = 'CANCELADO',
           cancelado_em = COALESCE(cancelado_em, now())
     WHERE id = _cupom.id;

    INSERT INTO public.sorteio_auditoria
      (sorteio_id, participante_id, cliente_id, nota_id, cupom_id, evento, origem,
       usuario_id, detalhe)
    VALUES
      (_part.sorteio_id, _part.id, _part.cliente_id, _cupom.nota_id, _cupom.id,
       'cupom.cancelado', coalesce(_origem, 'rotina'), _usuario_id,
       jsonb_build_object(
         'motivo', 'perdeu_lastro',
         'numero', _cupom.numero,
         'valor_base_centavos', _cupom.valor_base_centavos,
         'lastro_centavos', (SELECT coalesce(sum(x.valor_centavos), 0)
                               FROM public.sorteio_cupom_contribuicoes x
                               JOIN public.sorteio_notas n ON n.id = x.nota_id
                              WHERE x.cupom_id = _cupom.id
                                AND n.status = 'VALIDA'
                                AND n.cupons_processado_em IS NOT NULL)));

    _cancelados := _cancelados + 1;
  END LOOP;

  -- 3) Recompõe o pool: o que sobra de cada nota é o valor dela menos o que está
  --    dentro de cupons que continuam valendo.
  UPDATE public.sorteio_saldo_fontes f
     SET valor_original_centavos = n.valor_centavos,
         valor_pendente_centavos = greatest(n.valor_centavos - coalesce(s.consumido, 0), 0)::int,
         status = CASE WHEN greatest(n.valor_centavos - coalesce(s.consumido, 0), 0) = 0
                       THEN 'ESGOTADO' ELSE 'PENDENTE' END,
         atualizado_em = now()
    FROM public.sorteio_notas n
    LEFT JOIN (
      SELECT x.nota_id, sum(x.valor_centavos) AS consumido
        FROM public.sorteio_cupom_contribuicoes x
        JOIN public.sorteio_cupons c ON c.id = x.cupom_id
       WHERE c.status <> 'CANCELADO'
       GROUP BY x.nota_id
    ) s ON s.nota_id = n.id
   WHERE n.id = f.nota_id
     AND f.participante_id = _part.id
     AND n.status = 'VALIDA'
     AND n.cupons_processado_em IS NOT NULL;

  -- 4) Totais pela regra oficial: notas válidas processadas menos cupons que
  --    continuam valendo.
  SELECT coalesce(sum(valor_centavos), 0) INTO _total
    FROM public.sorteio_notas
   WHERE participante_id = _part.id
     AND status = 'VALIDA'
     AND cupons_processado_em IS NOT NULL;

  SELECT coalesce(sum(valor_base_centavos), 0) INTO _consumido
    FROM public.sorteio_cupons
   WHERE participante_id = _part.id
     AND status <> 'CANCELADO';

  _saldo := greatest(_total - _consumido, 0)::int;

  SELECT coalesce(sum(valor_pendente_centavos), 0) INTO _pool
    FROM public.sorteio_saldo_fontes
   WHERE participante_id = _part.id AND status = 'PENDENTE';

  -- 5) A soma do que sobra nas fontes é o saldo do cliente. Se divergir (cupons
  --    antigos sem composição, por exemplo), ajusta e registra em vez de inventar.
  _ajuste := _saldo - _pool;
  _ajuste_inicial := _ajuste;

  WHILE _ajuste < 0 LOOP
    SELECT * INTO _fonte FROM public.sorteio_saldo_fontes
     WHERE participante_id = _part.id
       AND status = 'PENDENTE'
       AND valor_pendente_centavos > 0
     ORDER BY sequencia DESC
     LIMIT 1
       FOR UPDATE;
    EXIT WHEN NOT FOUND;
    _usa := least(-_ajuste, _fonte.valor_pendente_centavos);
    UPDATE public.sorteio_saldo_fontes
       SET valor_pendente_centavos = (valor_pendente_centavos - _usa)::int,
           status = CASE WHEN valor_pendente_centavos - _usa = 0
                         THEN 'ESGOTADO' ELSE 'PENDENTE' END,
           atualizado_em = now()
     WHERE id = _fonte.id;
    _ajuste := _ajuste + _usa;
  END LOOP;

  IF _ajuste > 0 THEN
    SELECT * INTO _fonte FROM public.sorteio_saldo_fontes
     WHERE participante_id = _part.id
       AND status <> 'CANCELADO'
     ORDER BY sequencia DESC
     LIMIT 1
       FOR UPDATE;
    IF FOUND THEN
      UPDATE public.sorteio_saldo_fontes
         SET valor_pendente_centavos = (valor_pendente_centavos + _ajuste)::int,
             valor_original_centavos = (valor_original_centavos + _ajuste)::int,
             status = 'PENDENTE',
             atualizado_em = now()
       WHERE id = _fonte.id;
      _ajuste := 0;
    END IF;
  END IF;

  IF _ajuste_inicial <> 0 THEN
    INSERT INTO public.sorteio_auditoria
      (sorteio_id, participante_id, cliente_id, evento, origem, usuario_id, detalhe)
    VALUES
      (_part.sorteio_id, _part.id, _part.cliente_id, 'saldo.fontes_ajustadas',
       coalesce(_origem, 'rotina'), _usuario_id,
       jsonb_build_object('diferenca_centavos', _ajuste_inicial,
                          'pool_centavos', _pool,
                          'saldo_centavos', _saldo,
                          'nao_reconciliado_centavos', _ajuste));
  END IF;

  -- 6) Déficit: cupons utilizados (ou sem composição) que as notas restantes não
  --    sustentam mais. Nunca são cancelados; ficam registrados para decisão humana.
  SELECT count(*) INTO _utilizados
    FROM public.sorteio_cupons
   WHERE participante_id = _part.id AND status = 'UTILIZADO';

  IF _consumido > _total THEN
    INSERT INTO public.sorteio_auditoria
      (sorteio_id, participante_id, cliente_id, evento, origem, usuario_id, detalhe)
    VALUES
      (_part.sorteio_id, _part.id, _part.cliente_id, 'cupom.deficit_registrado',
       coalesce(_origem, 'rotina'), _usuario_id,
       jsonb_build_object('total_notas_centavos', _total,
                          'consumido_centavos', _consumido,
                          'deficit_centavos', _consumido - _total,
                          'cupons_utilizados', _utilizados));
  END IF;

  SELECT count(*) INTO _cupons
    FROM public.sorteio_cupons
   WHERE participante_id = _part.id AND status <> 'CANCELADO';

  IF _saldo IS DISTINCT FROM _part.saldo_centavos THEN
    UPDATE public.sorteio_participantes
       SET saldo_centavos = _saldo
     WHERE id = _part.id;

    INSERT INTO public.sorteio_auditoria
      (sorteio_id, participante_id, cliente_id, evento, origem, usuario_id, detalhe)
    VALUES
      (_part.sorteio_id, _part.id, _part.cliente_id, 'saldo.recalculado',
       coalesce(_origem, 'rotina'), _usuario_id,
       jsonb_build_object(
         'saldo_anterior_centavos', _part.saldo_centavos,
         'saldo_centavos', _saldo,
         'total_notas_centavos', _total,
         'consumido_centavos', _consumido,
         'cupons_considerados', _cupons,
         'cupons_cancelados_por_lastro', _cancelados,
         'cupons_cancelados_sem_lastro', _cancelados));
  END IF;

  -- 7) O saldo liberado pelo cancelamento entra imediatamente na MESMA rotina de
  --    geracao usada no processamento normal das notas: se der um cupom, sai agora.
  _r := public.sorteio_emitir_cupons_do_pool(_part.id, coalesce(_origem, 'rotina'),
                                             _usuario_id, NULL, NULL);
  _novos := coalesce((_r ->> 'cupons')::int, 0);
  _saldo_final := coalesce((_r ->> 'saldo_centavos')::int, _saldo);

  IF _novos > 0 THEN
    SELECT coalesce(sum(valor_base_centavos), 0) INTO _consumido
      FROM public.sorteio_cupons
     WHERE participante_id = _part.id AND status <> 'CANCELADO';
    SELECT count(*) INTO _cupons
      FROM public.sorteio_cupons
     WHERE participante_id = _part.id AND status <> 'CANCELADO';
  END IF;

  RETURN jsonb_build_object(
    'resultado', 'OK',
    'alterado', _saldo_final IS DISTINCT FROM _part.saldo_centavos,
    'saldo_anterior_centavos', _part.saldo_centavos,
    'saldo_centavos', _saldo_final,
    'cupons_gerados_apos_recalculo', _novos,
    'total_notas_centavos', _total,
    'consumido_centavos', _consumido,
    'cupons_considerados', _cupons,
    'cupons_cancelados_por_lastro', _cancelados,
    'cupons_cancelados_sem_lastro', _cancelados,
    'deficit_centavos', greatest(_consumido - _total, 0));
END;
$function$;

REVOKE ALL ON FUNCTION public.sorteio_recalcular_saldo_participante(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sorteio_recalcular_saldo_participante(uuid, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.sorteio_recalcular_saldo_participante(uuid, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sorteio_recalcular_saldo_participante(uuid, text, uuid) TO service_role;
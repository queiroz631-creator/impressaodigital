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
  _total bigint;
  _consumido bigint;
  _cupons int;
  _saldo int;
  _cancelados int := 0;
  _cupom public.sorteio_cupons;
BEGIN
  SELECT * INTO _part FROM public.sorteio_participantes
   WHERE id = _participante_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('resultado', 'IGNORADA', 'motivo', 'participante_nao_encontrado');
  END IF;

  SELECT coalesce(sum(valor_centavos), 0) INTO _total
    FROM public.sorteio_notas
   WHERE participante_id = _part.id
     AND status = 'VALIDA'
     AND cupons_processado_em IS NOT NULL;

  SELECT coalesce(sum(valor_base_centavos), 0) INTO _consumido
    FROM public.sorteio_cupons
   WHERE participante_id = _part.id
     AND status <> 'CANCELADO';

  WHILE _consumido > _total LOOP
    SELECT * INTO _cupom
      FROM public.sorteio_cupons
     WHERE participante_id = _part.id
       AND status = 'ATIVO'
     ORDER BY gerado_em DESC, numero DESC
     LIMIT 1
       FOR UPDATE;

    EXIT WHEN NOT FOUND;

    UPDATE public.sorteio_cupons
       SET status = 'CANCELADO',
           cancelado_em = COALESCE(cancelado_em, now())
     WHERE id = _cupom.id;

    INSERT INTO public.sorteio_auditoria
      (sorteio_id, participante_id, cliente_id, nota_id, cupom_id, evento, origem, usuario_id, detalhe)
    VALUES
      (_part.sorteio_id, _part.id, _part.cliente_id, _cupom.nota_id, _cupom.id,
       'cupom.cancelado', coalesce(_origem, 'rotina'), _usuario_id,
       jsonb_build_object(
         'motivo', 'sem_lastro',
         'numero', _cupom.numero,
         'valor_base_centavos', _cupom.valor_base_centavos,
         'total_notas_centavos', _total,
         'consumido_centavos', _consumido));

    _consumido := _consumido - _cupom.valor_base_centavos;
    _cancelados := _cancelados + 1;
  END LOOP;

  SELECT count(*) INTO _cupons
    FROM public.sorteio_cupons
   WHERE participante_id = _part.id
     AND status <> 'CANCELADO';

  _saldo := greatest(_total - _consumido, 0)::int;

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
         'cupons_cancelados_sem_lastro', _cancelados));
  END IF;

  RETURN jsonb_build_object(
    'resultado', 'OK',
    'alterado', _saldo IS DISTINCT FROM _part.saldo_centavos,
    'saldo_anterior_centavos', _part.saldo_centavos,
    'saldo_centavos', _saldo,
    'total_notas_centavos', _total,
    'consumido_centavos', _consumido,
    'cupons_considerados', _cupons,
    'cupons_cancelados_sem_lastro', _cancelados);
END;
$function$;

REVOKE ALL ON FUNCTION public.sorteio_recalcular_saldo_participante(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sorteio_recalcular_saldo_participante(uuid, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.sorteio_recalcular_saldo_participante(uuid, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sorteio_recalcular_saldo_participante(uuid, text, uuid) TO service_role;
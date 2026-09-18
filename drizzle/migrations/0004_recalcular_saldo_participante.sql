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

  SELECT coalesce(sum(valor_base_centavos), 0), count(*) INTO _consumido, _cupons
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
         'cupons_considerados', _cupons));
  END IF;

  RETURN jsonb_build_object(
    'resultado', 'OK',
    'alterado', _saldo IS DISTINCT FROM _part.saldo_centavos,
    'saldo_anterior_centavos', _part.saldo_centavos,
    'saldo_centavos', _saldo,
    'total_notas_centavos', _total,
    'consumido_centavos', _consumido,
    'cupons_considerados', _cupons);
END;
$function$;

REVOKE ALL ON FUNCTION public.sorteio_recalcular_saldo_participante(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sorteio_recalcular_saldo_participante(uuid, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.sorteio_recalcular_saldo_participante(uuid, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sorteio_recalcular_saldo_participante(uuid, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.sorteio_propagar_cancelamento_nota()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'CANCELADA' AND OLD.status IS DISTINCT FROM 'CANCELADA' THEN
    UPDATE public.sorteio_cupons
       SET status = 'CANCELADO',
           cancelado_em = COALESCE(cancelado_em, now())
     WHERE nota_id = NEW.id
       AND status <> 'CANCELADO';

    -- Saldo: recalculado pela unica regra do sistema (notas validas processadas
    -- menos cupons que continuam valendo). Nunca fica negativo.
    PERFORM public.sorteio_recalcular_saldo_participante(NEW.participante_id, 'cancelamento', NULL);
  END IF;
  RETURN NULL;
END;
$function$;
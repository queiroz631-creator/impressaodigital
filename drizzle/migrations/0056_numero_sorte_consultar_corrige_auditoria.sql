CREATE OR REPLACE FUNCTION public.numero_sorte_consultar(_campanha_id uuid, _cliente_id uuid, _codigo text, _ip_hash text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _camp public.numero_sorte_campanhas%ROWTYPE;
  _num public.numero_sorte_numeros%ROWTYPE;
  _prem public.numero_sorte_premios%ROWTYPE;
  _limite integer;
  _usadas integer;
  _recentes integer;
  _premiacao_id uuid;
BEGIN
  SELECT * INTO _camp FROM public.numero_sorte_campanhas WHERE id = _campanha_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('resultado','indisponivel'); END IF;
  IF _camp.situacao <> 'ativa' OR (_camp.inicio_em IS NOT NULL AND now() < _camp.inicio_em)
     OR (_camp.fim_em IS NOT NULL AND now() > _camp.fim_em) THEN
    RETURN jsonb_build_object('resultado','indisponivel');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ns_consulta_' || _campanha_id::text || _cliente_id::text));

  IF EXISTS (SELECT 1 FROM public.numero_sorte_premiacoes WHERE campanha_id = _campanha_id AND cliente_id = _cliente_id) THEN
    INSERT INTO public.numero_sorte_consultas (campanha_id, cliente_id, codigo, resultado, ip_hash)
    VALUES (_campanha_id, _cliente_id, left(_codigo, 20), 'bloqueada', _ip_hash);
    RETURN jsonb_build_object('resultado','ja_premiado');
  END IF;

  SELECT count(*) INTO _recentes FROM public.numero_sorte_consultas
   WHERE cliente_id = _cliente_id AND criado_em > now() - interval '1 minute';
  IF _recentes >= 5 THEN RETURN jsonb_build_object('resultado','limite_tempo'); END IF;
  SELECT count(*) INTO _recentes FROM public.numero_sorte_consultas
   WHERE ip_hash = _ip_hash AND criado_em > now() - interval '1 hour';
  IF _recentes >= 20 THEN RETURN jsonb_build_object('resultado','limite_tempo'); END IF;
  SELECT count(*) INTO _recentes FROM public.numero_sorte_consultas
   WHERE campanha_id = _campanha_id AND criado_em > now() - interval '1 minute';
  IF _recentes >= 120 THEN RETURN jsonb_build_object('resultado','limite_tempo'); END IF;

  _limite := coalesce(_camp.limite_consultas_cliente, 10);
  SELECT count(*) INTO _usadas FROM public.numero_sorte_consultas
   WHERE campanha_id = _campanha_id AND cliente_id = _cliente_id AND resultado IN ('nao_premiado','premiado','repetida','invalida');
  IF _usadas >= _limite THEN
    INSERT INTO public.numero_sorte_consultas (campanha_id, cliente_id, codigo, resultado, ip_hash)
    VALUES (_campanha_id, _cliente_id, left(_codigo, 20), 'limite', _ip_hash);
    RETURN jsonb_build_object('resultado','limite', 'restantes', 0);
  END IF;

  IF _codigo !~ '^[0-9]{6,20}$' OR left(_codigo, length(_codigo) - 5) <> _camp.numero::text THEN
    INSERT INTO public.numero_sorte_consultas (campanha_id, cliente_id, codigo, resultado, ip_hash)
    VALUES (_campanha_id, _cliente_id, left(_codigo, 20), 'invalida', _ip_hash);
    RETURN jsonb_build_object('resultado','invalido', 'restantes', _limite - _usadas - 1);
  END IF;

  IF EXISTS (SELECT 1 FROM public.numero_sorte_consultas WHERE campanha_id = _campanha_id AND cliente_id = _cliente_id AND codigo = _codigo) THEN
    INSERT INTO public.numero_sorte_consultas (campanha_id, cliente_id, codigo, resultado, ip_hash)
    VALUES (_campanha_id, _cliente_id, _codigo, 'repetida', _ip_hash);
    RETURN jsonb_build_object('resultado','nao_premiado', 'restantes', _limite - _usadas - 1);
  END IF;

  SELECT n.* INTO _num FROM public.numero_sorte_numeros n
   JOIN public.numero_sorte_premios p ON p.id = n.premio_id
   WHERE n.campanha_id = _campanha_id AND n.codigo = _codigo AND n.situacao = 'disponivel' AND p.situacao = 'ativo'
   FOR UPDATE OF n SKIP LOCKED;

  IF NOT FOUND THEN
    INSERT INTO public.numero_sorte_consultas (campanha_id, cliente_id, codigo, resultado, ip_hash)
    VALUES (_campanha_id, _cliente_id, _codigo, 'nao_premiado', _ip_hash);
    RETURN jsonb_build_object('resultado','nao_premiado', 'restantes', _limite - _usadas - 1);
  END IF;

  SELECT * INTO _prem FROM public.numero_sorte_premios WHERE id = _num.premio_id;
  UPDATE public.numero_sorte_numeros SET situacao = 'reservado' WHERE id = _num.id;
  INSERT INTO public.numero_sorte_premiacoes (campanha_id, cliente_id, numero_id, premio_id, prazo_em)
  VALUES (_campanha_id, _cliente_id, _num.id, _prem.id, now() + make_interval(days => _prem.prazo_retirada_dias))
  RETURNING id INTO _premiacao_id;
  INSERT INTO public.numero_sorte_consultas (campanha_id, cliente_id, codigo, resultado, numero_id, ip_hash)
  VALUES (_campanha_id, _cliente_id, _codigo, 'premiado', _num.id, _ip_hash);
  INSERT INTO public.numero_sorte_auditoria (campanha_id, evento, detalhe)
  VALUES (_campanha_id, 'premio_reservado', jsonb_build_object('premiacao_id', _premiacao_id, 'premio_id', _prem.id));
  RETURN jsonb_build_object('resultado','premiado');
END $$;
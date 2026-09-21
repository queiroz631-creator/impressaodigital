CREATE OR REPLACE FUNCTION public.sorteio_apuracao_resumo(_sorteio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sorteio record;
  v_cupons integer := 0;
  v_participantes integer := 0;
  v_unidades integer := 0;
  v_sorteadas integer := 0;
  v_premios jsonb;
  v_ganhadores jsonb;
  v_numeros jsonb;
BEGIN
  SELECT id, nome, numero_sorteio, status INTO v_sorteio
  FROM public.sorteios WHERE id = _sorteio_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('resultado', 'IGNORADA', 'motivo', 'sorteio_nao_encontrado');
  END IF;

  SELECT count(*), count(DISTINCT c.participante_id)
  INTO v_cupons, v_participantes
  FROM public.sorteio_cupons c
  JOIN public.sorteio_participantes p ON p.id = c.participante_id
  WHERE c.sorteio_id = _sorteio_id
    AND c.status <> 'CANCELADO'
    AND p.concorre_sorteio;

  SELECT coalesce(sum(p.quantidade), 0) INTO v_unidades
  FROM public.sorteio_premios p
  WHERE p.sorteio_id = _sorteio_id AND p.ativo;

  SELECT count(*) INTO v_sorteadas
  FROM public.sorteio_ganhadores g
  JOIN public.sorteio_premios p ON p.id = g.premio_id
  WHERE g.sorteio_id = _sorteio_id AND p.ativo;

  SELECT coalesce(jsonb_agg(item ORDER BY ordem, criado_em), '[]'::jsonb)
  INTO v_premios
  FROM (
    SELECT p.ordem, p.criado_em,
      jsonb_build_object(
        'id', p.id,
        'nome', p.nome,
        'descricao', p.descricao,
        'ordem', p.ordem,
        'quantidade', p.quantidade,
        'ativo', p.ativo,
        'sorteados', (SELECT count(*) FROM public.sorteio_ganhadores g WHERE g.sorteio_id = _sorteio_id AND g.premio_id = p.id),
        'disponivel', (SELECT count(*) FROM public.sorteio_ganhadores g WHERE g.sorteio_id = _sorteio_id AND g.premio_id = p.id) < p.quantidade
      ) AS item
    FROM public.sorteio_premios p
    WHERE p.sorteio_id = _sorteio_id
  ) t;

  SELECT coalesce(jsonb_agg(item ORDER BY ordem, criado_em, unidade), '[]'::jsonb)
  INTO v_ganhadores
  FROM (
    SELECT coalesce(pr.ordem, 999999) AS ordem,
      g.sorteado_em AS criado_em,
      coalesce(g.unidade, 1) AS unidade,
      jsonb_build_object(
        'id', g.id,
        'premio_id', g.premio_id,
        'premio_nome', pr.nome,
        'premio_quantidade', pr.quantidade,
        'unidade', g.unidade,
        'cupom_id', g.cupom_id,
        'numero_cupom', g.numero_cupom,
        'participante_id', g.participante_id,
        'participante_nome', cl.nome,
        'cliente_id', cl.id,
        'cpf_final4', CASE
          WHEN length(regexp_replace(coalesce(cl.cpf, ''), '[^0-9]', '', 'g')) > 0
          THEN right(regexp_replace(cl.cpf, '[^0-9]', '', 'g'), 4)
          ELSE NULL
        END,
        'telefone_final4', CASE
          WHEN length(regexp_replace(coalesce(cl.telefone, ''), '[^0-9]', '', 'g')) > 0
          THEN right(regexp_replace(cl.telefone, '[^0-9]', '', 'g'), 4)
          ELSE NULL
        END,
        'cupom_status', cu.status,
        'sorteado_em', g.sorteado_em,
        'usuario_id', g.usuario_id
      ) AS item
    FROM public.sorteio_ganhadores g
    LEFT JOIN public.sorteio_premios pr ON pr.id = g.premio_id
    LEFT JOIN public.sorteio_participantes pa ON pa.id = g.participante_id
    LEFT JOIN public.clientes cl ON cl.id = pa.cliente_id
    LEFT JOIN public.sorteio_cupons cu ON cu.id = g.cupom_id
    WHERE g.sorteio_id = _sorteio_id
  ) t;

  SELECT coalesce(jsonb_agg(numero), '[]'::jsonb)
  INTO v_numeros
  FROM (
    SELECT c.numero
    FROM public.sorteio_cupons c
    JOIN public.sorteio_participantes p ON p.id = c.participante_id
    WHERE c.sorteio_id = _sorteio_id
      AND c.status <> 'CANCELADO'
      AND p.concorre_sorteio
    ORDER BY random()
    LIMIT 60
  ) t;

  RETURN jsonb_build_object(
    'resultado', 'OK',
    'sorteio', jsonb_build_object(
      'id', v_sorteio.id,
      'nome', v_sorteio.nome,
      'numero_sorteio', v_sorteio.numero_sorteio,
      'status', v_sorteio.status
    ),
    'totais', jsonb_build_object(
      'participantes_concorrentes', v_participantes,
      'cupons_concorrentes', v_cupons,
      'premios_cadastrados', (SELECT count(*) FROM public.sorteio_premios p WHERE p.sorteio_id = _sorteio_id AND p.ativo),
      'unidades_total', v_unidades,
      'unidades_sorteadas', v_sorteadas,
      'unidades_disponiveis', greatest(v_unidades - v_sorteadas, 0)
    ),
    'premios', v_premios,
    'ganhadores', v_ganhadores,
    'numeros_amostra', v_numeros,
    'pode_sortear', v_sorteio.status = 'ENCERRADO'
      AND v_cupons > 0
      AND v_participantes > 0
      AND (v_unidades - v_sorteadas) > 0
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sorteio_realizar(_sorteio_id uuid, _usuario_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sorteio record;
  v_premio record;
  v_unidade integer;
  v_cupom record;
  v_cliente record;
  v_ganhador_id uuid;
  v_agora timestamptz;
  v_restantes integer;
  v_status text;
  v_ultimo boolean := false;
BEGIN
  SELECT id, nome, numero_sorteio, status INTO v_sorteio
  FROM public.sorteios
  WHERE id = _sorteio_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('resultado', 'IGNORADO', 'motivo', 'sorteio_nao_encontrado');
  END IF;

  IF v_sorteio.status <> 'ENCERRADO' THEN
    RETURN jsonb_build_object(
      'resultado', 'IGNORADO',
      'motivo', CASE WHEN v_sorteio.status = 'SORTEADO' THEN 'ja_sorteado' ELSE 'nao_encerrado' END,
      'status', v_sorteio.status
    );
  END IF;

  SELECT p.id, p.nome, p.descricao, p.quantidade, p.ordem INTO v_premio
  FROM public.sorteio_premios p
  WHERE p.sorteio_id = _sorteio_id
    AND p.ativo
    AND (SELECT count(*) FROM public.sorteio_ganhadores g WHERE g.sorteio_id = _sorteio_id AND g.premio_id = p.id) < p.quantidade
  ORDER BY p.ordem, p.criado_em
  LIMIT 1
  FOR UPDATE OF p;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('resultado', 'IGNORADO', 'motivo', 'sem_premio_disponivel', 'status', v_sorteio.status);
  END IF;

  SELECT u INTO v_unidade
  FROM generate_series(1, v_premio.quantidade) AS u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.sorteio_ganhadores g
    WHERE g.sorteio_id = _sorteio_id
      AND g.premio_id = v_premio.id
      AND g.unidade = u
  )
  ORDER BY u
  LIMIT 1;

  IF v_unidade IS NULL THEN
    RETURN jsonb_build_object('resultado', 'IGNORADO', 'motivo', 'unidade_ja_sorteada', 'premio_id', v_premio.id);
  END IF;

  SELECT c.id, c.numero, c.participante_id INTO v_cupom
  FROM public.sorteio_cupons c
  JOIN public.sorteio_participantes pa ON pa.id = c.participante_id
  WHERE c.sorteio_id = _sorteio_id
    AND c.status <> 'CANCELADO'
    AND pa.concorre_sorteio
    AND NOT EXISTS (
      SELECT 1 FROM public.sorteio_ganhadores g
      WHERE g.sorteio_id = _sorteio_id
        AND g.participante_id = c.participante_id
    )
  ORDER BY random()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('resultado', 'IGNORADO', 'motivo', 'sem_cupom_elegivel', 'premio_id', v_premio.id, 'unidade', v_unidade);
  END IF;

  SELECT cl.id, cl.nome, cl.cpf, cl.telefone INTO v_cliente
  FROM public.sorteio_participantes pa
  JOIN public.clientes cl ON cl.id = pa.cliente_id
  WHERE pa.id = v_cupom.participante_id;

  v_agora := now();

  INSERT INTO public.sorteio_ganhadores
    (sorteio_id, premio_id, participante_id, cupom_id, numero_cupom, unidade, usuario_id, sorteado_em)
  VALUES
    (_sorteio_id, v_premio.id, v_cupom.participante_id, v_cupom.id, v_cupom.numero, v_unidade, _usuario_id, v_agora)
  RETURNING id INTO v_ganhador_id;

  SELECT coalesce(sum(p.quantidade), 0)
    - (SELECT count(*) FROM public.sorteio_ganhadores g
       JOIN public.sorteio_premios pp ON pp.id = g.premio_id
       WHERE g.sorteio_id = _sorteio_id AND pp.ativo)
  INTO v_restantes
  FROM public.sorteio_premios p
  WHERE p.sorteio_id = _sorteio_id AND p.ativo;

  v_status := v_sorteio.status;
  IF v_restantes <= 0 THEN
    UPDATE public.sorteios
    SET status = 'SORTEADO', data_sorteio = coalesce(data_sorteio, v_agora)
    WHERE id = _sorteio_id AND status = 'ENCERRADO';
    v_status := 'SORTEADO';
    v_ultimo := true;
  END IF;

  INSERT INTO public.sorteio_auditoria
    (sorteio_id, participante_id, cliente_id, cupom_id, evento, origem, usuario_id, detalhe)
  VALUES (
    _sorteio_id, v_cupom.participante_id, v_cliente.id, v_cupom.id,
    'sorteio.realizado', 'painel', _usuario_id,
    jsonb_build_object(
      'ganhador_id', v_ganhador_id,
      'premio_id', v_premio.id,
      'premio_nome', v_premio.nome,
      'unidade', v_unidade,
      'premio_quantidade', v_premio.quantidade,
      'cupom_id', v_cupom.id,
      'numero_cupom', v_cupom.numero,
      'participante_id', v_cupom.participante_id,
      'cliente_id', v_cliente.id,
      'cliente_nome', v_cliente.nome,
      'sorteado_em', v_agora,
      'status_anterior', v_sorteio.status,
      'status_posterior', v_status,
      'ultimo', v_ultimo
    )
  );

  RETURN jsonb_build_object(
    'resultado', 'SORTEADO',
    'ganhador_id', v_ganhador_id,
    'sorteio_id', _sorteio_id,
    'premio_id', v_premio.id,
    'premio_nome', v_premio.nome,
    'premio_descricao', v_premio.descricao,
    'unidade', v_unidade,
    'premio_quantidade', v_premio.quantidade,
    'participante_id', v_cupom.participante_id,
    'participante_nome', v_cliente.nome,
    'cliente_id', v_cliente.id,
    'cpf_final4', CASE
      WHEN length(regexp_replace(coalesce(v_cliente.cpf, ''), '[^0-9]', '', 'g')) > 0
      THEN right(regexp_replace(v_cliente.cpf, '[^0-9]', '', 'g'), 4)
      ELSE NULL
    END,
    'telefone_final4', CASE
      WHEN length(regexp_replace(coalesce(v_cliente.telefone, ''), '[^0-9]', '', 'g')) > 0
      THEN right(regexp_replace(v_cliente.telefone, '[^0-9]', '', 'g'), 4)
      ELSE NULL
    END,
    'cupom_id', v_cupom.id,
    'numero_cupom', v_cupom.numero,
    'sorteado_em', v_agora,
    'status', v_status,
    'ultimo', v_ultimo,
    'unidades_restantes', greatest(v_restantes, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sorteio_apuracao_resumo(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sorteio_realizar(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sorteio_apuracao_resumo(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sorteio_realizar(uuid, uuid) TO service_role;
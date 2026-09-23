-- Rastreabilidade da origem do valor dos cupons.
-- Cada nota processada vira uma fonte de saldo; cada cupom passa a guardar quanto
-- de cada nota entrou na sua formação. O cancelamento deixa de escolher um cupom
-- arbitrário e passa a cancelar exatamente o cupom que perdeu lastro.

CREATE TABLE public.sorteio_saldo_fontes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sorteio_id uuid NOT NULL REFERENCES public.sorteios(id) ON DELETE RESTRICT,
  participante_id uuid NOT NULL REFERENCES public.sorteio_participantes(id) ON DELETE RESTRICT,
  nota_id uuid NOT NULL REFERENCES public.sorteio_notas(id) ON DELETE RESTRICT,
  valor_original_centavos integer NOT NULL CHECK (valor_original_centavos >= 0),
  valor_pendente_centavos integer NOT NULL DEFAULT 0 CHECK (valor_pendente_centavos >= 0),
  status text NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','ESGOTADO','CANCELADO')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sorteio_saldo_fontes_nota_unica UNIQUE (nota_id)
);

CREATE INDEX sorteio_saldo_fontes_participante_idx
  ON public.sorteio_saldo_fontes (participante_id, status, criado_em);
CREATE INDEX sorteio_saldo_fontes_sorteio_idx
  ON public.sorteio_saldo_fontes (sorteio_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sorteio_saldo_fontes TO authenticated;
GRANT ALL ON public.sorteio_saldo_fontes TO service_role;
ALTER TABLE public.sorteio_saldo_fontes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sorteio_saldo_fontes_acesso" ON public.sorteio_saldo_fontes
  FOR ALL TO authenticated
  USING (public.pode_sorteios())
  WITH CHECK (public.pode_sorteios());

CREATE TABLE public.sorteio_cupom_contribuicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sorteio_id uuid NOT NULL REFERENCES public.sorteios(id) ON DELETE RESTRICT,
  participante_id uuid NOT NULL REFERENCES public.sorteio_participantes(id) ON DELETE RESTRICT,
  cupom_id uuid NOT NULL REFERENCES public.sorteio_cupons(id) ON DELETE RESTRICT,
  nota_id uuid NOT NULL REFERENCES public.sorteio_notas(id) ON DELETE RESTRICT,
  valor_centavos integer NOT NULL CHECK (valor_centavos > 0),
  ordem integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sorteio_cupom_contribuicoes_cupom_nota_unica UNIQUE (cupom_id, nota_id)
);

CREATE INDEX sorteio_cupom_contribuicoes_cupom_idx
  ON public.sorteio_cupom_contribuicoes (cupom_id);
CREATE INDEX sorteio_cupom_contribuicoes_nota_idx
  ON public.sorteio_cupom_contribuicoes (nota_id);
CREATE INDEX sorteio_cupom_contribuicoes_participante_idx
  ON public.sorteio_cupom_contribuicoes (participante_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sorteio_cupom_contribuicoes TO authenticated;
GRANT ALL ON public.sorteio_cupom_contribuicoes TO service_role;
ALTER TABLE public.sorteio_cupom_contribuicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sorteio_cupom_contribuicoes_acesso" ON public.sorteio_cupom_contribuicoes
  FOR ALL TO authenticated
  USING (public.pode_sorteios())
  WITH CHECK (public.pode_sorteios());

-- Geração: cria a fonte da nota, consome o pool em ordem FIFO e grava a
-- contribuição de cada nota para cada cupom. Assinatura e retorno inalterados.
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
  _cupons int;
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
  _contribuicoes int := 0;
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

  -- Fonte rastreável: a nota entra no pool com o seu valor integral.
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
    -- Nunca gera mais do que o saldo oficial permite; registra a divergência.
    INSERT INTO public.sorteio_auditoria
      (sorteio_id, participante_id, cliente_id, nota_id, evento, origem, usuario_id, detalhe)
    VALUES
      (_nota.sorteio_id, _part.id, _part.cliente_id, _nota.id, 'saldo.fontes_divergentes',
       coalesce(_origem, 'rotina'), _usuario_id,
       jsonb_build_object('pool_centavos', _pool, 'esperado_centavos', _esperado,
                          'saldo_centavos', _part.saldo_centavos,
                          'valor_nota_centavos', _nota.valor_centavos));
    IF _pool > _esperado THEN
      _pool := _esperado;
    END IF;
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
          (_nota.sorteio_id, _nota.participante_id, _nota.id, _num,
           _sorteio.valor_por_cupom_centavos, 'ATIVO')
        RETURNING id INTO _cupom_id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF _tent >= 10 THEN
          RAISE EXCEPTION 'Nao foi possivel gerar numero de cupom unico para o sorteio %', _sorteio.id;
        END IF;
      END;
    END LOOP;

    -- Consome o pool em ordem FIFO e grava de onde veio cada centavo do cupom.
    _resto := _sorteio.valor_por_cupom_centavos;
    _ordem := 0;
    FOR _f IN
      SELECT * FROM public.sorteio_saldo_fontes
       WHERE participante_id = _part.id
         AND status = 'PENDENTE'
         AND valor_pendente_centavos > 0
       ORDER BY criado_em ASC, id ASC
       FOR UPDATE
    LOOP
      EXIT WHEN _resto <= 0;
      _usa := least(_resto, _f.valor_pendente_centavos);
      INSERT INTO public.sorteio_cupom_contribuicoes
        (sorteio_id, participante_id, cupom_id, nota_id, valor_centavos, ordem)
      VALUES
        (_nota.sorteio_id, _part.id, _cupom_id, _f.nota_id, _usa, _ordem);
      _ordem := _ordem + 1;
      _contribuicoes := _contribuicoes + 1;
      UPDATE public.sorteio_saldo_fontes
         SET valor_pendente_centavos = (valor_pendente_centavos - _usa)::int,
             status = CASE WHEN valor_pendente_centavos - _usa = 0
                           THEN 'ESGOTADO' ELSE 'PENDENTE' END,
             atualizado_em = now()
       WHERE id = _f.id;
      _resto := _resto - _usa;
    END LOOP;

    IF _resto > 0 THEN
      RAISE EXCEPTION 'Fontes de saldo insuficientes para o cupom % da nota %', _num, _nota.id;
    END IF;
  END LOOP;

  SELECT coalesce(sum(valor_pendente_centavos), 0) INTO _saldo
    FROM public.sorteio_saldo_fontes
   WHERE participante_id = _part.id AND status = 'PENDENTE';

  UPDATE public.sorteio_notas
     SET cupons_gerados = _cupons,
         saldo_gerado_centavos = _saldo::int,
         cupons_processado_em = now()
   WHERE id = _nota.id
     AND cupons_processado_em IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota % processada simultaneamente', _nota.id;
  END IF;

  UPDATE public.sorteio_participantes
     SET saldo_centavos = _saldo::int
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
       'contribuicoes', _contribuicoes,
       'saldo_centavos', _saldo,
       'valor_por_cupom_centavos', _sorteio.valor_por_cupom_centavos));

  RETURN jsonb_build_object('resultado', 'PROCESSADA', 'cupons', _cupons,
    'contribuicoes', _contribuicoes, 'saldo_centavos', _saldo);
END;
$function$;

-- Recálculo: marca a fonte da nota cancelada, cancela exatamente os cupons que
-- perderam lastro, recompõe o pool das fontes e só então grava o saldo.
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
     ORDER BY criado_em DESC, id DESC
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
     ORDER BY criado_em DESC, id DESC
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

  RETURN jsonb_build_object(
    'resultado', 'OK',
    'alterado', _saldo IS DISTINCT FROM _part.saldo_centavos,
    'saldo_anterior_centavos', _part.saldo_centavos,
    'saldo_centavos', _saldo,
    'total_notas_centavos', _total,
    'consumido_centavos', _consumido,
    'cupons_considerados', _cupons,
    'cupons_cancelados_por_lastro', _cancelados,
    'cupons_cancelados_sem_lastro', _cancelados,
    'deficit_centavos', greatest(_consumido - _total, 0));
END;
$function$;

-- Cancelamento de nota: só decide sozinho pela nota de origem quando o cupom não
-- tem composição; nos demais casos o lastro rastreável é quem decide.
CREATE OR REPLACE FUNCTION public.sorteio_propagar_cancelamento_nota()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'CANCELADA' AND OLD.status IS DISTINCT FROM 'CANCELADA' THEN
    UPDATE public.sorteio_cupons c
       SET status = 'CANCELADO',
           cancelado_em = COALESCE(c.cancelado_em, now())
     WHERE c.nota_id = NEW.id
       AND c.status <> 'CANCELADO'
       AND NOT EXISTS (SELECT 1 FROM public.sorteio_cupom_contribuicoes x
                        WHERE x.cupom_id = c.id);

    PERFORM public.sorteio_recalcular_saldo_participante(NEW.participante_id, 'cancelamento', NULL);
  END IF;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.sorteio_gerar_cupons_da_nota(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sorteio_gerar_cupons_da_nota(uuid, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.sorteio_gerar_cupons_da_nota(uuid, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sorteio_gerar_cupons_da_nota(uuid, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.sorteio_recalcular_saldo_participante(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sorteio_recalcular_saldo_participante(uuid, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.sorteio_recalcular_saldo_participante(uuid, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sorteio_recalcular_saldo_participante(uuid, text, uuid) TO service_role;

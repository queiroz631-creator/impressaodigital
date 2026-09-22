-- Fechamento do sorteio (ATIVO -> ENCERRADO).
-- Aditivo: nenhuma estrutura existente e alterada. Saldo, fontes, contribuicoes,
-- cupons, validacao e cancelamento permanecem exatamente como estao.

ALTER TABLE public.sorteios
  ADD COLUMN IF NOT EXISTS encerrado_em timestamptz,
  ADD COLUMN IF NOT EXISTS encerrado_por uuid,
  ADD COLUMN IF NOT EXISTS conferencia_encerramento jsonb;

-- ------------------------------------------------------------------ conferencia
-- Somente leitura. Nao corrige, nao recalcula, nao gera cupom.
CREATE OR REPLACE FUNCTION public.sorteio_conferencia(_sorteio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _s public.sorteios;
  _pend jsonb := '[]'::jsonb;
  _inc jsonb := '[]'::jsonb;
  _tot jsonb;
  _n bigint;
  _d jsonb;
BEGIN
  SELECT * INTO _s FROM public.sorteios WHERE id = _sorteio_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('resultado', 'IGNORADA', 'motivo', 'sorteio_nao_encontrado',
                              'aprovada', false);
  END IF;

  SELECT jsonb_build_object(
    'participantes', (SELECT count(*) FROM sorteio_participantes WHERE sorteio_id = _s.id),
    'participantes_concorrentes', (SELECT count(*) FROM sorteio_participantes
                                    WHERE sorteio_id = _s.id AND concorre_sorteio),
    'notas_validas', (SELECT count(*) FROM sorteio_notas
                       WHERE sorteio_id = _s.id AND status = 'VALIDA'),
    'notas_canceladas', (SELECT count(*) FROM sorteio_notas
                          WHERE sorteio_id = _s.id AND status = 'CANCELADA'),
    'notas_pendentes', (SELECT count(*) FROM sorteio_notas
                         WHERE sorteio_id = _s.id AND status = 'PENDENTE'),
    'notas_invalidas', (SELECT count(*) FROM sorteio_notas
                         WHERE sorteio_id = _s.id AND status = 'INVALIDA'),
    'valor_notas_validas_centavos', (SELECT coalesce(sum(valor_centavos), 0) FROM sorteio_notas
                                      WHERE sorteio_id = _s.id AND status = 'VALIDA'),
    'cupons_ativos', (SELECT count(*) FROM sorteio_cupons
                       WHERE sorteio_id = _s.id AND status = 'ATIVO'),
    'cupons_cancelados', (SELECT count(*) FROM sorteio_cupons
                           WHERE sorteio_id = _s.id AND status = 'CANCELADO'),
    'cupons_utilizados', (SELECT count(*) FROM sorteio_cupons
                           WHERE sorteio_id = _s.id AND status = 'UTILIZADO'),
    'saldo_acumulado_centavos', (SELECT coalesce(sum(saldo_centavos), 0)
                                   FROM sorteio_participantes WHERE sorteio_id = _s.id),
    'fontes_pendentes', (SELECT count(*) FROM sorteio_saldo_fontes
                          WHERE sorteio_id = _s.id AND status = 'PENDENTE'),
    'fontes_pendentes_centavos', (SELECT coalesce(sum(valor_pendente_centavos), 0)
                                    FROM sorteio_saldo_fontes
                                   WHERE sorteio_id = _s.id AND status = 'PENDENTE'),
    'contribuicoes', (SELECT count(*) FROM sorteio_cupom_contribuicoes
                       WHERE sorteio_id = _s.id),
    'contribuicoes_centavos', (SELECT coalesce(sum(valor_centavos), 0)
                                 FROM sorteio_cupom_contribuicoes WHERE sorteio_id = _s.id)
  ) INTO _tot;

  -- ------------------------------------------------------------- pendencias
  SELECT count(*) INTO _n FROM sorteio_notas
   WHERE sorteio_id = _s.id AND status = 'PENDENTE';
  IF _n > 0 THEN
    SELECT jsonb_agg(jsonb_build_object('nota_id', id, 'numero', numero,
                                        'valor_centavos', valor_centavos))
      INTO _d FROM (SELECT id, numero, valor_centavos FROM sorteio_notas
                     WHERE sorteio_id = _s.id AND status = 'PENDENTE'
                     ORDER BY cadastrado_em LIMIT 20) x;
    _pend := _pend || jsonb_build_array(jsonb_build_object(
      'codigo', 'notas_pendentes', 'quantidade', _n,
      'mensagem', _n || ' nota(s) ainda com situacao PENDENTE: a validacao pode mudar a quantidade de cupons',
      'itens', coalesce(_d, '[]'::jsonb)));
  END IF;

  SELECT count(*) INTO _n FROM sorteio_notas
   WHERE sorteio_id = _s.id AND status = 'VALIDA' AND cupons_processado_em IS NULL;
  IF _n > 0 THEN
    SELECT jsonb_agg(jsonb_build_object('nota_id', id, 'numero', numero,
                                        'valor_centavos', valor_centavos))
      INTO _d FROM (SELECT id, numero, valor_centavos FROM sorteio_notas
                     WHERE sorteio_id = _s.id AND status = 'VALIDA'
                       AND cupons_processado_em IS NULL
                     ORDER BY cadastrado_em LIMIT 20) x;
    _pend := _pend || jsonb_build_array(jsonb_build_object(
      'codigo', 'notas_validas_sem_processamento', 'quantidade', _n,
      'mensagem', _n || ' nota(s) valida(s) ainda nao geraram cupons',
      'itens', coalesce(_d, '[]'::jsonb)));
  END IF;

  IF coalesce(_s.valor_por_cupom_centavos, 0) <= 0 THEN
    _pend := _pend || jsonb_build_array(jsonb_build_object(
      'codigo', 'valor_por_cupom_invalido', 'quantidade', 1,
      'mensagem', 'O valor por cupom deste sorteio esta zerado',
      'itens', '[]'::jsonb));
  END IF;

  -- --------------------------------------------------------- inconsistencias
  -- saldo gravado x soma das fontes pendentes
  SELECT count(*), jsonb_agg(jsonb_build_object(
           'participante_id', t.id, 'saldo_centavos', t.saldo,
           'fontes_centavos', t.fontes, 'diferenca_centavos', t.saldo - t.fontes))
    INTO _n, _d
    FROM (SELECT p.id, p.saldo_centavos AS saldo,
                 coalesce((SELECT sum(f.valor_pendente_centavos) FROM sorteio_saldo_fontes f
                            WHERE f.participante_id = p.id AND f.status = 'PENDENTE'), 0) AS fontes
            FROM sorteio_participantes p WHERE p.sorteio_id = _s.id) t
   WHERE t.saldo <> t.fontes;
  IF coalesce(_n, 0) > 0 THEN
    _inc := _inc || jsonb_build_array(jsonb_build_object(
      'codigo', 'saldo_diferente_das_fontes', 'quantidade', _n,
      'mensagem', _n || ' participante(s) com saldo diferente da soma das fontes pendentes',
      'itens', coalesce(_d, '[]'::jsonb)));
  END IF;

  -- saldo gravado x calculo oficial (notas validas processadas - cupons que valem)
  SELECT count(*), jsonb_agg(jsonb_build_object(
           'participante_id', t.id, 'saldo_centavos', t.saldo,
           'calculado_centavos', t.calc, 'diferenca_centavos', t.saldo - t.calc))
    INTO _n, _d
    FROM (SELECT p.id, p.saldo_centavos AS saldo,
                 greatest(
                   coalesce((SELECT sum(n.valor_centavos) FROM sorteio_notas n
                              WHERE n.participante_id = p.id AND n.status = 'VALIDA'
                                AND n.cupons_processado_em IS NOT NULL), 0)
                   - coalesce((SELECT sum(c.valor_base_centavos) FROM sorteio_cupons c
                                WHERE c.participante_id = p.id AND c.status <> 'CANCELADO'), 0),
                 0) AS calc
            FROM sorteio_participantes p WHERE p.sorteio_id = _s.id) t
   WHERE t.saldo <> t.calc;
  IF coalesce(_n, 0) > 0 THEN
    _inc := _inc || jsonb_build_array(jsonb_build_object(
      'codigo', 'saldo_diferente_do_calculo', 'quantidade', _n,
      'mensagem', _n || ' participante(s) com saldo diferente do calculo das notas e cupons',
      'itens', coalesce(_d, '[]'::jsonb)));
  END IF;

  -- soma das contribuicoes x valor_base_centavos (cupons nao cancelados)
  SELECT count(*), jsonb_agg(jsonb_build_object(
           'cupom_id', t.id, 'numero', t.numero,
           'valor_base_centavos', t.base, 'contribuicoes_centavos', t.soma))
    INTO _n, _d
    FROM (SELECT c.id, c.numero, c.valor_base_centavos AS base,
                 coalesce((SELECT sum(x.valor_centavos) FROM sorteio_cupom_contribuicoes x
                            WHERE x.cupom_id = c.id), 0) AS soma
            FROM sorteio_cupons c
           WHERE c.sorteio_id = _s.id AND c.status <> 'CANCELADO') t
   WHERE t.soma <> t.base;
  IF coalesce(_n, 0) > 0 THEN
    _inc := _inc || jsonb_build_array(jsonb_build_object(
      'codigo', 'composicao_diferente_do_cupom', 'quantidade', _n,
      'mensagem', _n || ' cupom(ns) com composicao diferente do proprio valor',
      'itens', coalesce(_d, '[]'::jsonb)));
  END IF;

  -- cupom nao cancelado sem composicao (cancelado historico e permitido)
  SELECT count(*), jsonb_agg(jsonb_build_object('cupom_id', id, 'numero', numero,
                                                'status', status))
    INTO _n, _d
    FROM sorteio_cupons c
   WHERE c.sorteio_id = _s.id AND c.status <> 'CANCELADO'
     AND NOT EXISTS (SELECT 1 FROM sorteio_cupom_contribuicoes x WHERE x.cupom_id = c.id);
  IF coalesce(_n, 0) > 0 THEN
    _inc := _inc || jsonb_build_array(jsonb_build_object(
      'codigo', 'cupom_sem_composicao', 'quantidade', _n,
      'mensagem', _n || ' cupom(ns) nao cancelado(s) sem nenhuma composicao registrada',
      'itens', coalesce(_d, '[]'::jsonb)));
  END IF;

  -- cupom ativo sem lastro em notas ainda validas
  SELECT count(*), jsonb_agg(jsonb_build_object('cupom_id', t.id, 'numero', t.numero,
           'valor_base_centavos', t.base, 'lastro_centavos', t.lastro))
    INTO _n, _d
    FROM (SELECT c.id, c.numero, c.valor_base_centavos AS base,
                 coalesce((SELECT sum(x.valor_centavos)
                             FROM sorteio_cupom_contribuicoes x
                             JOIN sorteio_notas n ON n.id = x.nota_id
                            WHERE x.cupom_id = c.id AND n.status = 'VALIDA'
                              AND n.cupons_processado_em IS NOT NULL), 0) AS lastro
            FROM sorteio_cupons c
           WHERE c.sorteio_id = _s.id AND c.status = 'ATIVO') t
   WHERE t.lastro < t.base;
  IF coalesce(_n, 0) > 0 THEN
    _inc := _inc || jsonb_build_array(jsonb_build_object(
      'codigo', 'cupom_ativo_sem_lastro', 'quantidade', _n,
      'mensagem', _n || ' cupom(ns) ativo(s) sem lastro em notas ainda validas',
      'itens', coalesce(_d, '[]'::jsonb)));
  END IF;

  -- contribuicao invalida: nota de outro participante/sorteio ou nota nao valida
  SELECT count(*), jsonb_agg(jsonb_build_object('contribuicao_id', x.id,
           'cupom_id', x.cupom_id, 'nota_id', x.nota_id, 'motivo', x.motivo))
    INTO _n, _d
    FROM (SELECT c.id, c.cupom_id, c.nota_id,
                 CASE WHEN n.id IS NULL THEN 'nota_inexistente'
                      WHEN n.participante_id <> c.participante_id THEN 'nota_de_outro_participante'
                      WHEN n.sorteio_id <> c.sorteio_id THEN 'nota_de_outro_sorteio'
                      WHEN u.participante_id <> c.participante_id THEN 'cupom_de_outro_participante'
                      ELSE 'nota_nao_valida' END AS motivo
            FROM sorteio_cupom_contribuicoes c
            JOIN sorteio_cupons u ON u.id = c.cupom_id
            LEFT JOIN sorteio_notas n ON n.id = c.nota_id
           WHERE c.sorteio_id = _s.id
             AND u.status <> 'CANCELADO'
             AND (n.id IS NULL
                  OR n.participante_id <> c.participante_id
                  OR n.sorteio_id <> c.sorteio_id
                  OR u.participante_id <> c.participante_id
                  OR n.status <> 'VALIDA'
                  OR n.cupons_processado_em IS NULL)) x;
  IF coalesce(_n, 0) > 0 THEN
    _inc := _inc || jsonb_build_array(jsonb_build_object(
      'codigo', 'contribuicao_invalida', 'quantidade', _n,
      'mensagem', _n || ' contribuicao(oes) apontando para nota ou participante invalido',
      'itens', coalesce(_d, '[]'::jsonb)));
  END IF;

  -- numero de cupom repetido no sorteio
  SELECT count(*), jsonb_agg(jsonb_build_object('numero', t.numero, 'quantidade', t.q))
    INTO _n, _d
    FROM (SELECT numero, count(*) q FROM sorteio_cupons
           WHERE sorteio_id = _s.id GROUP BY numero HAVING count(*) > 1) t;
  IF coalesce(_n, 0) > 0 THEN
    _inc := _inc || jsonb_build_array(jsonb_build_object(
      'codigo', 'numero_de_cupom_duplicado', 'quantidade', _n,
      'mensagem', _n || ' numero(s) de cupom repetido(s) neste sorteio',
      'itens', coalesce(_d, '[]'::jsonb)));
  END IF;

  -- fontes com valor pendente indevido
  SELECT count(*), jsonb_agg(jsonb_build_object('fonte_id', id, 'nota_id', nota_id,
           'status', status, 'valor_pendente_centavos', valor_pendente_centavos,
           'valor_original_centavos', valor_original_centavos))
    INTO _n, _d
    FROM sorteio_saldo_fontes
   WHERE sorteio_id = _s.id
     AND (   (status IN ('CANCELADO', 'ESGOTADO') AND valor_pendente_centavos <> 0)
          OR (status = 'PENDENTE' AND valor_pendente_centavos = 0)
          OR valor_pendente_centavos > valor_original_centavos);
  IF coalesce(_n, 0) > 0 THEN
    _inc := _inc || jsonb_build_array(jsonb_build_object(
      'codigo', 'fonte_com_valor_indevido', 'quantidade', _n,
      'mensagem', _n || ' fonte(s) de saldo com valor pendente incompativel com a situacao',
      'itens', coalesce(_d, '[]'::jsonb)));
  END IF;

  -- nota valida processada sem fonte
  SELECT count(*), jsonb_agg(jsonb_build_object('nota_id', id, 'numero', numero))
    INTO _n, _d
    FROM sorteio_notas n
   WHERE n.sorteio_id = _s.id AND n.status = 'VALIDA'
     AND n.cupons_processado_em IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM sorteio_saldo_fontes f WHERE f.nota_id = n.id);
  IF coalesce(_n, 0) > 0 THEN
    _inc := _inc || jsonb_build_array(jsonb_build_object(
      'codigo', 'nota_processada_sem_fonte', 'quantidade', _n,
      'mensagem', _n || ' nota(s) processada(s) sem fonte de saldo correspondente',
      'itens', coalesce(_d, '[]'::jsonb)));
  END IF;

  RETURN jsonb_build_object(
    'resultado', 'OK',
    'conferido_em', now(),
    'sorteio', jsonb_build_object('id', _s.id, 'numero_sorteio', _s.numero_sorteio,
      'nome', _s.nome, 'status', _s.status, 'data_inicio', _s.data_inicio,
      'data_fim', _s.data_fim, 'valor_por_cupom_centavos', _s.valor_por_cupom_centavos,
      'quantidade_maxima_cupons', _s.quantidade_maxima_cupons),
    'totais', _tot,
    'pendencias', _pend,
    'inconsistencias', _inc,
    'aprovada', (jsonb_array_length(_pend) = 0 AND jsonb_array_length(_inc) = 0),
    'pode_encerrar', (_s.status = 'ATIVO'
                      AND jsonb_array_length(_pend) = 0
                      AND jsonb_array_length(_inc) = 0));
END;
$$;

REVOKE ALL ON FUNCTION public.sorteio_conferencia(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sorteio_conferencia(uuid) TO authenticated, service_role;

-- ------------------------------------------------------------------ encerrar
-- Uma unica transacao: LOCK -> conferencia -> validacao -> UPDATE -> retrato -> auditoria.
CREATE OR REPLACE FUNCTION public.sorteio_encerrar(_sorteio_id uuid, _usuario_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _s public.sorteios;
  _conf jsonb;
  _tot jsonb;
BEGIN
  SELECT * INTO _s FROM public.sorteios WHERE id = _sorteio_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('resultado', 'IGNORADO', 'motivo', 'sorteio_nao_encontrado');
  END IF;

  IF _s.status = 'ENCERRADO' THEN
    RETURN jsonb_build_object('resultado', 'IGNORADO', 'motivo', 'ja_encerrado',
      'encerrado_em', _s.encerrado_em, 'encerrado_por', _s.encerrado_por,
      'conferencia', _s.conferencia_encerramento);
  END IF;

  IF _s.status <> 'ATIVO' THEN
    RAISE EXCEPTION 'Somente sorteios ATIVOS podem ser encerrados (situacao atual: %)', _s.status;
  END IF;

  -- Conferencia refeita aqui dentro: nada do que vem da tela e considerado.
  _conf := public.sorteio_conferencia(_sorteio_id);

  IF (_conf ->> 'aprovada') <> 'true' THEN
    RAISE EXCEPTION 'CONFERENCIA_REPROVADA: %', _conf::text;
  END IF;

  _tot := _conf -> 'totais';

  UPDATE public.sorteios
     SET status = 'ENCERRADO',
         encerrado_em = now(),
         encerrado_por = _usuario_id,
         conferencia_encerramento = _conf
   WHERE id = _sorteio_id
     AND status = 'ATIVO';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sorteio % alterado simultaneamente; encerramento desfeito', _sorteio_id;
  END IF;

  INSERT INTO public.sorteio_auditoria
    (sorteio_id, evento, origem, usuario_id, detalhe)
  VALUES
    (_sorteio_id, 'sorteio.encerrado', 'painel', _usuario_id,
     jsonb_build_object(
       'de', _s.status,
       'para', 'ENCERRADO',
       'encerrado_em', now(),
       'participantes', _tot -> 'participantes',
       'participantes_concorrentes', _tot -> 'participantes_concorrentes',
       'notas_validas', _tot -> 'notas_validas',
       'notas_canceladas', _tot -> 'notas_canceladas',
       'notas_pendentes', _tot -> 'notas_pendentes',
       'cupons_ativos', _tot -> 'cupons_ativos',
       'cupons_cancelados', _tot -> 'cupons_cancelados',
       'cupons_utilizados', _tot -> 'cupons_utilizados',
       'saldo_acumulado_centavos', _tot -> 'saldo_acumulado_centavos',
       'fontes_pendentes', _tot -> 'fontes_pendentes',
       'fontes_pendentes_centavos', _tot -> 'fontes_pendentes_centavos',
       'contribuicoes', _tot -> 'contribuicoes',
       'conferencia', _conf));

  RETURN jsonb_build_object('resultado', 'ENCERRADO', 'sorteio_id', _sorteio_id,
    'encerrado_em', now(), 'encerrado_por', _usuario_id, 'conferencia', _conf);
END;
$$;

REVOKE ALL ON FUNCTION public.sorteio_encerrar(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sorteio_encerrar(uuid, uuid) TO service_role;

-- --------------------------------------------------------- congelamento da base
CREATE OR REPLACE FUNCTION public.sorteio_bloquear_base_encerrada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _st text;
BEGIN
  SELECT status INTO _st FROM public.sorteios WHERE id = NEW.sorteio_id;

  IF _st IN ('ENCERRADO', 'SORTEADO', 'CANCELADO') THEN
    RAISE EXCEPTION
      'SORTEIO_CONGELADO: o sorteio % esta % e sua base nao pode mais ser alterada (tabela %)',
      NEW.sorteio_id, _st, TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sorteio_notas_base_congelada ON public.sorteio_notas;
CREATE TRIGGER sorteio_notas_base_congelada
  BEFORE INSERT OR UPDATE ON public.sorteio_notas
  FOR EACH ROW EXECUTE FUNCTION public.sorteio_bloquear_base_encerrada();

DROP TRIGGER IF EXISTS sorteio_participantes_base_congelada ON public.sorteio_participantes;
CREATE TRIGGER sorteio_participantes_base_congelada
  BEFORE INSERT OR UPDATE ON public.sorteio_participantes
  FOR EACH ROW EXECUTE FUNCTION public.sorteio_bloquear_base_encerrada();

DROP TRIGGER IF EXISTS sorteio_cupons_base_congelada ON public.sorteio_cupons;
CREATE TRIGGER sorteio_cupons_base_congelada
  BEFORE INSERT OR UPDATE ON public.sorteio_cupons
  FOR EACH ROW EXECUTE FUNCTION public.sorteio_bloquear_base_encerrada();

DROP TRIGGER IF EXISTS sorteio_saldo_fontes_base_congelada ON public.sorteio_saldo_fontes;
CREATE TRIGGER sorteio_saldo_fontes_base_congelada
  BEFORE INSERT OR UPDATE ON public.sorteio_saldo_fontes
  FOR EACH ROW EXECUTE FUNCTION public.sorteio_bloquear_base_encerrada();

DROP TRIGGER IF EXISTS sorteio_cupom_contribuicoes_base_congelada ON public.sorteio_cupom_contribuicoes;
CREATE TRIGGER sorteio_cupom_contribuicoes_base_congelada
  BEFORE INSERT OR UPDATE ON public.sorteio_cupom_contribuicoes
  FOR EACH ROW EXECUTE FUNCTION public.sorteio_bloquear_base_encerrada();

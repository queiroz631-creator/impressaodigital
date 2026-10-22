CREATE INDEX IF NOT EXISTS ns_consultas_camp_data_idx ON public.numero_sorte_consultas (campanha_id, criado_em);
CREATE INDEX IF NOT EXISTS ns_consultas_camp_cli_idx ON public.numero_sorte_consultas (campanha_id, cliente_id);
CREATE INDEX IF NOT EXISTS ns_premiacoes_camp_sit_idx ON public.numero_sorte_premiacoes (campanha_id, situacao, reservado_em);
CREATE INDEX IF NOT EXISTS ns_retiradas_entregue_idx ON public.numero_sorte_retiradas (entregue_em);
CREATE INDEX IF NOT EXISTS ns_participacoes_camp_data_idx ON public.numero_sorte_participacoes (campanha_id, criado_em);

CREATE OR REPLACE FUNCTION public.numero_sorte_mascarar_cpf(_cpf text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN length(regexp_replace(coalesce(_cpf,''),'\D','','g')) = 11
    THEN '***.' || substr(regexp_replace(_cpf,'\D','','g'),4,3) || '.' || substr(regexp_replace(_cpf,'\D','','g'),7,3) || '-**'
    ELSE NULL END
$$;
CREATE OR REPLACE FUNCTION public.numero_sorte_mascarar_telefone(_tel text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN length(regexp_replace(coalesce(_tel,''),'\D','','g')) >= 4
    THEN '(**) *****-' || right(regexp_replace(_tel,'\D','','g'),4) ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION public.numero_sorte_dashboard(_campanha uuid DEFAULT NULL, _situacao text DEFAULT NULL, _de timestamptz DEFAULT NULL, _ate timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT (public.tem_permissao(auth.uid(), 'numero_sorte.estatisticas.visualizar') OR public.tem_permissao(auth.uid(), 'numero_sorte.relatorios.visualizar')) THEN
    RAISE EXCEPTION 'SEM_PERMISSAO' USING ERRCODE = '42501';
  END IF;
  WITH camps AS (
    SELECT * FROM numero_sorte_campanhas c WHERE (_campanha IS NULL OR c.id = _campanha) AND (_situacao IS NULL OR c.situacao = _situacao)
  ), cons AS (
    SELECT q.* FROM numero_sorte_consultas q JOIN camps c ON c.id = q.campanha_id
    WHERE (_de IS NULL OR q.criado_em >= _de) AND (_ate IS NULL OR q.criado_em < _ate)
  ), parts AS (
    SELECT p.* FROM numero_sorte_participacoes p JOIN camps c ON c.id = p.campanha_id
    WHERE (_de IS NULL OR p.criado_em >= _de) AND (_ate IS NULL OR p.criado_em < _ate)
  ), prem AS (
    SELECT pr.* FROM numero_sorte_premiacoes pr JOIN camps c ON c.id = pr.campanha_id
    WHERE (_de IS NULL OR pr.reservado_em >= _de) AND (_ate IS NULL OR pr.reservado_em < _ate)
  ), ret AS (
    SELECT rt.* FROM numero_sorte_retiradas rt JOIN numero_sorte_premiacoes pr ON pr.id = rt.premiacao_id JOIN camps c ON c.id = pr.campanha_id
    WHERE (_de IS NULL OR rt.entregue_em >= _de) AND (_ate IS NULL OR rt.entregue_em < _ate)
  ), nums AS (
    SELECT n.situacao FROM numero_sorte_numeros n JOIN camps c ON c.id = n.campanha_id
  )
  SELECT jsonb_build_object(
    'cards', jsonb_build_object(
      'campanhas', (SELECT count(*) FROM camps),
      'campanhas_ativas', (SELECT count(*) FROM camps WHERE situacao = 'ativa'),
      'clientes_cadastrados', (SELECT count(DISTINCT cliente_id) FROM parts),
      'clientes_participantes', (SELECT count(DISTINCT cliente_id) FROM cons WHERE cliente_id IS NOT NULL),
      'consultas', (SELECT count(*) FROM cons),
      'numeros_distintos', (SELECT count(DISTINCT (campanha_id, codigo)) FROM cons WHERE resultado IN ('nao_premiado','premiado','repetida')),
      'nao_premiados', (SELECT count(*) FROM cons WHERE resultado = 'nao_premiado'),
      'premiados', (SELECT count(*) FROM prem),
      'premios_cadastrados', (SELECT count(*) FROM numero_sorte_premios p JOIN camps c ON c.id = p.campanha_id),
      'unidades_disponiveis', (SELECT count(*) FROM nums WHERE situacao = 'disponivel'),
      'aguardando', (SELECT count(*) FROM prem WHERE situacao = 'reservado'),
      'entregues', (SELECT count(*) FROM ret),
      'vencidos', (SELECT count(*) FROM prem WHERE situacao = 'vencido'),
      'cancelados', (SELECT count(*) FROM prem WHERE situacao = 'cancelado')
    ),
    'por_dia', coalesce((SELECT jsonb_agg(x ORDER BY x.dia) FROM (
        SELECT to_char(timezone('America/Sao_Paulo', criado_em)::date, 'YYYY-MM-DD') dia, count(*) consultas, count(DISTINCT cliente_id) clientes
        FROM cons GROUP BY 1) x), '[]'::jsonb),
    'por_hora', coalesce((SELECT jsonb_agg(x ORDER BY x.hora) FROM (
        SELECT extract(hour FROM timezone('America/Sao_Paulo', criado_em))::int hora, count(*) consultas FROM cons GROUP BY 1) x), '[]'::jsonb),
    'resultados', coalesce((SELECT jsonb_object_agg(resultado, n) FROM (SELECT resultado, count(*) n FROM cons GROUP BY 1) x), '{}'::jsonb),
    'situacao_premios', coalesce((SELECT jsonb_object_agg(situacao, n) FROM (SELECT situacao, count(*) n FROM nums GROUP BY 1) x), '{}'::jsonb),
    'retiradas_dia', coalesce((SELECT jsonb_agg(x ORDER BY x.dia) FROM (
        SELECT dia, sum(enc)::int encontradas, sum(ent)::int entregues FROM (
          SELECT to_char(timezone('America/Sao_Paulo', reservado_em)::date,'YYYY-MM-DD') dia, 1 enc, 0 ent FROM prem
          UNION ALL SELECT to_char(timezone('America/Sao_Paulo', entregue_em)::date,'YYYY-MM-DD'), 0, 1 FROM ret) u GROUP BY dia) x), '[]'::jsonb),
    'comparacao', coalesce((SELECT jsonb_agg(x ORDER BY x.numero DESC) FROM (
        SELECT c.id, c.numero, c.nome, c.inicio_em, c.fim_em, c.situacao,
          (SELECT count(DISTINCT cliente_id) FROM cons q WHERE q.campanha_id = c.id) participantes,
          (SELECT count(*) FROM cons q WHERE q.campanha_id = c.id) consultas,
          (SELECT count(DISTINCT cliente_id) FROM prem p WHERE p.campanha_id = c.id) premiados,
          (SELECT count(*) FROM prem p WHERE p.campanha_id = c.id AND p.situacao = 'entregue') entregues,
          (SELECT count(*) FROM prem p WHERE p.campanha_id = c.id AND p.situacao IN ('entregue','reservado','vencido')) validas
        FROM camps c) x), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.numero_sorte_estatisticas_campanha(_campanha uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; r jsonb;
BEGIN
  IF NOT (public.tem_permissao(auth.uid(), 'numero_sorte.estatisticas.visualizar') OR public.tem_permissao(auth.uid(), 'numero_sorte.relatorios.visualizar')) THEN
    RAISE EXCEPTION 'SEM_PERMISSAO' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO c FROM numero_sorte_campanhas WHERE id = _campanha;
  IF NOT FOUND THEN RAISE EXCEPTION 'CAMPANHA_NAO_ENCONTRADA'; END IF;
  SELECT jsonb_build_object(
    'campanha', jsonb_build_object('id', c.id, 'numero', c.numero, 'nome', c.nome, 'inicio_em', c.inicio_em, 'fim_em', c.fim_em, 'situacao', c.situacao),
    'cadastrados', (SELECT count(DISTINCT cliente_id) FROM numero_sorte_participacoes WHERE campanha_id = _campanha),
    'novos', (SELECT count(DISTINCT p.cliente_id) FROM numero_sorte_participacoes p JOIN clientes k ON k.id = p.cliente_id WHERE p.campanha_id = _campanha AND k.created_at >= coalesce(c.inicio_em, c.criado_em)),
    'participantes', (SELECT count(DISTINCT cliente_id) FROM numero_sorte_consultas WHERE campanha_id = _campanha AND cliente_id IS NOT NULL),
    'consultas', (SELECT count(*) FROM numero_sorte_consultas WHERE campanha_id = _campanha),
    'distintos', (SELECT count(DISTINCT codigo) FROM numero_sorte_consultas WHERE campanha_id = _campanha AND resultado IN ('nao_premiado','premiado','repetida')),
    'resultados', coalesce((SELECT jsonb_object_agg(resultado, n) FROM (SELECT resultado, count(*) n FROM numero_sorte_consultas WHERE campanha_id = _campanha GROUP BY 1) x), '{}'::jsonb),
    'premiacoes', coalesce((SELECT jsonb_object_agg(situacao, n) FROM (SELECT situacao, count(*) n FROM numero_sorte_premiacoes WHERE campanha_id = _campanha GROUP BY 1) x), '{}'::jsonb),
    'clientes_premiados', (SELECT count(DISTINCT cliente_id) FROM numero_sorte_premiacoes WHERE campanha_id = _campanha AND situacao <> 'cancelado'),
    'premios', coalesce((SELECT jsonb_agg(x ORDER BY x.nome) FROM (
      SELECT p.id, p.nome, p.imagem_path, p.quantidade,
        count(n.id) gerados,
        count(n.id) FILTER (WHERE n.situacao = 'disponivel') disponiveis,
        count(n.id) FILTER (WHERE n.situacao = 'reservado') reservados,
        count(n.id) FILTER (WHERE n.situacao = 'entregue') entregues,
        count(n.id) FILTER (WHERE n.situacao = 'vencido') vencidos,
        count(n.id) FILTER (WHERE n.situacao = 'cancelado') cancelados
      FROM numero_sorte_premios p LEFT JOIN numero_sorte_numeros n ON n.premio_id = p.id
      WHERE p.campanha_id = _campanha GROUP BY p.id) x), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.numero_sorte_relatorio(_tipo text, _campanha uuid DEFAULT NULL, _de timestamptz DEFAULT NULL, _ate timestamptz DEFAULT NULL, _situacao text DEFAULT NULL, _busca text DEFAULT NULL, _premio uuid DEFAULT NULL, _limite int DEFAULT 50, _offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb; b text := nullif(trim(coalesce(_busca,'')), '');
BEGIN
  IF NOT (public.tem_permissao(auth.uid(), 'numero_sorte.participantes.visualizar') OR public.tem_permissao(auth.uid(), 'numero_sorte.relatorios.visualizar')) THEN
    RAISE EXCEPTION 'SEM_PERMISSAO' USING ERRCODE = '42501';
  END IF;
  _limite := least(greatest(coalesce(_limite, 50), 1), 1000);
  _offset := greatest(coalesce(_offset, 0), 0);
  IF _tipo = 'participantes' THEN
    WITH base AS (
      SELECT p.campanha_id, p.cliente_id, k.nome, numero_sorte_mascarar_telefone(k.telefone) telefone, numero_sorte_mascarar_cpf(k.cpf) cpf,
        c.numero campanha_numero, c.nome campanha_nome, p.criado_em primeiro_acesso,
        (SELECT count(*) FROM numero_sorte_consultas q WHERE q.campanha_id = p.campanha_id AND q.cliente_id = p.cliente_id) consultas,
        (SELECT count(DISTINCT codigo) FROM numero_sorte_consultas q WHERE q.campanha_id = p.campanha_id AND q.cliente_id = p.cliente_id AND q.resultado IN ('nao_premiado','premiado','repetida')) distintos,
        (SELECT max(criado_em) FROM numero_sorte_consultas q WHERE q.campanha_id = p.campanha_id AND q.cliente_id = p.cliente_id) ultima,
        EXISTS (SELECT 1 FROM numero_sorte_premiacoes pr WHERE pr.campanha_id = p.campanha_id AND pr.cliente_id = p.cliente_id AND pr.situacao <> 'cancelado') premiado
      FROM numero_sorte_participacoes p JOIN clientes k ON k.id = p.cliente_id JOIN numero_sorte_campanhas c ON c.id = p.campanha_id
      WHERE (_campanha IS NULL OR p.campanha_id = _campanha) AND (_de IS NULL OR p.criado_em >= _de) AND (_ate IS NULL OR p.criado_em < _ate)
        AND (b IS NULL OR k.nome ILIKE '%' || b || '%')
    ), f AS (
      SELECT *, CASE WHEN premiado THEN 'premiado' WHEN consultas = 0 THEN 'cadastrado' ELSE 'participando' END situacao FROM base
    ), g AS (SELECT * FROM f WHERE _situacao IS NULL OR situacao = _situacao)
    SELECT jsonb_build_object('total', (SELECT count(*) FROM g), 'linhas', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM g ORDER BY primeiro_acesso DESC LIMIT _limite OFFSET _offset) x), '[]'::jsonb)) INTO r;
  ELSIF _tipo = 'premiacoes' OR _tipo = 'retiradas' THEN
    WITH g AS (
      SELECT pr.id, c.numero campanha_numero, c.nome campanha_nome, k.nome cliente, n.codigo numero, p.nome premio,
        pr.reservado_em, pr.prazo_em, pr.situacao, rt.entregue_em, pf.nome entregue_por, rt.excecao_prazo, rt.justificativa
      FROM numero_sorte_premiacoes pr
      JOIN numero_sorte_campanhas c ON c.id = pr.campanha_id
      JOIN clientes k ON k.id = pr.cliente_id
      JOIN numero_sorte_numeros n ON n.id = pr.numero_id
      JOIN numero_sorte_premios p ON p.id = pr.premio_id
      LEFT JOIN numero_sorte_retiradas rt ON rt.premiacao_id = pr.id
      LEFT JOIN profiles pf ON pf.id = rt.entregue_por
      WHERE (_campanha IS NULL OR pr.campanha_id = _campanha) AND (_premio IS NULL OR pr.premio_id = _premio)
        AND (_situacao IS NULL OR pr.situacao = _situacao) AND (b IS NULL OR k.nome ILIKE '%' || b || '%')
        AND (_tipo = 'premiacoes' OR rt.id IS NOT NULL)
        AND (_de IS NULL OR (CASE WHEN _tipo = 'retiradas' THEN rt.entregue_em ELSE pr.reservado_em END) >= _de)
        AND (_ate IS NULL OR (CASE WHEN _tipo = 'retiradas' THEN rt.entregue_em ELSE pr.reservado_em END) < _ate)
    )
    SELECT jsonb_build_object('total', (SELECT count(*) FROM g), 'linhas', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM g ORDER BY coalesce(entregue_em, reservado_em) DESC LIMIT _limite OFFSET _offset) x), '[]'::jsonb)) INTO r;
  ELSIF _tipo = 'consultas' THEN
    WITH g AS (
      SELECT q.id, c.numero campanha_numero, c.nome campanha_nome, k.nome cliente, q.codigo numero, q.criado_em, q.resultado
      FROM numero_sorte_consultas q JOIN numero_sorte_campanhas c ON c.id = q.campanha_id LEFT JOIN clientes k ON k.id = q.cliente_id
      WHERE (_campanha IS NULL OR q.campanha_id = _campanha) AND (_situacao IS NULL OR q.resultado = _situacao)
        AND (_de IS NULL OR q.criado_em >= _de) AND (_ate IS NULL OR q.criado_em < _ate) AND (b IS NULL OR k.nome ILIKE '%' || b || '%')
    )
    SELECT jsonb_build_object('total', (SELECT count(*) FROM g), 'linhas', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM g ORDER BY criado_em DESC LIMIT _limite OFFSET _offset) x), '[]'::jsonb)) INTO r;
  ELSE
    RAISE EXCEPTION 'TIPO_INVALIDO';
  END IF;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.numero_sorte_detalhe_participante(_campanha uuid, _cliente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.tem_permissao(auth.uid(), 'numero_sorte.participantes.visualizar') THEN
    RAISE EXCEPTION 'SEM_PERMISSAO' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'cliente', (SELECT jsonb_build_object('nome', nome, 'telefone', numero_sorte_mascarar_telefone(telefone), 'cpf', numero_sorte_mascarar_cpf(cpf)) FROM clientes WHERE id = _cliente),
    'campanha', (SELECT jsonb_build_object('numero', numero, 'nome', nome) FROM numero_sorte_campanhas WHERE id = _campanha),
    'consultas', coalesce((SELECT jsonb_agg(jsonb_build_object('numero', codigo, 'criado_em', criado_em, 'resultado', resultado) ORDER BY criado_em DESC) FROM numero_sorte_consultas WHERE campanha_id = _campanha AND cliente_id = _cliente), '[]'::jsonb),
    'premiacao', (SELECT jsonb_build_object('premio', p.nome, 'numero', n.codigo, 'situacao', pr.situacao, 'reservado_em', pr.reservado_em, 'prazo_em', pr.prazo_em, 'entregue_em', rt.entregue_em)
      FROM numero_sorte_premiacoes pr JOIN numero_sorte_premios p ON p.id = pr.premio_id JOIN numero_sorte_numeros n ON n.id = pr.numero_id
      LEFT JOIN numero_sorte_retiradas rt ON rt.premiacao_id = pr.id WHERE pr.campanha_id = _campanha AND pr.cliente_id = _cliente LIMIT 1)
  ) INTO r;
  RETURN r;
END $$;

REVOKE ALL ON FUNCTION public.numero_sorte_dashboard(uuid, text, timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.numero_sorte_estatisticas_campanha(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.numero_sorte_relatorio(text, uuid, timestamptz, timestamptz, text, text, uuid, int, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.numero_sorte_detalhe_participante(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.numero_sorte_dashboard(uuid, text, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.numero_sorte_estatisticas_campanha(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.numero_sorte_relatorio(text, uuid, timestamptz, timestamptz, text, text, uuid, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.numero_sorte_detalhe_participante(uuid, uuid) TO authenticated;
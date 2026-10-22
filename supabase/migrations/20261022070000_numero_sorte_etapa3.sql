CREATE TABLE public.numero_sorte_comprovantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  premiacao_id uuid NOT NULL REFERENCES public.numero_sorte_premiacoes(id) ON DELETE RESTRICT,
  token text NOT NULL,
  codigo text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  codigo_hash text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  emitido_em timestamptz NOT NULL DEFAULT now(),
  utilizado_em timestamptz,
  revogado_em timestamptz,
  revogado_por uuid,
  revogado_motivo text
);
CREATE UNIQUE INDEX numero_sorte_comprovantes_um_ativo ON public.numero_sorte_comprovantes(premiacao_id) WHERE ativo;
CREATE INDEX numero_sorte_comprovantes_premiacao_idx ON public.numero_sorte_comprovantes(premiacao_id);

CREATE TABLE public.numero_sorte_retiradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  premiacao_id uuid NOT NULL UNIQUE REFERENCES public.numero_sorte_premiacoes(id) ON DELETE RESTRICT,
  comprovante_id uuid REFERENCES public.numero_sorte_comprovantes(id) ON DELETE SET NULL,
  entregue_em timestamptz NOT NULL DEFAULT now(),
  entregue_por uuid NOT NULL,
  excecao_prazo boolean NOT NULL DEFAULT false,
  justificativa text
);
CREATE INDEX numero_sorte_auditoria_usuario_idx ON public.numero_sorte_auditoria(usuario_id, evento, criado_em DESC);

GRANT ALL ON public.numero_sorte_comprovantes TO service_role;
GRANT SELECT ON public.numero_sorte_retiradas TO authenticated;
GRANT ALL ON public.numero_sorte_retiradas TO service_role;

ALTER TABLE public.numero_sorte_comprovantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numero_sorte_retiradas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Retiradas visiveis com permissao" ON public.numero_sorte_retiradas
  FOR SELECT TO authenticated
  USING (public.tem_permissao(auth.uid(), 'numero_sorte.retiradas.visualizar')
      OR public.tem_permissao(auth.uid(), 'numero_sorte.retiradas.validar'));

CREATE OR REPLACE FUNCTION public.numero_sorte_codigo_retirada()
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = public, extensions AS $$
DECLARE
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  r text := '';
  b bytea;
  i int;
  v int;
BEGIN
  WHILE length(r) < 8 LOOP
    b := extensions.gen_random_bytes(16);
    FOR i IN 0..15 LOOP
      v := get_byte(b, i);
      IF v < 248 AND length(r) < 8 THEN
        r := r || substr(alfabeto, (v % 31) + 1, 1);
      END IF;
    END LOOP;
  END LOOP;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.numero_sorte_emitir_comprovante(_premiacao_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  c public.numero_sorte_comprovantes;
  tok text;
  cod text;
  tentativas int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.numero_sorte_premiacoes WHERE id = _premiacao_id) THEN
    RAISE EXCEPTION 'PREMIACAO_INEXISTENTE';
  END IF;
  SELECT * INTO c FROM public.numero_sorte_comprovantes WHERE premiacao_id = _premiacao_id AND ativo;
  IF FOUND THEN
    RETURN jsonb_build_object('token', c.token, 'codigo', c.codigo, 'emitido_em', c.emitido_em);
  END IF;
  -- Entregue: devolve o último comprovante (já utilizado) para consulta.
  SELECT * INTO c FROM public.numero_sorte_comprovantes
   WHERE premiacao_id = _premiacao_id AND utilizado_em IS NOT NULL ORDER BY emitido_em DESC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('token', c.token, 'codigo', c.codigo, 'emitido_em', c.emitido_em);
  END IF;
  LOOP
    tentativas := tentativas + 1;
    tok := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
    cod := public.numero_sorte_codigo_retirada();
    BEGIN
      INSERT INTO public.numero_sorte_comprovantes (premiacao_id, token, codigo, token_hash, codigo_hash)
      VALUES (_premiacao_id, tok, cod,
              encode(extensions.digest(tok, 'sha256'), 'hex'),
              encode(extensions.digest(cod, 'sha256'), 'hex'))
      RETURNING * INTO c;
      INSERT INTO public.numero_sorte_auditoria (campanha_id, evento, detalhe)
      SELECT campanha_id, 'comprovante_emitido', jsonb_build_object('premiacao_id', _premiacao_id)
        FROM public.numero_sorte_premiacoes WHERE id = _premiacao_id;
      RETURN jsonb_build_object('token', c.token, 'codigo', c.codigo, 'emitido_em', c.emitido_em);
    EXCEPTION WHEN unique_violation THEN
      SELECT * INTO c FROM public.numero_sorte_comprovantes WHERE premiacao_id = _premiacao_id AND ativo;
      IF FOUND THEN
        RETURN jsonb_build_object('token', c.token, 'codigo', c.codigo, 'emitido_em', c.emitido_em);
      END IF;
      IF tentativas >= 5 THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.numero_sorte_vencer_premiacoes()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  WITH v AS (
    UPDATE public.numero_sorte_premiacoes p SET situacao = 'vencido'
     WHERE p.situacao = 'reservado' AND p.prazo_em < now()
       AND NOT EXISTS (SELECT 1 FROM public.numero_sorte_retiradas r WHERE r.premiacao_id = p.id)
    RETURNING p.numero_id
  )
  UPDATE public.numero_sorte_numeros n SET situacao = 'vencido' FROM v WHERE n.id = v.numero_id AND n.situacao = 'reservado';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.numero_sorte_detalhe_premiacao(_premiacao_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'premiacao_id', p.id,
    'campanha', c.nome,
    'campanha_numero', c.numero,
    'cliente', cl.nome,
    'cpf', CASE WHEN length(coalesce(cl.cpf,'')) = 11
                THEN '***.' || substr(cl.cpf,4,3) || '.' || substr(cl.cpf,7,3) || '-**' ELSE '—' END,
    'telefone', CASE WHEN length(coalesce(cl.telefone_normalizado,'')) >= 10
                THEN '(' || substr(cl.telefone_normalizado,1,2) || ') *****-' || right(cl.telefone_normalizado,4) ELSE '—' END,
    'numero', n.codigo,
    'premio', pr.nome,
    'descricao', pr.descricao,
    'imagem_path', pr.imagem_path,
    'condicoes', pr.condicoes_retirada,
    'local', pr.local_retirada,
    'reservado_em', p.reservado_em,
    'prazo_em', p.prazo_em,
    'situacao', p.situacao,
    'comprovante_ativo', EXISTS (SELECT 1 FROM public.numero_sorte_comprovantes x WHERE x.premiacao_id = p.id AND x.ativo),
    'entrega', (SELECT jsonb_build_object('em', r.entregue_em, 'por', coalesce(pf.nome, pf.email, 'Usuário'),
                       'excecao', r.excecao_prazo, 'justificativa', r.justificativa)
                  FROM public.numero_sorte_retiradas r LEFT JOIN public.profiles pf ON pf.id = r.entregue_por
                 WHERE r.premiacao_id = p.id)
  )
  FROM public.numero_sorte_premiacoes p
  JOIN public.numero_sorte_campanhas c ON c.id = p.campanha_id
  JOIN public.clientes cl ON cl.id = p.cliente_id
  JOIN public.numero_sorte_numeros n ON n.id = p.numero_id
  JOIN public.numero_sorte_premios pr ON pr.id = p.premio_id
  WHERE p.id = _premiacao_id
$$;

CREATE OR REPLACE FUNCTION public.numero_sorte_validar_retirada(_token text, _codigo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  uid uuid := auth.uid();
  c public.numero_sorte_comprovantes;
  falhas int;
  cod text := upper(regexp_replace(coalesce(_codigo,''), '[^A-Za-z0-9]', '', 'g'));
  tok text := trim(coalesce(_token,''));
  camp uuid;
BEGIN
  IF uid IS NULL OR NOT public.tem_permissao(uid, 'numero_sorte.retiradas.validar') THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;
  SELECT count(*) INTO falhas FROM public.numero_sorte_auditoria
   WHERE usuario_id = uid AND evento = 'retirada_invalida' AND criado_em > now() - interval '10 minutes';
  IF falhas >= 15 THEN
    INSERT INTO public.numero_sorte_auditoria (evento, usuario_id, detalhe)
    VALUES ('atividade_suspeita', uid, jsonb_build_object('acao', 'validar_retirada'));
    RAISE EXCEPTION 'LIMITE';
  END IF;
  PERFORM public.numero_sorte_vencer_premiacoes();

  IF tok <> '' THEN
    SELECT * INTO c FROM public.numero_sorte_comprovantes WHERE token_hash = encode(extensions.digest(tok, 'sha256'), 'hex');
  ELSIF length(cod) = 8 THEN
    SELECT * INTO c FROM public.numero_sorte_comprovantes WHERE codigo_hash = encode(extensions.digest(cod, 'sha256'), 'hex');
  END IF;

  IF c.id IS NULL THEN
    INSERT INTO public.numero_sorte_auditoria (evento, usuario_id, detalhe)
    VALUES ('retirada_invalida', uid, jsonb_build_object('tipo', CASE WHEN tok <> '' THEN 'qr' ELSE 'codigo' END));
    RETURN jsonb_build_object('resultado', 'invalido');
  END IF;

  SELECT campanha_id INTO camp FROM public.numero_sorte_premiacoes WHERE id = c.premiacao_id;
  INSERT INTO public.numero_sorte_auditoria (campanha_id, evento, usuario_id, detalhe)
  VALUES (camp, 'retirada_consultada', uid, jsonb_build_object('premiacao_id', c.premiacao_id));

  IF NOT c.ativo AND c.utilizado_em IS NULL THEN
    RETURN jsonb_build_object('resultado', 'revogado');
  END IF;
  RETURN jsonb_build_object('resultado', 'ok', 'dados', public.numero_sorte_detalhe_premiacao(c.premiacao_id));
END $$;

CREATE OR REPLACE FUNCTION public.numero_sorte_confirmar_entrega(_premiacao_id uuid, _excecao boolean, _justificativa text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  p public.numero_sorte_premiacoes;
  comp uuid;
  vencido boolean;
BEGIN
  IF uid IS NULL OR NOT public.tem_permissao(uid, 'numero_sorte.retiradas.confirmar') THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;
  SELECT * INTO p FROM public.numero_sorte_premiacoes WHERE id = _premiacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PREMIACAO_INEXISTENTE'; END IF;

  IF EXISTS (SELECT 1 FROM public.numero_sorte_retiradas WHERE premiacao_id = p.id) THEN
    RETURN jsonb_build_object('resultado', 'ja_entregue', 'dados', public.numero_sorte_detalhe_premiacao(p.id));
  END IF;
  IF p.situacao = 'cancelado' THEN RAISE EXCEPTION 'CANCELADO'; END IF;

  vencido := p.situacao = 'vencido' OR p.prazo_em < now();
  IF vencido THEN
    IF NOT coalesce(_excecao, false) THEN RAISE EXCEPTION 'VENCIDO'; END IF;
    IF NOT public.tem_permissao(uid, 'numero_sorte.retiradas.excecao') THEN RAISE EXCEPTION 'SEM_PERMISSAO_EXCECAO'; END IF;
    IF length(trim(coalesce(_justificativa, ''))) < 10 THEN RAISE EXCEPTION 'JUSTIFICATIVA'; END IF;
  END IF;

  SELECT id INTO comp FROM public.numero_sorte_comprovantes WHERE premiacao_id = p.id AND ativo FOR UPDATE;
  IF comp IS NULL THEN RAISE EXCEPTION 'SEM_COMPROVANTE'; END IF;

  INSERT INTO public.numero_sorte_retiradas (premiacao_id, comprovante_id, entregue_por, excecao_prazo, justificativa)
  VALUES (p.id, comp, uid, vencido, CASE WHEN vencido THEN trim(_justificativa) END);
  UPDATE public.numero_sorte_premiacoes SET situacao = 'entregue' WHERE id = p.id;
  UPDATE public.numero_sorte_numeros SET situacao = 'entregue' WHERE id = p.numero_id;
  UPDATE public.numero_sorte_comprovantes SET ativo = false, utilizado_em = now() WHERE id = comp;
  INSERT INTO public.numero_sorte_auditoria (campanha_id, evento, usuario_id, detalhe)
  VALUES (p.campanha_id, CASE WHEN vencido THEN 'entrega_com_excecao' ELSE 'premio_entregue' END, uid,
          jsonb_build_object('premiacao_id', p.id, 'justificativa', CASE WHEN vencido THEN trim(_justificativa) END));
  RETURN jsonb_build_object('resultado', 'entregue', 'dados', public.numero_sorte_detalhe_premiacao(p.id));
END $$;

CREATE OR REPLACE FUNCTION public.numero_sorte_revogar_comprovante(_premiacao_id uuid, _motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  p public.numero_sorte_premiacoes;
BEGIN
  IF uid IS NULL OR NOT public.tem_permissao(uid, 'numero_sorte.retiradas.excecao') THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;
  IF length(trim(coalesce(_motivo, ''))) < 10 THEN RAISE EXCEPTION 'JUSTIFICATIVA'; END IF;
  SELECT * INTO p FROM public.numero_sorte_premiacoes WHERE id = _premiacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PREMIACAO_INEXISTENTE'; END IF;
  IF p.situacao = 'entregue' THEN RAISE EXCEPTION 'JA_ENTREGUE'; END IF;
  UPDATE public.numero_sorte_comprovantes
     SET ativo = false, revogado_em = now(), revogado_por = uid, revogado_motivo = trim(_motivo)
   WHERE premiacao_id = p.id AND ativo;
  PERFORM public.numero_sorte_emitir_comprovante(p.id);
  INSERT INTO public.numero_sorte_auditoria (campanha_id, evento, usuario_id, detalhe)
  VALUES (p.campanha_id, 'comprovante_revogado', uid, jsonb_build_object('premiacao_id', p.id, 'motivo', trim(_motivo)));
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.numero_sorte_historico_retiradas(_campanha_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT (public.tem_permissao(uid, 'numero_sorte.retiradas.visualizar')
                      OR public.tem_permissao(uid, 'numero_sorte.retiradas.validar')) THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;
  PERFORM public.numero_sorte_vencer_premiacoes();
  RETURN coalesce((
    SELECT jsonb_agg(public.numero_sorte_detalhe_premiacao(x.id) ORDER BY x.reservado_em DESC)
      FROM (SELECT id, reservado_em FROM public.numero_sorte_premiacoes
             WHERE _campanha_id IS NULL OR campanha_id = _campanha_id
             ORDER BY reservado_em DESC LIMIT 1000) x
  ), '[]'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.numero_sorte_codigo_retirada() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.numero_sorte_emitir_comprovante(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.numero_sorte_detalhe_premiacao(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.numero_sorte_vencer_premiacoes() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.numero_sorte_validar_retirada(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.numero_sorte_confirmar_entrega(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.numero_sorte_revogar_comprovante(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.numero_sorte_historico_retiradas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.numero_sorte_codigo_retirada(), public.numero_sorte_emitir_comprovante(uuid),
  public.numero_sorte_detalhe_premiacao(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.numero_sorte_vencer_premiacoes(), public.numero_sorte_validar_retirada(text, text),
  public.numero_sorte_confirmar_entrega(uuid, boolean, text), public.numero_sorte_revogar_comprovante(uuid, text),
  public.numero_sorte_historico_retiradas(uuid) TO authenticated, service_role;

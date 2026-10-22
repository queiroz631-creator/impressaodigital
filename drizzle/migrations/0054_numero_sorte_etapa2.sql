CREATE TABLE public.numero_sorte_participacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES public.numero_sorte_campanhas(id) ON DELETE RESTRICT,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  aceite_regulamento_em timestamptz NOT NULL DEFAULT now(),
  aceite_marketing boolean NOT NULL DEFAULT false,
  ip_hash text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campanha_id, cliente_id)
);

CREATE TABLE public.numero_sorte_premiacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES public.numero_sorte_campanhas(id) ON DELETE RESTRICT,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  numero_id uuid NOT NULL UNIQUE REFERENCES public.numero_sorte_numeros(id) ON DELETE RESTRICT,
  premio_id uuid NOT NULL REFERENCES public.numero_sorte_premios(id) ON DELETE RESTRICT,
  situacao text NOT NULL DEFAULT 'reservado' CHECK (situacao IN ('reservado','entregue','vencido','cancelado')),
  reservado_em timestamptz NOT NULL DEFAULT now(),
  prazo_em timestamptz NOT NULL,
  UNIQUE (campanha_id, cliente_id)
);

CREATE TABLE public.numero_sorte_consultas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES public.numero_sorte_campanhas(id) ON DELETE RESTRICT,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  codigo text NOT NULL,
  resultado text NOT NULL CHECK (resultado IN ('nao_premiado','premiado','repetida','bloqueada','invalida','limite')),
  numero_id uuid REFERENCES public.numero_sorte_numeros(id) ON DELETE SET NULL,
  ip_hash text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX numero_sorte_consultas_campanha_idx ON public.numero_sorte_consultas(campanha_id, criado_em DESC);
CREATE INDEX numero_sorte_consultas_cliente_idx ON public.numero_sorte_consultas(cliente_id, campanha_id, criado_em DESC);
CREATE INDEX numero_sorte_consultas_ip_idx ON public.numero_sorte_consultas(ip_hash, criado_em DESC);

CREATE TABLE public.numero_sorte_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  campanha_id uuid NOT NULL REFERENCES public.numero_sorte_campanhas(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  expira_em timestamptz NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.numero_sorte_tentativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao text NOT NULL,
  ip_hash text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX numero_sorte_tentativas_idx ON public.numero_sorte_tentativas(acao, ip_hash, criado_em DESC);

GRANT SELECT ON public.numero_sorte_participacoes, public.numero_sorte_premiacoes, public.numero_sorte_consultas TO authenticated;
GRANT ALL ON public.numero_sorte_participacoes, public.numero_sorte_premiacoes, public.numero_sorte_consultas, public.numero_sorte_sessoes, public.numero_sorte_tentativas TO service_role;

ALTER TABLE public.numero_sorte_participacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numero_sorte_premiacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numero_sorte_consultas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numero_sorte_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numero_sorte_tentativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ns participacoes leitura" ON public.numero_sorte_participacoes FOR SELECT TO authenticated
  USING (public.tem_permissao(auth.uid(), 'numero_sorte.participantes.visualizar'));
CREATE POLICY "ns premiacoes leitura" ON public.numero_sorte_premiacoes FOR SELECT TO authenticated
  USING (public.tem_permissao(auth.uid(), 'numero_sorte.participantes.visualizar'));
CREATE POLICY "ns consultas leitura" ON public.numero_sorte_consultas FOR SELECT TO authenticated
  USING (public.tem_permissao(auth.uid(), 'numero_sorte.participantes.visualizar'));

-- Identifica ou cria o cliente pelo CPF/telefone sem sobrescrever dados existentes.
CREATE OR REPLACE FUNCTION public.numero_sorte_identificar_cliente(_nome text, _cpf text, _telefone text, _telefone_normalizado text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _c public.clientes%ROWTYPE;
BEGIN
  IF NOT public.cpf_valido(_cpf) THEN RAISE EXCEPTION 'CPF_INVALIDO'; END IF;
  IF length(coalesce(_telefone_normalizado,'')) < 10 THEN RAISE EXCEPTION 'TELEFONE_INVALIDO'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ns_cliente_' || _cpf));
  PERFORM pg_advisory_xact_lock(hashtext('ns_tel_' || _telefone_normalizado));

  SELECT * INTO _c FROM public.clientes WHERE cpf = _cpf LIMIT 1;
  IF FOUND THEN
    IF coalesce(_c.telefone_normalizado,'') <> _telefone_normalizado
       AND regexp_replace(coalesce(_c.telefone,''), '\D', '', 'g') <> _telefone_normalizado THEN
      RAISE EXCEPTION 'DADOS_NAO_CONFEREM';
    END IF;
    IF coalesce(btrim(_c.nome),'') = '' THEN UPDATE public.clientes SET nome = _nome WHERE id = _c.id; END IF;
    RETURN _c.id;
  END IF;

  SELECT * INTO _c FROM public.clientes WHERE telefone_normalizado = _telefone_normalizado ORDER BY created_at LIMIT 1;
  IF FOUND THEN
    IF _c.cpf IS NOT NULL THEN RAISE EXCEPTION 'DADOS_NAO_CONFEREM'; END IF;
    UPDATE public.clientes SET cpf = _cpf,
      nome = CASE WHEN coalesce(btrim(nome),'') = '' THEN _nome ELSE nome END
    WHERE id = _c.id AND cpf IS NULL;
    RETURN _c.id;
  END IF;

  INSERT INTO public.clientes (nome, cpf, telefone, telefone_normalizado)
  VALUES (_nome, _cpf, _telefone, _telefone_normalizado) RETURNING id INTO _c.id;
  RETURN _c.id;
END $$;

-- Consulta atômica de um número (limites, bloqueio de ganhador e reserva).
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
  INSERT INTO public.numero_sorte_auditoria (campanha_id, evento, detalhes)
  VALUES (_campanha_id, 'premio_reservado', jsonb_build_object('premiacao_id', _premiacao_id, 'premio_id', _prem.id));
  RETURN jsonb_build_object('resultado','premiado');
END $$;

REVOKE ALL ON FUNCTION public.numero_sorte_identificar_cliente(text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.numero_sorte_consultar(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.numero_sorte_identificar_cliente(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.numero_sorte_consultar(uuid, uuid, text, text) TO service_role;

CREATE POLICY "ns divulgacao leitura" ON storage.objects FOR SELECT
  USING (bucket_id = 'numero-sorte-divulgacao');
CREATE POLICY "ns divulgacao enviar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'numero-sorte-divulgacao' AND (public.tem_permissao(auth.uid(), 'numero_sorte.campanhas.gerenciar') OR public.tem_permissao(auth.uid(), 'numero_sorte.premios.gerenciar')));
CREATE POLICY "ns divulgacao atualizar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'numero-sorte-divulgacao' AND (public.tem_permissao(auth.uid(), 'numero_sorte.campanhas.gerenciar') OR public.tem_permissao(auth.uid(), 'numero_sorte.premios.gerenciar')));
CREATE POLICY "ns divulgacao remover" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'numero-sorte-divulgacao' AND (public.tem_permissao(auth.uid(), 'numero_sorte.campanhas.gerenciar') OR public.tem_permissao(auth.uid(), 'numero_sorte.premios.gerenciar')));
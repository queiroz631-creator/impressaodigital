CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE SEQUENCE public.numero_sorte_campanha_seq START 1 NO CYCLE;

CREATE TABLE public.numero_sorte_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigint NOT NULL UNIQUE DEFAULT nextval('public.numero_sorte_campanha_seq'),
  nome text NOT NULL CHECK (length(btrim(nome)) > 0),
  descricao text NOT NULL DEFAULT '',
  banner_path text,
  inicio_em timestamptz,
  fim_em timestamptz,
  regulamento text NOT NULL DEFAULT '',
  condicoes text NOT NULL DEFAULT '',
  limite_consultas_cliente integer CHECK (limite_consultas_cliente IS NULL OR limite_consultas_cliente > 0),
  max_participacoes_cliente integer CHECK (max_participacoes_cliente IS NULL OR max_participacoes_cliente > 0),
  situacao text NOT NULL DEFAULT 'rascunho' CHECK (situacao IN ('rascunho','programada','ativa','suspensa','encerrada')),
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (fim_em IS NULL OR inicio_em IS NULL OR fim_em > inicio_em)
);
ALTER SEQUENCE public.numero_sorte_campanha_seq OWNED BY public.numero_sorte_campanhas.numero;

CREATE TABLE public.numero_sorte_premios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES public.numero_sorte_campanhas(id) ON DELETE RESTRICT,
  nome text NOT NULL CHECK (length(btrim(nome)) > 0),
  descricao text NOT NULL DEFAULT '',
  imagem_path text,
  quantidade integer NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  condicoes_retirada text NOT NULL DEFAULT '',
  prazo_retirada_dias integer NOT NULL DEFAULT 30 CHECK (prazo_retirada_dias > 0),
  situacao text NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo','inativo')),
  observacoes text,
  valor_estimado numeric(12,2),
  instrucoes text,
  local_retirada text,
  exige_documento boolean NOT NULL DEFAULT false,
  limite_por_cpf integer CHECK (limite_por_cpf IS NULL OR limite_por_cpf > 0),
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX numero_sorte_premios_campanha_idx ON public.numero_sorte_premios(campanha_id);

CREATE TABLE public.numero_sorte_numeros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES public.numero_sorte_campanhas(id) ON DELETE RESTRICT,
  premio_id uuid NOT NULL REFERENCES public.numero_sorte_premios(id) ON DELETE RESTRICT,
  sufixo integer NOT NULL CHECK (sufixo BETWEEN 0 AND 99999),
  codigo text NOT NULL UNIQUE,
  situacao text NOT NULL DEFAULT 'disponivel' CHECK (situacao IN ('disponivel','reservado','entregue','vencido','cancelado')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campanha_id, sufixo)
);
CREATE INDEX numero_sorte_numeros_premio_idx ON public.numero_sorte_numeros(premio_id);

CREATE TABLE public.numero_sorte_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid REFERENCES public.numero_sorte_campanhas(id) ON DELETE SET NULL,
  evento text NOT NULL,
  usuario_id uuid,
  detalhe jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX numero_sorte_auditoria_campanha_idx ON public.numero_sorte_auditoria(campanha_id, criado_em DESC);

GRANT SELECT, INSERT, UPDATE ON public.numero_sorte_campanhas TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.numero_sorte_premios TO authenticated;
GRANT SELECT ON public.numero_sorte_numeros TO authenticated;
GRANT SELECT, INSERT ON public.numero_sorte_auditoria TO authenticated;
GRANT ALL ON public.numero_sorte_campanhas, public.numero_sorte_premios, public.numero_sorte_numeros, public.numero_sorte_auditoria TO service_role;
GRANT USAGE ON SEQUENCE public.numero_sorte_campanha_seq TO authenticated, service_role;

ALTER TABLE public.numero_sorte_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numero_sorte_premios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numero_sorte_numeros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numero_sorte_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ns campanhas leitura" ON public.numero_sorte_campanhas FOR SELECT TO authenticated
  USING (public.tem_permissao(auth.uid(), 'numero_sorte.visualizar'));
CREATE POLICY "ns campanhas criar" ON public.numero_sorte_campanhas FOR INSERT TO authenticated
  WITH CHECK (public.tem_permissao(auth.uid(), 'numero_sorte.campanhas.gerenciar'));
CREATE POLICY "ns campanhas editar" ON public.numero_sorte_campanhas FOR UPDATE TO authenticated
  USING (public.tem_permissao(auth.uid(), 'numero_sorte.campanhas.gerenciar'))
  WITH CHECK (public.tem_permissao(auth.uid(), 'numero_sorte.campanhas.gerenciar'));

CREATE POLICY "ns premios leitura" ON public.numero_sorte_premios FOR SELECT TO authenticated
  USING (public.tem_permissao(auth.uid(), 'numero_sorte.visualizar'));
CREATE POLICY "ns premios editar" ON public.numero_sorte_premios FOR UPDATE TO authenticated
  USING (public.tem_permissao(auth.uid(), 'numero_sorte.premios.gerenciar'))
  WITH CHECK (public.tem_permissao(auth.uid(), 'numero_sorte.premios.gerenciar'));

-- Números premiados: leitura restrita a quem gerencia prêmios; escrita só por função.
CREATE POLICY "ns numeros leitura restrita" ON public.numero_sorte_numeros FOR SELECT TO authenticated
  USING (public.tem_permissao(auth.uid(), 'numero_sorte.premios.gerenciar'));

CREATE POLICY "ns auditoria leitura" ON public.numero_sorte_auditoria FOR SELECT TO authenticated
  USING (public.tem_permissao(auth.uid(), 'numero_sorte.visualizar'));
CREATE POLICY "ns auditoria inserir" ON public.numero_sorte_auditoria FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() AND public.tem_permissao(auth.uid(), 'numero_sorte.visualizar'));

-- O número sequencial nunca pode ser alterado nem escolhido.
CREATE OR REPLACE FUNCTION public.numero_sorte_proteger_campanha()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.numero := nextval('public.numero_sorte_campanha_seq');
    NEW.criado_por := auth.uid();
    NEW.criado_em := now();
  ELSE
    NEW.numero := OLD.numero;
    NEW.criado_por := OLD.criado_por;
    NEW.criado_em := OLD.criado_em;
    IF OLD.situacao = 'encerrada' AND NEW.situacao <> 'encerrada' THEN
      RAISE EXCEPTION 'Campanha encerrada não pode ser reaberta.';
    END IF;
  END IF;
  NEW.atualizado_em := now();
  RETURN NEW;
END $$;
CREATE TRIGGER numero_sorte_campanhas_proteger BEFORE INSERT OR UPDATE ON public.numero_sorte_campanhas
  FOR EACH ROW EXECUTE FUNCTION public.numero_sorte_proteger_campanha();

CREATE OR REPLACE FUNCTION public.numero_sorte_proteger_premio()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.campanha_id := OLD.campanha_id;
  NEW.quantidade := OLD.quantidade;
  NEW.criado_por := OLD.criado_por;
  NEW.criado_em := OLD.criado_em;
  NEW.atualizado_em := now();
  RETURN NEW;
END $$;
CREATE TRIGGER numero_sorte_premios_proteger BEFORE UPDATE ON public.numero_sorte_premios
  FOR EACH ROW WHEN (pg_trigger_depth() = 0) EXECUTE FUNCTION public.numero_sorte_proteger_premio();

-- Sufixo aleatório seguro de 0 a 99999 (rejeição para evitar viés).
CREATE OR REPLACE FUNCTION public.numero_sorte_sufixo_aleatorio()
RETURNS integer LANGUAGE plpgsql VOLATILE SET search_path = public, extensions AS $$
DECLARE b bytea; v integer;
BEGIN
  LOOP
    b := extensions.gen_random_bytes(3);
    v := (get_byte(b,0) << 16) | (get_byte(b,1) << 8) | get_byte(b,2);
    IF v < 16700000 THEN RETURN v % 100000; END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.numero_sorte_sufixo_aleatorio() FROM PUBLIC, anon, authenticated;

-- Gera _quantidade números exclusivos para um prêmio, de forma transacional.
CREATE OR REPLACE FUNCTION public.numero_sorte_gerar_numeros(_premio_id uuid, _quantidade integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _p public.numero_sorte_premios;
  _c public.numero_sorte_campanhas;
  _usados integer; _gerados integer := 0; _tentativas integer := 0; _suf integer; _ok integer;
BEGIN
  IF NOT public.tem_permissao(auth.uid(), 'numero_sorte.premios.gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar prêmios.';
  END IF;
  IF _quantidade IS NULL OR _quantidade < 1 OR _quantidade > 10000 THEN
    RAISE EXCEPTION 'Quantidade inválida (1 a 10000).';
  END IF;
  SELECT * INTO _p FROM public.numero_sorte_premios WHERE id = _premio_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prêmio não encontrado.'; END IF;
  -- Trava a campanha: serializa gerações concorrentes da mesma campanha.
  SELECT * INTO _c FROM public.numero_sorte_campanhas WHERE id = _p.campanha_id FOR UPDATE;
  IF _c.situacao = 'encerrada' THEN RAISE EXCEPTION 'Campanha encerrada.'; END IF;
  SELECT count(*) INTO _usados FROM public.numero_sorte_numeros WHERE campanha_id = _c.id;
  IF _usados + _quantidade > 100000 THEN
    RAISE EXCEPTION 'Capacidade insuficiente: restam % números nesta campanha.', 100000 - _usados;
  END IF;
  WHILE _gerados < _quantidade LOOP
    _tentativas := _tentativas + 1;
    IF _tentativas > _quantidade * 50 + 1000 THEN
      RAISE EXCEPTION 'Não foi possível gerar números disponíveis. Tente novamente.';
    END IF;
    _suf := public.numero_sorte_sufixo_aleatorio();
    INSERT INTO public.numero_sorte_numeros (campanha_id, premio_id, sufixo, codigo)
      VALUES (_c.id, _p.id, _suf, _c.numero::text || lpad(_suf::text, 5, '0'))
      ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS _ok = ROW_COUNT;
    _gerados := _gerados + _ok;
  END LOOP;
  UPDATE public.numero_sorte_premios SET quantidade = quantidade + _quantidade WHERE id = _p.id;
  INSERT INTO public.numero_sorte_auditoria (campanha_id, evento, usuario_id, detalhe)
    VALUES (_c.id, 'numeros_gerados', auth.uid(), jsonb_build_object('premio_id', _p.id, 'quantidade', _quantidade));
  RETURN _gerados;
END $$;
REVOKE ALL ON FUNCTION public.numero_sorte_gerar_numeros(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.numero_sorte_gerar_numeros(uuid, integer) TO authenticated;

-- Cria prêmio e gera suas unidades na mesma transação.
CREATE OR REPLACE FUNCTION public.numero_sorte_criar_premio(_campanha_id uuid, _dados jsonb, _quantidade integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.tem_permissao(auth.uid(), 'numero_sorte.premios.gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar prêmios.';
  END IF;
  INSERT INTO public.numero_sorte_premios (
    campanha_id, nome, descricao, condicoes_retirada, prazo_retirada_dias, observacoes,
    valor_estimado, instrucoes, local_retirada, exige_documento, limite_por_cpf, criado_por, quantidade)
  VALUES (
    _campanha_id, btrim(_dados->>'nome'), coalesce(_dados->>'descricao',''),
    coalesce(_dados->>'condicoes_retirada',''), coalesce((_dados->>'prazo_retirada_dias')::int, 30),
    nullif(_dados->>'observacoes',''), (_dados->>'valor_estimado')::numeric,
    nullif(_dados->>'instrucoes',''), nullif(_dados->>'local_retirada',''),
    coalesce((_dados->>'exige_documento')::boolean, false), (_dados->>'limite_por_cpf')::int,
    auth.uid(), 0)
  RETURNING id INTO _id;
  PERFORM public.numero_sorte_gerar_numeros(_id, _quantidade);
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.numero_sorte_criar_premio(uuid, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.numero_sorte_criar_premio(uuid, jsonb, integer) TO authenticated;

-- Resumo por prêmio (sem expor os números).
CREATE OR REPLACE FUNCTION public.numero_sorte_resumo_premios(_campanha_id uuid)
RETURNS TABLE(premio_id uuid, disponivel bigint, reservado bigint, entregue bigint, vencido bigint, cancelado bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT n.premio_id,
    count(*) FILTER (WHERE n.situacao='disponivel'), count(*) FILTER (WHERE n.situacao='reservado'),
    count(*) FILTER (WHERE n.situacao='entregue'), count(*) FILTER (WHERE n.situacao='vencido'),
    count(*) FILTER (WHERE n.situacao='cancelado')
  FROM public.numero_sorte_numeros n
  WHERE n.campanha_id = _campanha_id AND public.tem_permissao(auth.uid(), 'numero_sorte.visualizar')
  GROUP BY n.premio_id
$$;
REVOKE ALL ON FUNCTION public.numero_sorte_resumo_premios(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.numero_sorte_resumo_premios(uuid) TO authenticated;
-- Nº da Sorte: intervalo configurável de números por campanha (aditivo).
ALTER TABLE public.numero_sorte_campanhas
  ADD COLUMN IF NOT EXISTS sufixo_inicial integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sufixo_final integer NOT NULL DEFAULT 99999;
ALTER TABLE public.numero_sorte_campanhas
  ADD CONSTRAINT numero_sorte_campanhas_intervalo_ck
  CHECK (sufixo_inicial BETWEEN 0 AND 99999 AND sufixo_final BETWEEN 0 AND 99999 AND sufixo_inicial <= sufixo_final);

CREATE TABLE public.numero_sorte_intervalo_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES public.numero_sorte_campanhas(id) ON DELETE CASCADE,
  inicial_anterior integer NOT NULL,
  final_anterior integer NOT NULL,
  inicial_novo integer NOT NULL,
  final_novo integer NOT NULL,
  usuario_id uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX numero_sorte_intervalo_historico_campanha_idx ON public.numero_sorte_intervalo_historico (campanha_id, criado_em DESC);
GRANT SELECT ON public.numero_sorte_intervalo_historico TO authenticated;
GRANT ALL ON public.numero_sorte_intervalo_historico TO service_role;
ALTER TABLE public.numero_sorte_intervalo_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe visualiza historico de intervalo" ON public.numero_sorte_intervalo_historico
  FOR SELECT TO authenticated USING (public.tem_permissao(auth.uid(), 'numero_sorte.visualizar'));

-- Protege o intervalo: com números gerados, só permite ampliar o número final.
CREATE OR REPLACE FUNCTION public.numero_sorte_proteger_intervalo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _min integer; _max integer;
BEGIN
  IF NEW.sufixo_inicial = OLD.sufixo_inicial AND NEW.sufixo_final = OLD.sufixo_final THEN
    RETURN NEW;
  END IF;
  SELECT min(sufixo), max(sufixo) INTO _min, _max FROM public.numero_sorte_numeros WHERE campanha_id = OLD.id;
  IF _min IS NOT NULL THEN
    IF NEW.sufixo_inicial <> OLD.sufixo_inicial THEN
      RAISE EXCEPTION 'Esta campanha já possui números gerados: o número inicial não pode ser alterado.';
    END IF;
    IF NEW.sufixo_final < OLD.sufixo_final THEN
      RAISE EXCEPTION 'Esta campanha já possui números gerados: o intervalo só pode ser ampliado.';
    END IF;
    IF NEW.sufixo_final < _max OR NEW.sufixo_inicial > _min THEN
      RAISE EXCEPTION 'O intervalo excluiria números já gerados.';
    END IF;
  END IF;
  INSERT INTO public.numero_sorte_intervalo_historico
    (campanha_id, inicial_anterior, final_anterior, inicial_novo, final_novo, usuario_id)
  VALUES (OLD.id, OLD.sufixo_inicial, OLD.sufixo_final, NEW.sufixo_inicial, NEW.sufixo_final, auth.uid());
  INSERT INTO public.numero_sorte_auditoria (campanha_id, evento, usuario_id, detalhe)
  VALUES (OLD.id, 'intervalo_alterado', auth.uid(), jsonb_build_object(
    'inicial_anterior', OLD.sufixo_inicial, 'final_anterior', OLD.sufixo_final,
    'inicial_novo', NEW.sufixo_inicial, 'final_novo', NEW.sufixo_final));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.numero_sorte_proteger_intervalo() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER numero_sorte_campanhas_intervalo BEFORE UPDATE OF sufixo_inicial, sufixo_final
  ON public.numero_sorte_campanhas FOR EACH ROW EXECUTE FUNCTION public.numero_sorte_proteger_intervalo();

-- Ampliação explícita do número final (sufixo).
CREATE OR REPLACE FUNCTION public.numero_sorte_ampliar_intervalo(_campanha_id uuid, _novo_final integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.numero_sorte_campanhas;
BEGIN
  IF NOT public.tem_permissao(auth.uid(), 'numero_sorte.campanhas.gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar campanhas.';
  END IF;
  SELECT * INTO _c FROM public.numero_sorte_campanhas WHERE id = _campanha_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campanha não encontrada.'; END IF;
  IF _c.situacao = 'encerrada' THEN RAISE EXCEPTION 'Campanha encerrada.'; END IF;
  IF _novo_final IS NULL OR _novo_final > 99999 THEN
    RAISE EXCEPTION 'O número final ultrapassa o limite do prefixo da campanha.';
  END IF;
  IF _novo_final <= _c.sufixo_final THEN
    RAISE EXCEPTION 'O novo número final deve ser maior que o atual.';
  END IF;
  UPDATE public.numero_sorte_campanhas SET sufixo_final = _novo_final WHERE id = _campanha_id;
END $$;
REVOKE ALL ON FUNCTION public.numero_sorte_ampliar_intervalo(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.numero_sorte_ampliar_intervalo(uuid, integer) TO authenticated;

-- Geração restrita ao intervalo configurado, sem geração parcial.
CREATE OR REPLACE FUNCTION public.numero_sorte_gerar_numeros(_premio_id uuid, _quantidade integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _p public.numero_sorte_premios;
  _c public.numero_sorte_campanhas;
  _tamanho integer; _usados integer; _gerados integer := 0; _tentativas integer := 0;
  _suf integer; _ok integer;
BEGIN
  IF NOT public.tem_permissao(auth.uid(), 'numero_sorte.premios.gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar prêmios.';
  END IF;
  IF _quantidade IS NULL OR _quantidade < 1 OR _quantidade > 10000 THEN
    RAISE EXCEPTION 'Quantidade inválida (1 a 10000).';
  END IF;
  SELECT * INTO _p FROM public.numero_sorte_premios WHERE id = _premio_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prêmio não encontrado.'; END IF;
  -- Trava a campanha: serializa gerações concorrentes e alterações do intervalo.
  SELECT * INTO _c FROM public.numero_sorte_campanhas WHERE id = _p.campanha_id FOR UPDATE;
  IF _c.situacao = 'encerrada' THEN RAISE EXCEPTION 'Campanha encerrada.'; END IF;
  _tamanho := _c.sufixo_final - _c.sufixo_inicial + 1;
  SELECT count(*) INTO _usados FROM public.numero_sorte_numeros
    WHERE campanha_id = _c.id AND sufixo BETWEEN _c.sufixo_inicial AND _c.sufixo_final;
  IF _usados + _quantidade > _tamanho THEN
    RAISE EXCEPTION 'Não existem números disponíveis suficientes neste intervalo. Aumente o número final da campanha para continuar. (Restam %.)', _tamanho - _usados;
  END IF;

  IF (_usados + _quantidade)::numeric / _tamanho < 0.5 THEN
    -- Intervalo folgado: sorteio com retentativa em colisão.
    WHILE _gerados < _quantidade LOOP
      _tentativas := _tentativas + 1;
      IF _tentativas > _quantidade * 50 + 1000 THEN
        RAISE EXCEPTION 'Não foi possível gerar números disponíveis. Tente novamente.';
      END IF;
      _suf := _c.sufixo_inicial + (public.numero_sorte_sufixo_aleatorio() % _tamanho);
      INSERT INTO public.numero_sorte_numeros (campanha_id, premio_id, sufixo, codigo)
        VALUES (_c.id, _p.id, _suf, _c.numero::text || lpad(_suf::text, 5, '0'))
        ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS _ok = ROW_COUNT;
      _gerados := _gerados + _ok;
    END LOOP;
  ELSE
    -- Intervalo ocupado: escolhe entre os sufixos livres em ordem aleatória.
    INSERT INTO public.numero_sorte_numeros (campanha_id, premio_id, sufixo, codigo)
    SELECT _c.id, _p.id, s, _c.numero::text || lpad(s::text, 5, '0')
    FROM generate_series(_c.sufixo_inicial, _c.sufixo_final) s
    WHERE NOT EXISTS (SELECT 1 FROM public.numero_sorte_numeros n WHERE n.campanha_id = _c.id AND n.sufixo = s)
    ORDER BY gen_random_uuid()
    LIMIT _quantidade;
    GET DIAGNOSTICS _gerados = ROW_COUNT;
    IF _gerados < _quantidade THEN
      RAISE EXCEPTION 'Não existem números disponíveis suficientes neste intervalo. Aumente o número final da campanha para continuar.';
    END IF;
  END IF;

  UPDATE public.numero_sorte_premios SET quantidade = quantidade + _quantidade WHERE id = _p.id;
  INSERT INTO public.numero_sorte_auditoria (campanha_id, evento, usuario_id, detalhe)
    VALUES (_c.id, 'numeros_gerados', auth.uid(), jsonb_build_object('premio_id', _p.id, 'quantidade', _quantidade));
  RETURN _gerados;
END $$;
REVOKE ALL ON FUNCTION public.numero_sorte_gerar_numeros(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.numero_sorte_gerar_numeros(uuid, integer) TO authenticated;

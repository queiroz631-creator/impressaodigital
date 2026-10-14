-- =====================================================================
-- Central de Agentes — Etapa 2
-- 6/6 — Funções transacionais: aprovações, idempotência, profundidade,
--       auditoria e enfileiramento.
-- Migração ADITIVA. As funções não executam nenhuma ferramenta; apenas
-- garantem transações atômicas sobre as estruturas criadas.
-- =====================================================================

-- ---------------------------------------------------- agente_auditoria
CREATE OR REPLACE FUNCTION public.agente_registrar_auditoria(
  _acao text,
  _agente_id uuid DEFAULT NULL,
  _execucao_id uuid DEFAULT NULL,
  _entidade text DEFAULT NULL,
  _entidade_id text DEFAULT NULL,
  _dados jsonb DEFAULT '{}'::jsonb,
  _ip text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.agente_auditoria
    (agente_id, execucao_id, usuario_id, acao, entidade, entidade_id, dados, ip)
  VALUES
    (_agente_id, _execucao_id, auth.uid(), _acao, _entidade, _entidade_id,
     coalesce(_dados, '{}'::jsonb), _ip)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.agente_registrar_auditoria(text, uuid, uuid, text, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agente_registrar_auditoria(text, uuid, uuid, text, text, jsonb, text) TO authenticated, service_role;

-- ------------------------------------------------- limite de profundidade
CREATE OR REPLACE FUNCTION public.agente_dentro_limite_profundidade(
  _execucao_id uuid,
  _limite integer DEFAULT 5
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT e.profundidade < GREATEST(coalesce(_limite, 5), 1)
       FROM public.agente_execucoes e
      WHERE e.id = _execucao_id),
    false
  )
$$;
REVOKE ALL ON FUNCTION public.agente_dentro_limite_profundidade(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agente_dentro_limite_profundidade(uuid, integer) TO authenticated, service_role;

-- ------------------------------------------------------------ aprovações
-- Decisão atômica sobre uma aprovação pendente. Recusa se: sem permissão
-- explícita, já decidida, expirada, parâmetros alterados ou confirmação
-- divergente. Nunca executa a operação — apenas libera/cancela o passo.
CREATE OR REPLACE FUNCTION public.agente_decidir_aprovacao(
  _aprovacao_id uuid,
  _decisao text,
  _motivo text DEFAULT NULL,
  _hash_confirmacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _a public.agente_aprovacoes;
  _passo public.agente_execucao_passos;
BEGIN
  IF NOT public.agente_pode_acao('agentes.aprovar') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Sem permissão para aprovar operações.');
  END IF;

  IF _decisao NOT IN ('aprovada','recusada') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Decisão inválida.');
  END IF;

  SELECT * INTO _a FROM public.agente_aprovacoes WHERE id = _aprovacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Aprovação não encontrada.');
  END IF;
  IF _a.status <> 'pendente' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Aprovação já decidida.');
  END IF;

  IF _a.expira_em IS NOT NULL AND _a.expira_em < now() THEN
    UPDATE public.agente_aprovacoes
       SET status = 'expirada', atualizado_em = now()
     WHERE id = _a.id;
    RETURN jsonb_build_object('ok', false, 'erro', 'Aprovação expirada.');
  END IF;

  -- Parâmetros alterados desde a solicitação invalidam a aprovação.
  IF _a.passo_id IS NOT NULL THEN
    SELECT * INTO _passo FROM public.agente_execucao_passos WHERE id = _a.passo_id FOR UPDATE;
    IF FOUND AND public.agente_hash_parametros(_passo.parametros) <> _a.parametros_hash THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'Os parâmetros mudaram; solicite nova aprovação.');
    END IF;
  END IF;

  IF _decisao = 'aprovada'
     AND _hash_confirmacao IS NOT NULL
     AND _hash_confirmacao <> _a.parametros_hash THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Confirmação não corresponde aos parâmetros aprovados.');
  END IF;

  UPDATE public.agente_aprovacoes
     SET status = _decisao,
         decidido_por = auth.uid(),
         decidido_em = now(),
         motivo = nullif(_motivo, ''),
         atualizado_em = now()
   WHERE id = _a.id;

  IF _decisao = 'aprovada' THEN
    IF _a.passo_id IS NOT NULL THEN
      UPDATE public.agente_execucao_passos
         SET status = 'executando', iniciado_em = coalesce(iniciado_em, now()), atualizado_em = now()
       WHERE id = _a.passo_id;
    END IF;
    UPDATE public.agente_execucoes
       SET status = 'executando', iniciado_em = coalesce(iniciado_em, now()), atualizado_em = now()
     WHERE id = _a.execucao_id AND status = 'aguardando_aprovacao';
  ELSE
    IF _a.passo_id IS NOT NULL THEN
      UPDATE public.agente_execucao_passos
         SET status = 'cancelado', atualizado_em = now()
       WHERE id = _a.passo_id;
    END IF;
    UPDATE public.agente_execucoes
       SET status = 'cancelada', concluido_em = now(), atualizado_em = now()
     WHERE id = _a.execucao_id;
  END IF;

  PERFORM public.agente_registrar_auditoria(
    CASE WHEN _decisao = 'aprovada' THEN 'aprovacao.aprovada' ELSE 'aprovacao.recusada' END,
    NULL, _a.execucao_id, 'agente_aprovacoes', _a.id::text,
    jsonb_build_object('motivo', _motivo, 'parametros_hash', _a.parametros_hash)
  );

  RETURN jsonb_build_object('ok', true, 'erro', NULL, 'decisao', _decisao);
END;
$$;
REVOKE ALL ON FUNCTION public.agente_decidir_aprovacao(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agente_decidir_aprovacao(uuid, text, text, text) TO authenticated, service_role;

-- --------------------------------------------------------- idempotência
-- Registra/recupera a chave de uma execução de ferramenta com efeito
-- externo. Retorna se é uma execução nova e se pode prosseguir. Resultado
-- 'indeterminado' NUNCA é repetido automaticamente: deve ser reconciliado.
CREATE OR REPLACE FUNCTION public.agente_idempotencia_iniciar(
  _chave text,
  _escopo text DEFAULT 'geral',
  _agente_id uuid DEFAULT NULL,
  _execucao_id uuid DEFAULT NULL,
  _passo_id uuid DEFAULT NULL,
  _ferramenta_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _registro public.agente_idempotencia;
  _inseriu integer := 0;
BEGIN
  IF coalesce(trim(_chave), '') = '' THEN
    RAISE EXCEPTION 'chave de idempotência obrigatória';
  END IF;

  INSERT INTO public.agente_idempotencia
    (chave, escopo, agente_id, execucao_id, passo_id, ferramenta_id, status)
  VALUES
    (trim(_chave), coalesce(_escopo, 'geral'), _agente_id, _execucao_id, _passo_id, _ferramenta_id, 'iniciado')
  ON CONFLICT (chave) DO NOTHING;

  GET DIAGNOSTICS _inseriu = ROW_COUNT;

  SELECT * INTO _registro FROM public.agente_idempotencia WHERE chave = trim(_chave);

  RETURN jsonb_build_object(
    'id', _registro.id,
    'chave', _registro.chave,
    'status', _registro.status,
    'resultado', _registro.resultado,
    'novo', (_inseriu > 0),
    'pode_executar', (_inseriu > 0 OR _registro.status = 'iniciado')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.agente_idempotencia_iniciar(text, text, uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agente_idempotencia_iniciar(text, text, uuid, uuid, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.agente_idempotencia_resolver(
  _chave text,
  _status text,
  _resultado jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF _status NOT IN ('concluido','indeterminado','reconciliado','falha') THEN
    RAISE EXCEPTION 'Status inválido: %', _status;
  END IF;

  UPDATE public.agente_idempotencia
     SET status = _status,
         resultado = coalesce(_resultado, resultado),
         atualizado_em = now(),
         resolvido_em = CASE WHEN _status = 'indeterminado' THEN NULL ELSE now() END
   WHERE chave = trim(_chave);
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.agente_idempotencia_resolver(text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agente_idempotencia_resolver(text, text, jsonb) TO service_role;

-- ------------------------------------------------------------- fila
-- Enfileira uma tarefa. Exige permissão explícita de execução (sem atalho
-- de administrador). Não executa nada; apenas registra na fila.
CREATE OR REPLACE FUNCTION public.agente_enfileirar_tarefa(
  _agente_id uuid,
  _tipo text,
  _payload jsonb DEFAULT '{}'::jsonb,
  _prioridade integer DEFAULT 0,
  _agendado_para timestamptz DEFAULT NULL,
  _idempotency_key text DEFAULT NULL,
  _execucao_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.agente_pode_acao('agentes.executar') THEN
    RAISE EXCEPTION 'Sem permissão para enfileirar execuções.';
  END IF;

  INSERT INTO public.agente_tarefas
    (agente_id, execucao_id, tipo, payload, prioridade, agendado_para, idempotency_key)
  VALUES
    (_agente_id, _execucao_id, _tipo, coalesce(_payload, '{}'::jsonb),
     coalesce(_prioridade, 0), coalesce(_agendado_para, now()), _idempotency_key)
  RETURNING id INTO _id;

  PERFORM public.agente_registrar_auditoria(
    'tarefa.enfileirada', _agente_id, _execucao_id, 'agente_tarefas', _id::text,
    jsonb_build_object('tipo', _tipo, 'prioridade', _prioridade)
  );

  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.agente_enfileirar_tarefa(uuid, text, jsonb, integer, timestamptz, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agente_enfileirar_tarefa(uuid, text, jsonb, integer, timestamptz, text, uuid) TO authenticated, service_role;

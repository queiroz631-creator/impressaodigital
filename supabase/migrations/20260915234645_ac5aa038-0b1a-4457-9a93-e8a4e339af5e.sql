CREATE OR REPLACE FUNCTION public.clientes_enfileirar_para_loja()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _op text;
  _op_id text;
  _id uuid;
BEGIN
  IF coalesce(NEW.origem_alteracao, 'SUPABASE') = 'LOJA' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    _op := 'CRIACAO';
  ELSE
    IF NEW.nome IS NOT DISTINCT FROM OLD.nome
       AND NEW.cpf IS NOT DISTINCT FROM OLD.cpf
       AND NEW.telefone IS NOT DISTINCT FROM OLD.telefone
       AND NEW.telefone_normalizado IS NOT DISTINCT FROM OLD.telefone_normalizado
       AND NEW.email IS NOT DISTINCT FROM OLD.email
       AND NEW.data_nascimento IS NOT DISTINCT FROM OLD.data_nascimento THEN
      RETURN NEW;
    END IF;
    _op := 'ATUALIZACAO';
  END IF;

  _op_id := 'cliente:' || NEW.id::text;

  SELECT f.id INTO _id
  FROM public.sorteio_sincronizacao_fila f
  WHERE f.origem = 'SUPABASE'
    AND f.entidade = 'CLIENTE'
    AND f.operacao_id = _op_id
  LIMIT 1;

  IF _id IS NOT NULL THEN
    UPDATE public.sorteio_sincronizacao_fila
       SET status = 'PENDENTE',
           operacao = _op,
           alterado_em = now(),
           erro = NULL,
           processado_em = NULL,
           sequencia = nextval('public.sorteio_sincronizacao_fila_sequencia_seq'),
           atualizado_em = now()
     WHERE id = _id;
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.sorteio_sincronizacao_fila
      (tipo, entidade, entidade_id, origem, destino, operacao, operacao_id, status, alterado_em, metadados)
    VALUES
      ('CLIENTES_SUPABASE_LOJA', 'CLIENTE', NEW.id::text, 'SUPABASE', 'LOJA', _op, _op_id,
       'PENDENTE', now(), jsonb_build_object('operacao', _op));
  EXCEPTION WHEN unique_violation THEN
    UPDATE public.sorteio_sincronizacao_fila
       SET status = 'PENDENTE',
           operacao = _op,
           alterado_em = now(),
           erro = NULL,
           processado_em = NULL,
           sequencia = nextval('public.sorteio_sincronizacao_fila_sequencia_seq'),
           atualizado_em = now()
     WHERE origem = 'SUPABASE'
       AND entidade = 'CLIENTE'
       AND operacao_id = _op_id;
  END;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.sorteio_portal_criar_participacao(
  _nome text,
  _telefone text,
  _telefone_normalizado text,
  _cpf text,
  _data_nascimento date,
  _sorteio_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _cliente_id uuid;
  _participante_id uuid;
  _cpf_existente text;
BEGIN
  SELECT id INTO _cliente_id FROM public.clientes WHERE cpf = _cpf;

  IF _cliente_id IS NULL THEN
    -- Serializa por telefone para evitar dois clientes simultâneos iguais.
    IF _telefone_normalizado IS NOT NULL AND _telefone_normalizado <> '' THEN
      PERFORM pg_advisory_xact_lock(hashtextextended(_telefone_normalizado, 0));

      SELECT id, cpf INTO _cliente_id, _cpf_existente
      FROM public.clientes
      WHERE telefone_normalizado = _telefone_normalizado
         OR telefone = _telefone_normalizado
      ORDER BY created_at
      LIMIT 1
      FOR UPDATE;

      IF _cliente_id IS NOT NULL THEN
        IF _cpf_existente IS NOT NULL AND btrim(_cpf_existente) <> '' THEN
          RAISE EXCEPTION 'CADASTRO_AMBIGUO';
        END IF;

        UPDATE public.clientes
           SET cpf = _cpf,
               nome = CASE WHEN coalesce(btrim(nome), '') = '' THEN _nome ELSE nome END,
               data_nascimento = coalesce(data_nascimento, _data_nascimento)
         WHERE id = _cliente_id
           AND cpf IS NULL;
      END IF;
    END IF;
  END IF;

  IF _cliente_id IS NULL THEN
    INSERT INTO public.clientes (nome, telefone, telefone_normalizado, cpf, data_nascimento)
    VALUES (_nome, _telefone, _telefone_normalizado, _cpf, _data_nascimento)
    RETURNING id INTO _cliente_id;
  END IF;

  INSERT INTO public.sorteio_participantes (sorteio_id, cliente_id)
  VALUES (_sorteio_id, _cliente_id)
  ON CONFLICT (sorteio_id, cliente_id) DO NOTHING;

  SELECT id INTO _participante_id
  FROM public.sorteio_participantes
  WHERE sorteio_id = _sorteio_id AND cliente_id = _cliente_id;

  RETURN _participante_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.sorteio_portal_criar_participacao(text, text, text, text, date, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sorteio_portal_criar_participacao(text, text, text, text, date, uuid) TO service_role;
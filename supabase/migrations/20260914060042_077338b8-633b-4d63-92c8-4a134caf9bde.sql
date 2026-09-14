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
BEGIN
  SELECT id INTO _cliente_id FROM public.clientes WHERE cpf = _cpf;

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
-- Função de validação de CPF (dígitos verificadores), usada em CHECK.
CREATE OR REPLACE FUNCTION public.cpf_valido(_cpf text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  n text;
  soma int;
  i int;
  d1 int;
  d2 int;
BEGIN
  IF _cpf IS NULL THEN RETURN true; END IF;
  n := regexp_replace(_cpf, '\D', '', 'g');
  IF length(n) <> 11 THEN RETURN false; END IF;
  IF n ~ '^(\d)\1{10}$' THEN RETURN false; END IF;

  soma := 0;
  FOR i IN 1..9 LOOP
    soma := soma + (substr(n, i, 1))::int * (11 - i);
  END LOOP;
  d1 := (soma * 10) % 11;
  IF d1 = 10 THEN d1 := 0; END IF;
  IF d1 <> (substr(n, 10, 1))::int THEN RETURN false; END IF;

  soma := 0;
  FOR i IN 1..10 LOOP
    soma := soma + (substr(n, i, 1))::int * (12 - i);
  END LOOP;
  d2 := (soma * 10) % 11;
  IF d2 = 10 THEN d2 := 0; END IF;
  IF d2 <> (substr(n, 11, 1))::int THEN RETURN false; END IF;

  RETURN true;
END;
$$;

-- Novos campos (nascem vazios; nenhum cliente existente é alterado).
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS data_nascimento date;

ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_cpf_formato;
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_cpf_formato
  CHECK (cpf IS NULL OR (cpf ~ '^[0-9]{11}$' AND public.cpf_valido(cpf)));

-- Unicidade apenas quando o CPF estiver preenchido.
CREATE UNIQUE INDEX IF NOT EXISTS clientes_cpf_unico
  ON public.clientes (cpf) WHERE cpf IS NOT NULL;

COMMENT ON COLUMN public.clientes.cpf IS
  'CPF normalizado (somente 11 dígitos). Identificador de negócio para sincronização com a base local; NULL quando não informado.';
COMMENT ON COLUMN public.clientes.data_nascimento IS
  'Data de nascimento do cliente; preenchível quando estiver vazia, nunca sobrescrita automaticamente.';
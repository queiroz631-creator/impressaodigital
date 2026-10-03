CREATE OR REPLACE FUNCTION public.foto_express_atualizar_valor_folhas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  quantidade_folhas integer;
  preco_unitario numeric(12,2);
BEGIN
  IF NEW.papel_id IS NULL THEN RETURN NEW; END IF;
  SELECT count(*)::integer INTO quantidade_folhas
  FROM public.foto_express_folhas
  WHERE montagem_id = NEW.montagem_id AND papel_id = NEW.papel_id;

  SELECT COALESCE((
    SELECT (faixa->>'preco')::numeric
    FROM jsonb_array_elements(p.faixas_valor) faixa
    WHERE (faixa->>'min')::integer <= quantidade_folhas
    ORDER BY (faixa->>'min')::integer DESC
    LIMIT 1
  ), p.valor_folha)
  INTO preco_unitario
  FROM public.foto_express_papeis p
  WHERE p.id = NEW.papel_id;

  UPDATE public.foto_express_folhas
  SET valor_unitario = COALESCE(preco_unitario, 0)
  WHERE montagem_id = NEW.montagem_id AND papel_id = NEW.papel_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER foto_express_folhas_atualizar_valor
AFTER INSERT ON public.foto_express_folhas
FOR EACH ROW EXECUTE FUNCTION public.foto_express_atualizar_valor_folhas();
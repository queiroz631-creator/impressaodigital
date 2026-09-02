CREATE OR REPLACE FUNCTION public.limpar_agendamento_finalizacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'aguardando_finalizacao' THEN
    NEW.finalizacao_fluxo_em := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS whatsapp_conversas_limpar_finalizacao ON public.whatsapp_conversas;
CREATE TRIGGER whatsapp_conversas_limpar_finalizacao
BEFORE UPDATE ON public.whatsapp_conversas
FOR EACH ROW EXECUTE FUNCTION public.limpar_agendamento_finalizacao();
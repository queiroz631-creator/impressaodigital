REVOKE INSERT, UPDATE, DELETE ON public.foto_express_montagens FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.foto_express_folhas FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.foto_express_ocorrencias FROM authenticated;

CREATE OR REPLACE FUNCTION public.foto_express_invalidar_montagem_por_referencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME='foto_express_formatos' THEN
    UPDATE public.foto_express_montagens m SET estado='DESATUALIZADA',snapshot_confirmado=NULL
    WHERE EXISTS (SELECT 1 FROM public.foto_express_itens i WHERE i.trabalho_id=m.trabalho_id AND i.formato_id=NEW.id);
  ELSIF TG_TABLE_NAME='foto_express_arquivos' THEN
    UPDATE public.foto_express_montagens SET estado='DESATUALIZADA',snapshot_confirmado=NULL WHERE trabalho_id=NEW.trabalho_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER foto_express_formatos_invalidar_montagens AFTER UPDATE ON public.foto_express_formatos FOR EACH ROW EXECUTE FUNCTION public.foto_express_invalidar_montagem_por_referencia();
CREATE TRIGGER foto_express_arquivos_invalidar_montagem AFTER UPDATE ON public.foto_express_arquivos FOR EACH ROW EXECUTE FUNCTION public.foto_express_invalidar_montagem_por_referencia();
CREATE OR REPLACE FUNCTION public.foto_express_atualizar_status_automatico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'foto_express_itens' THEN
    IF NEW.status_edicao = 'CONFIGURADA' AND (TG_OP = 'INSERT' OR OLD.status_edicao IS DISTINCT FROM NEW.status_edicao) THEN
      UPDATE public.foto_express_trabalhos
         SET status = 'EM_EDICAO'
       WHERE id = NEW.trabalho_id
         AND status = 'RASCUNHO';
    END IF;
  ELSIF TG_TABLE_NAME = 'foto_express_montagens' THEN
    IF NEW.estado = 'ATUAL' AND NEW.snapshot_confirmado IS NOT NULL THEN
      UPDATE public.foto_express_trabalhos
         SET status = 'PRONTO_IMPRESSAO'
       WHERE id = NEW.trabalho_id
         AND status IN ('RASCUNHO', 'EM_EDICAO');
    END IF;
  ELSIF TG_TABLE_NAME = 'foto_express_geracoes' THEN
    IF NEW.estado = 'CONCLUIDA' AND OLD.estado IS DISTINCT FROM NEW.estado THEN
      UPDATE public.foto_express_trabalhos
         SET status = 'IMPRESSO'
       WHERE id = NEW.trabalho_id
         AND status <> 'FINALIZADO';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS foto_express_itens_status_trabalho ON public.foto_express_itens;
CREATE TRIGGER foto_express_itens_status_trabalho
AFTER INSERT OR UPDATE OF status_edicao ON public.foto_express_itens
FOR EACH ROW EXECUTE FUNCTION public.foto_express_atualizar_status_automatico();

DROP TRIGGER IF EXISTS foto_express_montagens_status_trabalho ON public.foto_express_montagens;
CREATE TRIGGER foto_express_montagens_status_trabalho
AFTER INSERT OR UPDATE OF estado, snapshot_confirmado ON public.foto_express_montagens
FOR EACH ROW EXECUTE FUNCTION public.foto_express_atualizar_status_automatico();

DROP TRIGGER IF EXISTS foto_express_geracoes_status_trabalho ON public.foto_express_geracoes;
CREATE TRIGGER foto_express_geracoes_status_trabalho
AFTER UPDATE OF estado ON public.foto_express_geracoes
FOR EACH ROW EXECUTE FUNCTION public.foto_express_atualizar_status_automatico();

REVOKE ALL ON FUNCTION public.foto_express_atualizar_status_automatico() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.foto_express_atualizar_status_automatico() TO service_role;

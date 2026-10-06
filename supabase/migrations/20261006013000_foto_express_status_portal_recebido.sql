ALTER TABLE public.foto_express_trabalhos
  DROP CONSTRAINT IF EXISTS foto_express_trabalhos_status_check;

ALTER TABLE public.foto_express_trabalhos
  ADD CONSTRAINT foto_express_trabalhos_status_check
  CHECK (status IN ('RASCUNHO','PORTAL','EM_EDICAO','RECEBIDO','PRONTO_IMPRESSAO','IMPRESSO','FINALIZADO'));

UPDATE public.foto_express_trabalhos
   SET status = CASE WHEN portal_enviado_em IS NULL THEN 'PORTAL' ELSE 'RECEBIDO' END
 WHERE origem_portal = true
   AND status IN ('RASCUNHO', 'EM_EDICAO');

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
         AND status IN ('RASCUNHO', 'PORTAL', 'EM_EDICAO', 'RECEBIDO');
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

REVOKE ALL ON FUNCTION public.foto_express_atualizar_status_automatico() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.foto_express_atualizar_status_automatico() TO service_role;
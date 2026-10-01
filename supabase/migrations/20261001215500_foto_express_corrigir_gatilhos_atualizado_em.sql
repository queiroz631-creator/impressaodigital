DROP TRIGGER IF EXISTS foto_express_montagens_updated_at ON public.foto_express_montagens;
CREATE TRIGGER foto_express_montagens_updated_at
BEFORE UPDATE ON public.foto_express_montagens
FOR EACH ROW EXECUTE FUNCTION public.foto_express_set_atualizado_em();

DROP TRIGGER IF EXISTS foto_express_geracoes_updated_at ON public.foto_express_geracoes;
CREATE TRIGGER foto_express_geracoes_updated_at
BEFORE UPDATE ON public.foto_express_geracoes
FOR EACH ROW EXECUTE FUNCTION public.foto_express_set_atualizado_em();
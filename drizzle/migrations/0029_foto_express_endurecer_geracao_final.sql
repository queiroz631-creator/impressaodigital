REVOKE INSERT, UPDATE, DELETE ON public.foto_express_geracoes FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.foto_express_arquivos_impressao FROM authenticated;
DROP POLICY IF EXISTS foto_express_geracoes_write ON public.foto_express_geracoes;
DROP POLICY IF EXISTS foto_express_arquivos_impressao_write ON public.foto_express_arquivos_impressao;

REVOKE ALL ON FUNCTION public.foto_express_snapshot_montagem(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.foto_express_snapshot_montagem(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.foto_express_iniciar_geracao(_trabalho_id uuid, _saida text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE montagem public.foto_express_montagens%ROWTYPE; geracao_id uuid; folha jsonb; numero_trabalho bigint; prefixo text; manifesto jsonb; esperado_ocorrencias integer; real_ocorrencias integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.trabalhos.editar') THEN RAISE EXCEPTION 'SEM_PERMISSAO'; END IF;
  IF _saida NOT IN ('PDF','JPG','PDF_JPG') THEN RAISE EXCEPTION 'SAIDA_INVALIDA'; END IF;
  SELECT * INTO montagem FROM public.foto_express_montagens WHERE trabalho_id=_trabalho_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MONTAGEM_NAO_ENCONTRADA'; END IF;
  IF montagem.estado<>'ATUAL' OR montagem.snapshot_confirmado IS NULL THEN RAISE EXCEPTION 'MONTAGEM_DESATUALIZADA'; END IF;
  manifesto:=montagem.snapshot_confirmado;
  IF COALESCE(jsonb_array_length(manifesto->'folhas'),0)=0 OR COALESCE(jsonb_array_length(manifesto->'itens'),0)=0 THEN RAISE EXCEPTION 'MONTAGEM_INCOMPLETA'; END IF;
  SELECT COALESCE(sum((entrada->'item'->>'quantidade')::integer),0) INTO esperado_ocorrencias FROM jsonb_array_elements(manifesto->'itens') entrada;
  SELECT COALESCE(sum(jsonb_array_length(entrada->'ocorrencias')),0) INTO real_ocorrencias FROM jsonb_array_elements(manifesto->'folhas') entrada;
  IF esperado_ocorrencias<>real_ocorrencias OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(manifesto->'itens') entrada
    WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(manifesto->'folhas') folha_j, jsonb_array_elements(folha_j->'ocorrencias') ocorrencia WHERE ocorrencia->>'item_id'=entrada->'item'->>'id')
  ) THEN RAISE EXCEPTION 'MONTAGEM_INCOMPLETA'; END IF;
  SELECT numero INTO numero_trabalho FROM public.foto_express_trabalhos WHERE id=_trabalho_id;
  BEGIN
    INSERT INTO public.foto_express_geracoes (trabalho_id,montagem_id,montagem_versao,assinatura,snapshot,saida,estado,etapa,criado_por,iniciado_em)
    VALUES (_trabalho_id,montagem.id,montagem.versao,montagem.assinatura,manifesto,_saida,'PROCESSANDO','PREPARANDO',auth.uid(),now()) RETURNING id INTO geracao_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO geracao_id FROM public.foto_express_geracoes WHERE montagem_id=montagem.id AND montagem_versao=montagem.versao AND saida=_saida AND estado IN ('PENDENTE','PROCESSANDO') AND criado_por=auth.uid() ORDER BY criado_em DESC LIMIT 1;
    IF geracao_id IS NULL THEN RAISE EXCEPTION 'GERACAO_EM_PROCESSAMENTO'; END IF;
    RETURN geracao_id;
  END;
  prefixo:=_trabalho_id::text||'/'||geracao_id::text||'/';
  IF _saida IN ('JPG','PDF_JPG') THEN FOR folha IN SELECT value FROM jsonb_array_elements(manifesto->'folhas') LOOP
    INSERT INTO public.foto_express_arquivos_impressao (geracao_id,tipo,folha_numero,caminho,nome_arquivo,mime) VALUES (geracao_id,'JPG',(folha->>'numero')::integer,prefixo||'folha-'||lpad(folha->>'numero',2,'0')||'.jpg','trabalho-'||lpad(numero_trabalho::text,6,'0')||'-folha-'||lpad(folha->>'numero',2,'0')||'.jpg','image/jpeg');
  END LOOP; END IF;
  IF _saida IN ('PDF','PDF_JPG') THEN INSERT INTO public.foto_express_arquivos_impressao (geracao_id,tipo,folha_numero,caminho,nome_arquivo,mime) VALUES (geracao_id,'PDF',NULL,prefixo||'impressao.pdf','trabalho-'||lpad(numero_trabalho::text,6,'0')||'-impressao.pdf','application/pdf'); END IF;
  RETURN geracao_id;
END;
$$;
REVOKE ALL ON FUNCTION public.foto_express_iniciar_geracao(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foto_express_iniciar_geracao(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.foto_express_marcar_montagem_desatualizada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE trabalho uuid;
BEGIN
  IF TG_TABLE_NAME='foto_express_itens' THEN trabalho:=CASE WHEN TG_OP='DELETE' THEN OLD.trabalho_id ELSE NEW.trabalho_id END;
  ELSIF TG_TABLE_NAME='foto_express_configuracoes' THEN SELECT trabalho_id INTO trabalho FROM public.foto_express_itens WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.item_id ELSE NEW.item_id END;
  ELSIF TG_TABLE_NAME='foto_express_textos' THEN SELECT trabalho_id INTO trabalho FROM public.foto_express_itens WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.item_id ELSE NEW.item_id END;
  END IF;
  IF trabalho IS NOT NULL THEN UPDATE public.foto_express_montagens SET estado='DESATUALIZADA',snapshot_confirmado=NULL WHERE trabalho_id=trabalho; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
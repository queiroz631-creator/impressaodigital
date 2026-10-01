CREATE OR REPLACE FUNCTION public.foto_express_snapshot_montagem(_montagem_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE resultado jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express() THEN RAISE EXCEPTION 'SEM_PERMISSAO'; END IF;
  SELECT jsonb_build_object(
    'versao_manifesto', 1,
    'montagem', to_jsonb(m) - 'snapshot_confirmado',
    'trabalho', jsonb_build_object('id', t.id, 'numero', t.numero),
    'folhas', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', f.id, 'numero', f.numero, 'largura_mm', f.largura_mm, 'altura_mm', f.altura_mm,
      'ocorrencias', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', o.id, 'item_id', o.item_id, 'indice_copia', o.indice_copia,
        'x_mm', o.x_mm, 'y_mm', o.y_mm, 'largura_mm', o.largura_mm,
        'altura_mm', o.altura_mm, 'rotacao_folha', o.rotacao_folha
      ) ORDER BY o.y_mm, o.x_mm, o.item_id, o.indice_copia) FROM public.foto_express_ocorrencias o WHERE o.folha_id=f.id), '[]'::jsonb)
    ) ORDER BY f.numero) FROM public.foto_express_folhas f WHERE f.montagem_id=m.id), '[]'::jsonb),
    'itens', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'item', to_jsonb(i), 'arquivo', to_jsonb(a), 'formato', to_jsonb(fo), 'configuracao', to_jsonb(c),
      'textos', COALESCE((SELECT jsonb_agg(to_jsonb(tx) ORDER BY tx.ordem, tx.id) FROM public.foto_express_textos tx WHERE tx.item_id=i.id), '[]'::jsonb)
    ) ORDER BY i.ordem, i.id)
    FROM public.foto_express_itens i
    JOIN public.foto_express_arquivos a ON a.id=i.arquivo_id AND a.trabalho_id=i.trabalho_id
    JOIN public.foto_express_formatos fo ON fo.id=i.formato_id
    JOIN public.foto_express_configuracoes c ON c.item_id=i.id
    WHERE i.trabalho_id=m.trabalho_id), '[]'::jsonb)
  ) INTO resultado
  FROM public.foto_express_montagens m JOIN public.foto_express_trabalhos t ON t.id=m.trabalho_id
  WHERE m.id=_montagem_id;
  RETURN resultado;
END;
$$;

CREATE OR REPLACE FUNCTION public.foto_express_salvar_montagem(
  _trabalho_id uuid, _papel text, _papel_largura_mm numeric, _papel_altura_mm numeric,
  _orientacao_solicitada text, _orientacao_escolhida text,
  _margem_superior_mm numeric, _margem_inferior_mm numeric,
  _margem_esquerda_mm numeric, _margem_direita_mm numeric,
  _espacamento_mm numeric, _permitir_rotacao boolean, _assinatura text,
  _versao_esperada integer, _folhas jsonb
) RETURNS public.foto_express_montagens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  montagem public.foto_express_montagens%ROWTYPE;
  folha jsonb; ocorrencia jsonb; folha_id uuid; quantidade_item integer; manifesto jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.trabalhos.editar') THEN RAISE EXCEPTION 'SEM_PERMISSAO'; END IF;
  PERFORM 1 FROM public.foto_express_trabalhos WHERE id=_trabalho_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRABALHO_NAO_ENCONTRADO'; END IF;
  IF _papel NOT IN ('A4','A3') OR _orientacao_solicitada NOT IN ('AUTOMATICA','RETRATO','PAISAGEM') OR _orientacao_escolhida NOT IN ('RETRATO','PAISAGEM') THEN RAISE EXCEPTION 'CONFIGURACAO_INVALIDA'; END IF;
  IF _papel_largura_mm<=0 OR _papel_altura_mm<=0 OR _margem_superior_mm<0 OR _margem_inferior_mm<0 OR _margem_esquerda_mm<0 OR _margem_direita_mm<0 OR _espacamento_mm<0 OR _papel_largura_mm<=_margem_esquerda_mm+_margem_direita_mm OR _papel_altura_mm<=_margem_superior_mm+_margem_inferior_mm THEN RAISE EXCEPTION 'MEDIDAS_INVALIDAS'; END IF;
  SELECT * INTO montagem FROM public.foto_express_montagens WHERE trabalho_id=_trabalho_id FOR UPDATE;
  IF FOUND AND montagem.versao<>_versao_esperada THEN RAISE EXCEPTION 'MONTAGEM_DESATUALIZADA'; END IF;
  INSERT INTO public.foto_express_montagens (trabalho_id,papel,papel_largura_mm,papel_altura_mm,orientacao_solicitada,orientacao_escolhida,margem_superior_mm,margem_inferior_mm,margem_esquerda_mm,margem_direita_mm,espacamento_mm,permitir_rotacao,assinatura,versao,estado,criado_por,snapshot_confirmado)
  VALUES (_trabalho_id,_papel,_papel_largura_mm,_papel_altura_mm,_orientacao_solicitada,_orientacao_escolhida,_margem_superior_mm,_margem_inferior_mm,_margem_esquerda_mm,_margem_direita_mm,_espacamento_mm,_permitir_rotacao,_assinatura,1,'ATUAL',auth.uid(),NULL)
  ON CONFLICT (trabalho_id) DO UPDATE SET papel=EXCLUDED.papel,papel_largura_mm=EXCLUDED.papel_largura_mm,papel_altura_mm=EXCLUDED.papel_altura_mm,orientacao_solicitada=EXCLUDED.orientacao_solicitada,orientacao_escolhida=EXCLUDED.orientacao_escolhida,margem_superior_mm=EXCLUDED.margem_superior_mm,margem_inferior_mm=EXCLUDED.margem_inferior_mm,margem_esquerda_mm=EXCLUDED.margem_esquerda_mm,margem_direita_mm=EXCLUDED.margem_direita_mm,espacamento_mm=EXCLUDED.espacamento_mm,permitir_rotacao=EXCLUDED.permitir_rotacao,assinatura=EXCLUDED.assinatura,versao=public.foto_express_montagens.versao+1,estado='ATUAL',snapshot_confirmado=NULL
  RETURNING * INTO montagem;
  DELETE FROM public.foto_express_folhas WHERE montagem_id=montagem.id;
  FOR folha IN SELECT * FROM jsonb_array_elements(_folhas) LOOP
    IF (folha->>'numero')::integer<=0 OR (folha->>'larguraMm')::numeric<>_papel_largura_mm OR (folha->>'alturaMm')::numeric<>_papel_altura_mm THEN RAISE EXCEPTION 'FOLHA_INVALIDA'; END IF;
    INSERT INTO public.foto_express_folhas (montagem_id,numero,largura_mm,altura_mm) VALUES (montagem.id,(folha->>'numero')::integer,(folha->>'larguraMm')::numeric,(folha->>'alturaMm')::numeric) RETURNING id INTO folha_id;
    FOR ocorrencia IN SELECT * FROM jsonb_array_elements(folha->'ocorrencias') LOOP
      SELECT quantidade INTO quantidade_item FROM public.foto_express_itens WHERE id=(ocorrencia->>'itemId')::uuid AND trabalho_id=_trabalho_id;
      IF NOT FOUND OR (ocorrencia->>'indiceCopia')::integer<1 OR (ocorrencia->>'indiceCopia')::integer>quantidade_item THEN RAISE EXCEPTION 'OCORRENCIA_INVALIDA'; END IF;
      IF (ocorrencia->>'xMm')::numeric<_margem_esquerda_mm OR (ocorrencia->>'yMm')::numeric<_margem_superior_mm OR (ocorrencia->>'larguraMm')::numeric<=0 OR (ocorrencia->>'alturaMm')::numeric<=0 OR (ocorrencia->>'xMm')::numeric+(ocorrencia->>'larguraMm')::numeric>_papel_largura_mm-_margem_direita_mm OR (ocorrencia->>'yMm')::numeric+(ocorrencia->>'alturaMm')::numeric>_papel_altura_mm-_margem_inferior_mm OR (ocorrencia->>'rotacaoFolha')::integer NOT IN (0,90) THEN RAISE EXCEPTION 'POSICAO_INVALIDA'; END IF;
      INSERT INTO public.foto_express_ocorrencias (folha_id,item_id,indice_copia,x_mm,y_mm,largura_mm,altura_mm,rotacao_folha) VALUES (folha_id,(ocorrencia->>'itemId')::uuid,(ocorrencia->>'indiceCopia')::integer,(ocorrencia->>'xMm')::numeric,(ocorrencia->>'yMm')::numeric,(ocorrencia->>'larguraMm')::numeric,(ocorrencia->>'alturaMm')::numeric,(ocorrencia->>'rotacaoFolha')::integer);
    END LOOP;
  END LOOP;
  manifesto:=public.foto_express_snapshot_montagem(montagem.id);
  UPDATE public.foto_express_montagens SET snapshot_confirmado=manifesto WHERE id=montagem.id RETURNING * INTO montagem;
  RETURN montagem;
END;
$$;

CREATE OR REPLACE FUNCTION public.foto_express_marcar_montagem_desatualizada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE trabalho uuid;
BEGIN
  IF TG_TABLE_NAME='foto_express_itens' THEN trabalho:=COALESCE(NEW.trabalho_id,OLD.trabalho_id);
  ELSIF TG_TABLE_NAME='foto_express_configuracoes' THEN SELECT trabalho_id INTO trabalho FROM public.foto_express_itens WHERE id=COALESCE(NEW.item_id,OLD.item_id);
  ELSIF TG_TABLE_NAME='foto_express_textos' THEN SELECT trabalho_id INTO trabalho FROM public.foto_express_itens WHERE id=COALESCE(NEW.item_id,OLD.item_id);
  END IF;
  IF trabalho IS NOT NULL THEN UPDATE public.foto_express_montagens SET estado='DESATUALIZADA',snapshot_confirmado=NULL WHERE trabalho_id=trabalho; END IF;
  RETURN COALESCE(NEW,OLD);
END;
$$;
CREATE TRIGGER foto_express_itens_invalidar_montagem AFTER INSERT OR UPDATE OR DELETE ON public.foto_express_itens FOR EACH ROW EXECUTE FUNCTION public.foto_express_marcar_montagem_desatualizada();
CREATE TRIGGER foto_express_configuracoes_invalidar_montagem AFTER INSERT OR UPDATE OR DELETE ON public.foto_express_configuracoes FOR EACH ROW EXECUTE FUNCTION public.foto_express_marcar_montagem_desatualizada();
CREATE TRIGGER foto_express_textos_invalidar_montagem AFTER INSERT OR UPDATE OR DELETE ON public.foto_express_textos FOR EACH ROW EXECUTE FUNCTION public.foto_express_marcar_montagem_desatualizada();

CREATE OR REPLACE FUNCTION public.foto_express_iniciar_geracao(_trabalho_id uuid, _saida text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE montagem public.foto_express_montagens%ROWTYPE; geracao_id uuid; folha record; numero_trabalho bigint; prefixo text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.trabalhos.editar') THEN RAISE EXCEPTION 'SEM_PERMISSAO'; END IF;
  IF _saida NOT IN ('PDF','JPG','PDF_JPG') THEN RAISE EXCEPTION 'SAIDA_INVALIDA'; END IF;
  SELECT * INTO montagem FROM public.foto_express_montagens WHERE trabalho_id=_trabalho_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MONTAGEM_NAO_ENCONTRADA'; END IF;
  IF montagem.estado<>'ATUAL' OR montagem.snapshot_confirmado IS NULL THEN RAISE EXCEPTION 'MONTAGEM_DESATUALIZADA'; END IF;
  SELECT numero INTO numero_trabalho FROM public.foto_express_trabalhos WHERE id=_trabalho_id;
  BEGIN
    INSERT INTO public.foto_express_geracoes (trabalho_id,montagem_id,montagem_versao,assinatura,snapshot,saida,estado,etapa,criado_por,iniciado_em)
    VALUES (_trabalho_id,montagem.id,montagem.versao,montagem.assinatura,montagem.snapshot_confirmado,_saida,'PROCESSANDO','PREPARANDO',auth.uid(),now()) RETURNING id INTO geracao_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO geracao_id FROM public.foto_express_geracoes WHERE montagem_id=montagem.id AND montagem_versao=montagem.versao AND saida=_saida AND estado IN ('PENDENTE','PROCESSANDO') ORDER BY criado_em DESC LIMIT 1;
    RETURN geracao_id;
  END;
  prefixo:=_trabalho_id::text||'/'||geracao_id::text||'/';
  IF _saida IN ('JPG','PDF_JPG') THEN FOR folha IN SELECT f.numero FROM public.foto_express_folhas f WHERE f.montagem_id=montagem.id ORDER BY f.numero LOOP
    INSERT INTO public.foto_express_arquivos_impressao (geracao_id,tipo,folha_numero,caminho,nome_arquivo,mime) VALUES (geracao_id,'JPG',folha.numero,prefixo||'folha-'||lpad(folha.numero::text,2,'0')||'.jpg','trabalho-'||lpad(numero_trabalho::text,6,'0')||'-folha-'||lpad(folha.numero::text,2,'0')||'.jpg','image/jpeg');
  END LOOP; END IF;
  IF _saida IN ('PDF','PDF_JPG') THEN INSERT INTO public.foto_express_arquivos_impressao (geracao_id,tipo,folha_numero,caminho,nome_arquivo,mime) VALUES (geracao_id,'PDF',NULL,prefixo||'impressao.pdf','trabalho-'||lpad(numero_trabalho::text,6,'0')||'-impressao.pdf','application/pdf'); END IF;
  RETURN geracao_id;
END;
$$;
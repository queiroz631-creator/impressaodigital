CREATE OR REPLACE FUNCTION public.foto_express_salvar_montagem_por_papeis(
  _trabalho_id uuid,
  _assinatura text,
  _versao_esperada integer,
  _grupos jsonb
) RETURNS public.foto_express_montagens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  montagem public.foto_express_montagens%ROWTYPE;
  papel_config public.foto_express_papeis%ROWTYPE;
  primeiro_papel public.foto_express_papeis%ROWTYPE;
  grupo jsonb; folha jsonb; ocorrencia jsonb; folha_id uuid;
  largura_folha numeric; altura_folha numeric; orientacao_escolhida text;
  quantidade_item integer; manifesto jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.trabalhos.editar') THEN RAISE EXCEPTION 'SEM_PERMISSAO'; END IF;
  PERFORM 1 FROM public.foto_express_trabalhos WHERE id=_trabalho_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRABALHO_NAO_ENCONTRADO'; END IF;
  IF jsonb_typeof(_grupos) <> 'array' OR jsonb_array_length(_grupos) = 0 THEN RAISE EXCEPTION 'GRUPOS_INVALIDOS'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.foto_express_itens i
    LEFT JOIN public.foto_express_formatos f ON f.id=i.formato_id
    WHERE i.trabalho_id=_trabalho_id AND f.id IS NULL
  ) THEN RAISE EXCEPTION 'FORMATO_NAO_ENCONTRADO'; END IF;

  SELECT * INTO primeiro_papel FROM public.foto_express_papeis
  WHERE id=((_grupos->0)->>'papelId')::uuid AND ativo=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAPEL_INATIVO_OU_NAO_ENCONTRADO'; END IF;
  orientacao_escolhida:=(_grupos->0)->>'orientacaoEscolhida';
  IF orientacao_escolhida NOT IN ('RETRATO','PAISAGEM') THEN RAISE EXCEPTION 'CONFIGURACAO_INVALIDA'; END IF;
  largura_folha:=CASE WHEN orientacao_escolhida='PAISAGEM' THEN GREATEST(primeiro_papel.largura_mm,primeiro_papel.altura_mm) ELSE LEAST(primeiro_papel.largura_mm,primeiro_papel.altura_mm) END;
  altura_folha:=CASE WHEN orientacao_escolhida='PAISAGEM' THEN LEAST(primeiro_papel.largura_mm,primeiro_papel.altura_mm) ELSE GREATEST(primeiro_papel.largura_mm,primeiro_papel.altura_mm) END;

  SELECT * INTO montagem FROM public.foto_express_montagens WHERE trabalho_id=_trabalho_id FOR UPDATE;
  IF FOUND AND montagem.versao<>_versao_esperada THEN RAISE EXCEPTION 'MONTAGEM_DESATUALIZADA'; END IF;
  INSERT INTO public.foto_express_montagens (
    trabalho_id,papel,papel_id,papel_nome,papel_largura_mm,papel_altura_mm,
    orientacao_solicitada,orientacao_escolhida,margem_superior_mm,margem_inferior_mm,
    margem_esquerda_mm,margem_direita_mm,espacamento_mm,permitir_rotacao,
    assinatura,versao,estado,criado_por,snapshot_confirmado
  ) VALUES (
    _trabalho_id,CASE WHEN primeiro_papel.codigo IN ('A4','A3') THEN primeiro_papel.codigo ELSE 'A4' END,
    primeiro_papel.id,CASE WHEN jsonb_array_length(_grupos)>1 THEN 'Vários papéis' ELSE primeiro_papel.nome END,
    largura_folha,altura_folha,primeiro_papel.orientacao,orientacao_escolhida,
    primeiro_papel.margem_superior_mm,primeiro_papel.margem_inferior_mm,
    primeiro_papel.margem_esquerda_mm,primeiro_papel.margem_direita_mm,
    primeiro_papel.espacamento_mm,primeiro_papel.permitir_rotacao,
    _assinatura,1,'ATUAL',auth.uid(),NULL
  ) ON CONFLICT (trabalho_id) DO UPDATE SET
    papel=EXCLUDED.papel,papel_id=EXCLUDED.papel_id,papel_nome=EXCLUDED.papel_nome,
    papel_largura_mm=EXCLUDED.papel_largura_mm,papel_altura_mm=EXCLUDED.papel_altura_mm,
    orientacao_solicitada=EXCLUDED.orientacao_solicitada,orientacao_escolhida=EXCLUDED.orientacao_escolhida,
    margem_superior_mm=EXCLUDED.margem_superior_mm,margem_inferior_mm=EXCLUDED.margem_inferior_mm,
    margem_esquerda_mm=EXCLUDED.margem_esquerda_mm,margem_direita_mm=EXCLUDED.margem_direita_mm,
    espacamento_mm=EXCLUDED.espacamento_mm,permitir_rotacao=EXCLUDED.permitir_rotacao,
    assinatura=EXCLUDED.assinatura,versao=public.foto_express_montagens.versao+1,
    estado='ATUAL',snapshot_confirmado=NULL
  RETURNING * INTO montagem;
  DELETE FROM public.foto_express_folhas WHERE montagem_id=montagem.id;

  FOR grupo IN SELECT * FROM jsonb_array_elements(_grupos) LOOP
    SELECT * INTO papel_config FROM public.foto_express_papeis WHERE id=(grupo->>'papelId')::uuid AND ativo=true;
    IF NOT FOUND THEN RAISE EXCEPTION 'PAPEL_INATIVO_OU_NAO_ENCONTRADO'; END IF;
    orientacao_escolhida:=grupo->>'orientacaoEscolhida';
    IF orientacao_escolhida NOT IN ('RETRATO','PAISAGEM') THEN RAISE EXCEPTION 'CONFIGURACAO_INVALIDA'; END IF;
    largura_folha:=CASE WHEN orientacao_escolhida='PAISAGEM' THEN GREATEST(papel_config.largura_mm,papel_config.altura_mm) ELSE LEAST(papel_config.largura_mm,papel_config.altura_mm) END;
    altura_folha:=CASE WHEN orientacao_escolhida='PAISAGEM' THEN LEAST(papel_config.largura_mm,papel_config.altura_mm) ELSE GREATEST(papel_config.largura_mm,papel_config.altura_mm) END;
    FOR folha IN SELECT * FROM jsonb_array_elements(grupo->'folhas') LOOP
      IF (folha->>'numero')::integer<=0 OR (folha->>'larguraMm')::numeric<>largura_folha OR (folha->>'alturaMm')::numeric<>altura_folha THEN RAISE EXCEPTION 'FOLHA_INVALIDA'; END IF;
      INSERT INTO public.foto_express_folhas (montagem_id,numero,largura_mm,altura_mm,papel_id,papel_nome)
      VALUES (montagem.id,(folha->>'numero')::integer,largura_folha,altura_folha,papel_config.id,papel_config.nome)
      RETURNING id INTO folha_id;
      FOR ocorrencia IN SELECT * FROM jsonb_array_elements(folha->'ocorrencias') LOOP
        SELECT i.quantidade INTO quantidade_item
        FROM public.foto_express_itens i
        WHERE i.id=(ocorrencia->>'itemId')::uuid AND i.trabalho_id=_trabalho_id;
        IF NOT FOUND OR (ocorrencia->>'indiceCopia')::integer<1 OR (ocorrencia->>'indiceCopia')::integer>quantidade_item THEN RAISE EXCEPTION 'OCORRENCIA_INVALIDA'; END IF;
        IF (ocorrencia->>'xMm')::numeric<papel_config.margem_esquerda_mm OR (ocorrencia->>'yMm')::numeric<papel_config.margem_superior_mm OR (ocorrencia->>'larguraMm')::numeric<=0 OR (ocorrencia->>'alturaMm')::numeric<=0 OR (ocorrencia->>'xMm')::numeric+(ocorrencia->>'larguraMm')::numeric>largura_folha-papel_config.margem_direita_mm OR (ocorrencia->>'yMm')::numeric+(ocorrencia->>'alturaMm')::numeric>altura_folha-papel_config.margem_inferior_mm OR (ocorrencia->>'rotacaoFolha')::integer NOT IN (0,90) THEN RAISE EXCEPTION 'POSICAO_INVALIDA'; END IF;
        INSERT INTO public.foto_express_ocorrencias (folha_id,item_id,indice_copia,x_mm,y_mm,largura_mm,altura_mm,rotacao_folha)
        VALUES (folha_id,(ocorrencia->>'itemId')::uuid,(ocorrencia->>'indiceCopia')::integer,(ocorrencia->>'xMm')::numeric,(ocorrencia->>'yMm')::numeric,(ocorrencia->>'larguraMm')::numeric,(ocorrencia->>'alturaMm')::numeric,(ocorrencia->>'rotacaoFolha')::integer);
      END LOOP;
    END LOOP;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.foto_express_itens i
    LEFT JOIN (
      SELECT o.item_id,count(*)::integer total
      FROM public.foto_express_ocorrencias o JOIN public.foto_express_folhas f ON f.id=o.folha_id
      WHERE f.montagem_id=montagem.id GROUP BY o.item_id
    ) c ON c.item_id=i.id
    WHERE i.trabalho_id=_trabalho_id AND COALESCE(c.total,0)<>i.quantidade
  ) THEN RAISE EXCEPTION 'COPIAS_INCOMPLETAS'; END IF;

  manifesto:=public.foto_express_snapshot_montagem(montagem.id);
  UPDATE public.foto_express_montagens SET snapshot_confirmado=manifesto WHERE id=montagem.id RETURNING * INTO montagem;
  RETURN montagem;
END;
$$;
REVOKE ALL ON FUNCTION public.foto_express_salvar_montagem_por_papeis(uuid,text,integer,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foto_express_salvar_montagem_por_papeis(uuid,text,integer,jsonb) TO authenticated, service_role;
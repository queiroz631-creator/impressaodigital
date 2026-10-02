ALTER TABLE public.foto_express_formatos
  ADD COLUMN papel_padrao_id uuid REFERENCES public.foto_express_papeis(id) ON DELETE RESTRICT;

UPDATE public.foto_express_formatos f
SET papel_padrao_id = p.id
FROM public.foto_express_papeis p
WHERE f.papel_padrao_id IS NULL
  AND p.codigo = 'A4';

COMMENT ON COLUMN public.foto_express_formatos.papel_padrao_id IS 'Papel padrao usado para agrupar e montar este formato.';
CREATE INDEX foto_express_formatos_papel_padrao_idx ON public.foto_express_formatos(papel_padrao_id);

ALTER TABLE public.foto_express_folhas
  ADD COLUMN papel_id uuid REFERENCES public.foto_express_papeis(id) ON DELETE RESTRICT,
  ADD COLUMN papel_nome text;

UPDATE public.foto_express_folhas f
SET papel_id = m.papel_id,
    papel_nome = m.papel_nome
FROM public.foto_express_montagens m
WHERE m.id = f.montagem_id
  AND f.papel_id IS NULL;

COMMENT ON COLUMN public.foto_express_folhas.papel_nome IS 'Nome imutavel do papel usado nesta folha no momento da confirmacao.';
CREATE INDEX foto_express_folhas_papel_idx ON public.foto_express_folhas(papel_id);

CREATE OR REPLACE FUNCTION public.foto_express_registrar_upload_com_formato(
  _trabalho_id uuid,
  _formato_id uuid,
  _nome_original text,
  _tipo_mime text,
  _tamanho_bytes bigint,
  _largura_px integer,
  _altura_px integer,
  _original_path text,
  _thumbnail_path text,
  _ordem integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  novo_arquivo_id uuid;
  novo_item_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.fotos.enviar') THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;
  IF _tipo_mime NOT IN ('image/jpeg','image/png','image/webp') THEN
    RAISE EXCEPTION 'TIPO_DE_ARQUIVO_INVALIDO';
  END IF;
  PERFORM 1 FROM public.foto_express_trabalhos WHERE id = _trabalho_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRABALHO_NAO_ENCONTRADO'; END IF;
  PERFORM 1 FROM public.foto_express_formatos f
  JOIN public.foto_express_papeis p ON p.id = f.papel_padrao_id AND p.ativo = true
  WHERE f.id = _formato_id AND f.ativo = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORMATO_SEM_PAPEL_PADRAO'; END IF;

  INSERT INTO public.foto_express_arquivos
    (trabalho_id, nome_original, tipo_mime, tamanho_bytes, largura_px, altura_px,
     original_path, thumbnail_path, criado_por)
  VALUES
    (_trabalho_id, _nome_original, _tipo_mime, _tamanho_bytes, _largura_px, _altura_px,
     _original_path, _thumbnail_path, auth.uid())
  RETURNING id INTO novo_arquivo_id;

  INSERT INTO public.foto_express_itens
    (trabalho_id, arquivo_id, formato_id, ordem, quantidade, status_edicao)
  VALUES
    (_trabalho_id, novo_arquivo_id, _formato_id, _ordem, 1, 'CONFIGURADA')
  RETURNING id INTO novo_item_id;
  RETURN novo_item_id;
END;
$$;
REVOKE ALL ON FUNCTION public.foto_express_registrar_upload_com_formato(uuid,uuid,text,text,bigint,integer,integer,text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foto_express_registrar_upload_com_formato(uuid,uuid,text,text,bigint,integer,integer,text,text,integer) TO authenticated, service_role;

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
      'papel_id', f.papel_id, 'papel_nome', f.papel_nome,
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
REVOKE ALL ON FUNCTION public.foto_express_snapshot_montagem(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.foto_express_snapshot_montagem(uuid) TO service_role;

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
  quantidade_item integer; papel_item uuid; manifesto jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.trabalhos.editar') THEN RAISE EXCEPTION 'SEM_PERMISSAO'; END IF;
  PERFORM 1 FROM public.foto_express_trabalhos WHERE id=_trabalho_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRABALHO_NAO_ENCONTRADO'; END IF;
  IF jsonb_typeof(_grupos) <> 'array' OR jsonb_array_length(_grupos) = 0 THEN RAISE EXCEPTION 'GRUPOS_INVALIDOS'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.foto_express_itens i
    LEFT JOIN public.foto_express_formatos f ON f.id=i.formato_id
    LEFT JOIN public.foto_express_papeis p ON p.id=f.papel_padrao_id AND p.ativo=true
    WHERE i.trabalho_id=_trabalho_id AND (f.id IS NULL OR p.id IS NULL)
  ) THEN RAISE EXCEPTION 'FORMATO_SEM_PAPEL_PADRAO'; END IF;

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
        SELECT i.quantidade,f.papel_padrao_id INTO quantidade_item,papel_item
        FROM public.foto_express_itens i JOIN public.foto_express_formatos f ON f.id=i.formato_id
        WHERE i.id=(ocorrencia->>'itemId')::uuid AND i.trabalho_id=_trabalho_id;
        IF NOT FOUND OR papel_item<>papel_config.id OR (ocorrencia->>'indiceCopia')::integer<1 OR (ocorrencia->>'indiceCopia')::integer>quantidade_item THEN RAISE EXCEPTION 'OCORRENCIA_INVALIDA'; END IF;
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
CREATE TABLE public.foto_express_papeis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  largura_mm numeric(12,3) NOT NULL CHECK (largura_mm > 0),
  altura_mm numeric(12,3) NOT NULL CHECK (altura_mm > 0),
  orientacao text NOT NULL DEFAULT 'AUTOMATICA' CHECK (orientacao IN ('AUTOMATICA','RETRATO','PAISAGEM')),
  margem_superior_mm numeric(12,3) NOT NULL DEFAULT 5 CHECK (margem_superior_mm >= 0),
  margem_inferior_mm numeric(12,3) NOT NULL DEFAULT 5 CHECK (margem_inferior_mm >= 0),
  margem_esquerda_mm numeric(12,3) NOT NULL DEFAULT 5 CHECK (margem_esquerda_mm >= 0),
  margem_direita_mm numeric(12,3) NOT NULL DEFAULT 5 CHECK (margem_direita_mm >= 0),
  espacamento_mm numeric(12,3) NOT NULL DEFAULT 2 CHECK (espacamento_mm >= 0),
  permitir_rotacao boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT foto_express_papeis_area_util_check CHECK (
    largura_mm > margem_esquerda_mm + margem_direita_mm
    AND altura_mm > margem_superior_mm + margem_inferior_mm
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.foto_express_papeis TO authenticated;
GRANT ALL ON public.foto_express_papeis TO service_role;
ALTER TABLE public.foto_express_papeis ENABLE ROW LEVEL SECURITY;
CREATE POLICY foto_express_papeis_select ON public.foto_express_papeis FOR SELECT TO authenticated USING (public.pode_foto_express());
CREATE POLICY foto_express_papeis_manage ON public.foto_express_papeis FOR ALL TO authenticated USING (public.pode_foto_express('foto_express.formatos.gerenciar')) WITH CHECK (public.pode_foto_express('foto_express.formatos.gerenciar'));
CREATE TRIGGER foto_express_papeis_atualizado_em BEFORE UPDATE ON public.foto_express_papeis FOR EACH ROW EXECUTE FUNCTION public.foto_express_set_atualizado_em();

INSERT INTO public.foto_express_papeis (codigo,nome,largura_mm,altura_mm,orientacao,margem_superior_mm,margem_inferior_mm,margem_esquerda_mm,margem_direita_mm,espacamento_mm,permitir_rotacao,ativo,ordem)
VALUES
  ('A4','A4',210,297,'AUTOMATICA',5,5,5,5,2,true,true,10),
  ('A3','A3',297,420,'AUTOMATICA',5,5,5,5,2,true,true,20)
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE public.foto_express_montagens
  ADD COLUMN papel_id uuid REFERENCES public.foto_express_papeis(id) ON DELETE RESTRICT,
  ADD COLUMN papel_nome text;
UPDATE public.foto_express_montagens m
SET papel_id=p.id, papel_nome=p.nome
FROM public.foto_express_papeis p
WHERE p.codigo=m.papel;
COMMENT ON COLUMN public.foto_express_montagens.papel IS 'DEPRECATED: identificador legado A4/A3; use papel_id e papel_nome.';
COMMENT ON COLUMN public.foto_express_montagens.papel_nome IS 'Nome imutavel do papel no momento da confirmacao da montagem.';
CREATE INDEX foto_express_montagens_papel_idx ON public.foto_express_montagens(papel_id);

CREATE OR REPLACE FUNCTION public.foto_express_salvar_montagem_com_papel(
  _trabalho_id uuid, _papel_id uuid, _orientacao_escolhida text,
  _assinatura text, _versao_esperada integer, _folhas jsonb
) RETURNS public.foto_express_montagens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  papel_config public.foto_express_papeis%ROWTYPE;
  montagem public.foto_express_montagens%ROWTYPE;
  folha jsonb; ocorrencia jsonb; folha_id uuid; quantidade_item integer; manifesto jsonb;
  largura_folha numeric; altura_folha numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.trabalhos.editar') THEN RAISE EXCEPTION 'SEM_PERMISSAO'; END IF;
  PERFORM 1 FROM public.foto_express_trabalhos WHERE id=_trabalho_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRABALHO_NAO_ENCONTRADO'; END IF;
  SELECT * INTO papel_config FROM public.foto_express_papeis WHERE id=_papel_id AND ativo=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAPEL_INATIVO_OU_NAO_ENCONTRADO'; END IF;
  IF _orientacao_escolhida NOT IN ('RETRATO','PAISAGEM') THEN RAISE EXCEPTION 'CONFIGURACAO_INVALIDA'; END IF;
  largura_folha:=CASE WHEN _orientacao_escolhida='PAISAGEM' THEN GREATEST(papel_config.largura_mm,papel_config.altura_mm) ELSE LEAST(papel_config.largura_mm,papel_config.altura_mm) END;
  altura_folha:=CASE WHEN _orientacao_escolhida='PAISAGEM' THEN LEAST(papel_config.largura_mm,papel_config.altura_mm) ELSE GREATEST(papel_config.largura_mm,papel_config.altura_mm) END;
  SELECT * INTO montagem FROM public.foto_express_montagens WHERE trabalho_id=_trabalho_id FOR UPDATE;
  IF FOUND AND montagem.versao<>_versao_esperada THEN RAISE EXCEPTION 'MONTAGEM_DESATUALIZADA'; END IF;
  INSERT INTO public.foto_express_montagens (
    trabalho_id,papel,papel_id,papel_nome,papel_largura_mm,papel_altura_mm,
    orientacao_solicitada,orientacao_escolhida,margem_superior_mm,margem_inferior_mm,
    margem_esquerda_mm,margem_direita_mm,espacamento_mm,permitir_rotacao,
    assinatura,versao,estado,criado_por,snapshot_confirmado
  ) VALUES (
    _trabalho_id,CASE WHEN papel_config.codigo IN ('A4','A3') THEN papel_config.codigo ELSE 'A4' END,
    papel_config.id,papel_config.nome,largura_folha,altura_folha,
    papel_config.orientacao,_orientacao_escolhida,papel_config.margem_superior_mm,papel_config.margem_inferior_mm,
    papel_config.margem_esquerda_mm,papel_config.margem_direita_mm,papel_config.espacamento_mm,papel_config.permitir_rotacao,
    _assinatura,1,'ATUAL',auth.uid(),NULL
  )
  ON CONFLICT (trabalho_id) DO UPDATE SET
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
  FOR folha IN SELECT * FROM jsonb_array_elements(_folhas) LOOP
    IF (folha->>'numero')::integer<=0 OR (folha->>'larguraMm')::numeric<>largura_folha OR (folha->>'alturaMm')::numeric<>altura_folha THEN RAISE EXCEPTION 'FOLHA_INVALIDA'; END IF;
    INSERT INTO public.foto_express_folhas (montagem_id,numero,largura_mm,altura_mm)
    VALUES (montagem.id,(folha->>'numero')::integer,(folha->>'larguraMm')::numeric,(folha->>'alturaMm')::numeric)
    RETURNING id INTO folha_id;
    FOR ocorrencia IN SELECT * FROM jsonb_array_elements(folha->'ocorrencias') LOOP
      SELECT quantidade INTO quantidade_item FROM public.foto_express_itens WHERE id=(ocorrencia->>'itemId')::uuid AND trabalho_id=_trabalho_id;
      IF NOT FOUND OR (ocorrencia->>'indiceCopia')::integer<1 OR (ocorrencia->>'indiceCopia')::integer>quantidade_item THEN RAISE EXCEPTION 'OCORRENCIA_INVALIDA'; END IF;
      IF (ocorrencia->>'xMm')::numeric<papel_config.margem_esquerda_mm OR (ocorrencia->>'yMm')::numeric<papel_config.margem_superior_mm OR (ocorrencia->>'larguraMm')::numeric<=0 OR (ocorrencia->>'alturaMm')::numeric<=0 OR (ocorrencia->>'xMm')::numeric+(ocorrencia->>'larguraMm')::numeric>largura_folha-papel_config.margem_direita_mm OR (ocorrencia->>'yMm')::numeric+(ocorrencia->>'alturaMm')::numeric>altura_folha-papel_config.margem_inferior_mm OR (ocorrencia->>'rotacaoFolha')::integer NOT IN (0,90) THEN RAISE EXCEPTION 'POSICAO_INVALIDA'; END IF;
      INSERT INTO public.foto_express_ocorrencias (folha_id,item_id,indice_copia,x_mm,y_mm,largura_mm,altura_mm,rotacao_folha)
      VALUES (folha_id,(ocorrencia->>'itemId')::uuid,(ocorrencia->>'indiceCopia')::integer,(ocorrencia->>'xMm')::numeric,(ocorrencia->>'yMm')::numeric,(ocorrencia->>'larguraMm')::numeric,(ocorrencia->>'alturaMm')::numeric,(ocorrencia->>'rotacaoFolha')::integer);
    END LOOP;
  END LOOP;
  manifesto:=public.foto_express_snapshot_montagem(montagem.id);
  UPDATE public.foto_express_montagens SET snapshot_confirmado=manifesto WHERE id=montagem.id RETURNING * INTO montagem;
  RETURN montagem;
END;
$$;
REVOKE ALL ON FUNCTION public.foto_express_salvar_montagem_com_papel(uuid,uuid,text,text,integer,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foto_express_salvar_montagem_com_papel(uuid,uuid,text,text,integer,jsonb) TO authenticated, service_role;
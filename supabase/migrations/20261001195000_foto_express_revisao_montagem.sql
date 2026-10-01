ALTER TABLE public.foto_express_formatos
  ADD COLUMN area_foto_x numeric(12,6) NOT NULL DEFAULT 0,
  ADD COLUMN area_foto_y numeric(12,6) NOT NULL DEFAULT 0,
  ADD COLUMN area_foto_largura numeric(12,6) NOT NULL DEFAULT 1,
  ADD COLUMN area_foto_altura numeric(12,6) NOT NULL DEFAULT 1,
  ADD COLUMN cor_fundo text NOT NULL DEFAULT '#FFFFFF';

ALTER TABLE public.foto_express_formatos
  ADD CONSTRAINT foto_express_formatos_area_foto_check CHECK (
    area_foto_x >= 0 AND area_foto_y >= 0
    AND area_foto_largura > 0 AND area_foto_altura > 0
    AND area_foto_x + area_foto_largura <= 1
    AND area_foto_y + area_foto_altura <= 1
  ),
  ADD CONSTRAINT foto_express_formatos_cor_fundo_check CHECK (cor_fundo ~ '^#[0-9A-Fa-f]{6}$');

COMMENT ON COLUMN public.foto_express_formatos.area_foto_x IS 'Origem X normalizada da area interna da fotografia sobre a peca externa.';
COMMENT ON COLUMN public.foto_express_formatos.area_foto_y IS 'Origem Y normalizada da area interna da fotografia sobre a peca externa.';
COMMENT ON COLUMN public.foto_express_formatos.area_foto_largura IS 'Largura normalizada da area interna da fotografia sobre a peca externa.';
COMMENT ON COLUMN public.foto_express_formatos.area_foto_altura IS 'Altura normalizada da area interna da fotografia sobre a peca externa.';

CREATE TABLE public.foto_express_montagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trabalho_id uuid NOT NULL UNIQUE REFERENCES public.foto_express_trabalhos(id) ON DELETE CASCADE,
  papel text NOT NULL CHECK (papel IN ('A4','A3')),
  papel_largura_mm numeric(12,3) NOT NULL CHECK (papel_largura_mm > 0),
  papel_altura_mm numeric(12,3) NOT NULL CHECK (papel_altura_mm > 0),
  orientacao_solicitada text NOT NULL CHECK (orientacao_solicitada IN ('AUTOMATICA','RETRATO','PAISAGEM')),
  orientacao_escolhida text NOT NULL CHECK (orientacao_escolhida IN ('RETRATO','PAISAGEM')),
  margem_superior_mm numeric(12,3) NOT NULL DEFAULT 5 CHECK (margem_superior_mm >= 0),
  margem_inferior_mm numeric(12,3) NOT NULL DEFAULT 5 CHECK (margem_inferior_mm >= 0),
  margem_esquerda_mm numeric(12,3) NOT NULL DEFAULT 5 CHECK (margem_esquerda_mm >= 0),
  margem_direita_mm numeric(12,3) NOT NULL DEFAULT 5 CHECK (margem_direita_mm >= 0),
  espacamento_mm numeric(12,3) NOT NULL DEFAULT 2 CHECK (espacamento_mm >= 0),
  permitir_rotacao boolean NOT NULL DEFAULT true,
  assinatura text NOT NULL,
  versao integer NOT NULL DEFAULT 1 CHECK (versao > 0),
  estado text NOT NULL DEFAULT 'ATUAL' CHECK (estado IN ('ATUAL','DESATUALIZADA')),
  criado_por uuid NOT NULL DEFAULT auth.uid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.foto_express_montagens TO authenticated;
GRANT ALL ON public.foto_express_montagens TO service_role;
ALTER TABLE public.foto_express_montagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY foto_express_montagens_select ON public.foto_express_montagens FOR SELECT TO authenticated USING (public.pode_foto_express());
CREATE POLICY foto_express_montagens_write ON public.foto_express_montagens FOR ALL TO authenticated USING (public.pode_foto_express('foto_express.trabalhos.editar')) WITH CHECK (public.pode_foto_express('foto_express.trabalhos.editar'));
CREATE TRIGGER foto_express_montagens_updated_at BEFORE UPDATE ON public.foto_express_montagens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.foto_express_folhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  montagem_id uuid NOT NULL REFERENCES public.foto_express_montagens(id) ON DELETE CASCADE,
  numero integer NOT NULL CHECK (numero > 0),
  largura_mm numeric(12,3) NOT NULL CHECK (largura_mm > 0),
  altura_mm numeric(12,3) NOT NULL CHECK (altura_mm > 0),
  UNIQUE (montagem_id, numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.foto_express_folhas TO authenticated;
GRANT ALL ON public.foto_express_folhas TO service_role;
ALTER TABLE public.foto_express_folhas ENABLE ROW LEVEL SECURITY;
CREATE POLICY foto_express_folhas_select ON public.foto_express_folhas FOR SELECT TO authenticated USING (public.pode_foto_express());
CREATE POLICY foto_express_folhas_write ON public.foto_express_folhas FOR ALL TO authenticated USING (public.pode_foto_express('foto_express.trabalhos.editar')) WITH CHECK (public.pode_foto_express('foto_express.trabalhos.editar'));
CREATE INDEX foto_express_folhas_montagem_idx ON public.foto_express_folhas (montagem_id, numero);

CREATE TABLE public.foto_express_ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folha_id uuid NOT NULL REFERENCES public.foto_express_folhas(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.foto_express_itens(id) ON DELETE RESTRICT,
  indice_copia integer NOT NULL CHECK (indice_copia > 0),
  x_mm numeric(12,3) NOT NULL CHECK (x_mm >= 0),
  y_mm numeric(12,3) NOT NULL CHECK (y_mm >= 0),
  largura_mm numeric(12,3) NOT NULL CHECK (largura_mm > 0),
  altura_mm numeric(12,3) NOT NULL CHECK (altura_mm > 0),
  rotacao_folha integer NOT NULL DEFAULT 0 CHECK (rotacao_folha IN (0,90)),
  UNIQUE (folha_id, item_id, indice_copia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.foto_express_ocorrencias TO authenticated;
GRANT ALL ON public.foto_express_ocorrencias TO service_role;
ALTER TABLE public.foto_express_ocorrencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY foto_express_ocorrencias_select ON public.foto_express_ocorrencias FOR SELECT TO authenticated USING (public.pode_foto_express());
CREATE POLICY foto_express_ocorrencias_write ON public.foto_express_ocorrencias FOR ALL TO authenticated USING (public.pode_foto_express('foto_express.trabalhos.editar')) WITH CHECK (public.pode_foto_express('foto_express.trabalhos.editar'));
CREATE INDEX foto_express_ocorrencias_folha_idx ON public.foto_express_ocorrencias (folha_id, y_mm, x_mm);
CREATE INDEX foto_express_ocorrencias_item_idx ON public.foto_express_ocorrencias (item_id);

CREATE OR REPLACE FUNCTION public.foto_express_salvar_montagem(
  _trabalho_id uuid,
  _papel text,
  _papel_largura_mm numeric,
  _papel_altura_mm numeric,
  _orientacao_solicitada text,
  _orientacao_escolhida text,
  _margem_superior_mm numeric,
  _margem_inferior_mm numeric,
  _margem_esquerda_mm numeric,
  _margem_direita_mm numeric,
  _espacamento_mm numeric,
  _permitir_rotacao boolean,
  _assinatura text,
  _versao_esperada integer,
  _folhas jsonb
) RETURNS public.foto_express_montagens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  montagem public.foto_express_montagens%ROWTYPE;
  folha jsonb;
  ocorrencia jsonb;
  folha_id uuid;
  quantidade_item integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.trabalhos.editar') THEN RAISE EXCEPTION 'SEM_PERMISSAO'; END IF;
  PERFORM 1 FROM public.foto_express_trabalhos WHERE id = _trabalho_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRABALHO_NAO_ENCONTRADO'; END IF;
  IF _papel NOT IN ('A4','A3') OR _orientacao_solicitada NOT IN ('AUTOMATICA','RETRATO','PAISAGEM') OR _orientacao_escolhida NOT IN ('RETRATO','PAISAGEM') THEN RAISE EXCEPTION 'CONFIGURACAO_INVALIDA'; END IF;
  IF _papel_largura_mm <= 0 OR _papel_altura_mm <= 0 OR _margem_superior_mm < 0 OR _margem_inferior_mm < 0 OR _margem_esquerda_mm < 0 OR _margem_direita_mm < 0 OR _espacamento_mm < 0 OR _papel_largura_mm <= _margem_esquerda_mm + _margem_direita_mm OR _papel_altura_mm <= _margem_superior_mm + _margem_inferior_mm THEN RAISE EXCEPTION 'MEDIDAS_INVALIDAS'; END IF;
  SELECT * INTO montagem FROM public.foto_express_montagens WHERE trabalho_id = _trabalho_id FOR UPDATE;
  IF FOUND AND montagem.versao <> _versao_esperada THEN RAISE EXCEPTION 'MONTAGEM_DESATUALIZADA'; END IF;
  INSERT INTO public.foto_express_montagens (trabalho_id, papel, papel_largura_mm, papel_altura_mm, orientacao_solicitada, orientacao_escolhida, margem_superior_mm, margem_inferior_mm, margem_esquerda_mm, margem_direita_mm, espacamento_mm, permitir_rotacao, assinatura, versao, estado, criado_por)
  VALUES (_trabalho_id, _papel, _papel_largura_mm, _papel_altura_mm, _orientacao_solicitada, _orientacao_escolhida, _margem_superior_mm, _margem_inferior_mm, _margem_esquerda_mm, _margem_direita_mm, _espacamento_mm, _permitir_rotacao, _assinatura, 1, 'ATUAL', auth.uid())
  ON CONFLICT (trabalho_id) DO UPDATE SET papel=EXCLUDED.papel, papel_largura_mm=EXCLUDED.papel_largura_mm, papel_altura_mm=EXCLUDED.papel_altura_mm, orientacao_solicitada=EXCLUDED.orientacao_solicitada, orientacao_escolhida=EXCLUDED.orientacao_escolhida, margem_superior_mm=EXCLUDED.margem_superior_mm, margem_inferior_mm=EXCLUDED.margem_inferior_mm, margem_esquerda_mm=EXCLUDED.margem_esquerda_mm, margem_direita_mm=EXCLUDED.margem_direita_mm, espacamento_mm=EXCLUDED.espacamento_mm, permitir_rotacao=EXCLUDED.permitir_rotacao, assinatura=EXCLUDED.assinatura, versao=public.foto_express_montagens.versao+1, estado='ATUAL'
  RETURNING * INTO montagem;
  DELETE FROM public.foto_express_folhas WHERE montagem_id = montagem.id;
  FOR folha IN SELECT * FROM jsonb_array_elements(_folhas) LOOP
    IF (folha->>'numero')::integer <= 0 OR (folha->>'larguraMm')::numeric <> _papel_largura_mm OR (folha->>'alturaMm')::numeric <> _papel_altura_mm THEN RAISE EXCEPTION 'FOLHA_INVALIDA'; END IF;
    INSERT INTO public.foto_express_folhas (montagem_id, numero, largura_mm, altura_mm) VALUES (montagem.id, (folha->>'numero')::integer, (folha->>'larguraMm')::numeric, (folha->>'alturaMm')::numeric) RETURNING id INTO folha_id;
    FOR ocorrencia IN SELECT * FROM jsonb_array_elements(folha->'ocorrencias') LOOP
      SELECT quantidade INTO quantidade_item FROM public.foto_express_itens WHERE id=(ocorrencia->>'itemId')::uuid AND trabalho_id=_trabalho_id;
      IF NOT FOUND OR (ocorrencia->>'indiceCopia')::integer < 1 OR (ocorrencia->>'indiceCopia')::integer > quantidade_item THEN RAISE EXCEPTION 'OCORRENCIA_INVALIDA'; END IF;
      IF (ocorrencia->>'xMm')::numeric < _margem_esquerda_mm OR (ocorrencia->>'yMm')::numeric < _margem_superior_mm OR (ocorrencia->>'larguraMm')::numeric <= 0 OR (ocorrencia->>'alturaMm')::numeric <= 0 OR (ocorrencia->>'xMm')::numeric + (ocorrencia->>'larguraMm')::numeric > _papel_largura_mm - _margem_direita_mm OR (ocorrencia->>'yMm')::numeric + (ocorrencia->>'alturaMm')::numeric > _papel_altura_mm - _margem_inferior_mm OR (ocorrencia->>'rotacaoFolha')::integer NOT IN (0,90) THEN RAISE EXCEPTION 'POSICAO_INVALIDA'; END IF;
      INSERT INTO public.foto_express_ocorrencias (folha_id,item_id,indice_copia,x_mm,y_mm,largura_mm,altura_mm,rotacao_folha) VALUES (folha_id,(ocorrencia->>'itemId')::uuid,(ocorrencia->>'indiceCopia')::integer,(ocorrencia->>'xMm')::numeric,(ocorrencia->>'yMm')::numeric,(ocorrencia->>'larguraMm')::numeric,(ocorrencia->>'alturaMm')::numeric,(ocorrencia->>'rotacaoFolha')::integer);
    END LOOP;
  END LOOP;
  RETURN montagem;
END;
$$;
REVOKE ALL ON FUNCTION public.foto_express_salvar_montagem(uuid,text,numeric,numeric,text,text,numeric,numeric,numeric,numeric,numeric,boolean,text,integer,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foto_express_salvar_montagem(uuid,text,numeric,numeric,text,text,numeric,numeric,numeric,numeric,numeric,boolean,text,integer,jsonb) TO authenticated, service_role;
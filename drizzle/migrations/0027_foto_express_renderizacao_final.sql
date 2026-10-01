ALTER TABLE public.foto_express_montagens
  ADD COLUMN snapshot_confirmado jsonb;
COMMENT ON COLUMN public.foto_express_montagens.snapshot_confirmado IS 'Snapshot canonico imutavel da montagem confirmada; montagens legadas sem snapshot devem ser confirmadas novamente.';

CREATE TABLE public.foto_express_geracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trabalho_id uuid NOT NULL REFERENCES public.foto_express_trabalhos(id) ON DELETE CASCADE,
  montagem_id uuid NOT NULL REFERENCES public.foto_express_montagens(id) ON DELETE RESTRICT,
  montagem_versao integer NOT NULL CHECK (montagem_versao > 0),
  assinatura text NOT NULL,
  snapshot jsonb NOT NULL,
  saida text NOT NULL CHECK (saida IN ('PDF','JPG','PDF_JPG')),
  dpi integer NOT NULL DEFAULT 300 CHECK (dpi = 300),
  estado text NOT NULL DEFAULT 'PENDENTE' CHECK (estado IN ('PENDENTE','PROCESSANDO','CONCLUIDA','ERRO')),
  etapa text NOT NULL DEFAULT 'PREPARANDO',
  erro text,
  criado_por uuid NOT NULL DEFAULT auth.uid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  iniciado_em timestamptz,
  concluido_em timestamptz,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.foto_express_geracoes TO authenticated;
GRANT ALL ON public.foto_express_geracoes TO service_role;
ALTER TABLE public.foto_express_geracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY foto_express_geracoes_select ON public.foto_express_geracoes FOR SELECT TO authenticated USING (public.pode_foto_express());
CREATE POLICY foto_express_geracoes_write ON public.foto_express_geracoes FOR ALL TO authenticated USING (public.pode_foto_express('foto_express.trabalhos.editar')) WITH CHECK (public.pode_foto_express('foto_express.trabalhos.editar'));
CREATE INDEX foto_express_geracoes_trabalho_idx ON public.foto_express_geracoes (trabalho_id, criado_em DESC);
CREATE UNIQUE INDEX foto_express_geracoes_ativa_idx ON public.foto_express_geracoes (montagem_id, montagem_versao, saida) WHERE estado IN ('PENDENTE','PROCESSANDO');
CREATE TRIGGER foto_express_geracoes_updated_at BEFORE UPDATE ON public.foto_express_geracoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.foto_express_arquivos_impressao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geracao_id uuid NOT NULL REFERENCES public.foto_express_geracoes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('PDF','JPG')),
  folha_numero integer CHECK (folha_numero IS NULL OR folha_numero > 0),
  bucket text NOT NULL DEFAULT 'foto-express-impressoes' CHECK (bucket = 'foto-express-impressoes'),
  caminho text NOT NULL UNIQUE,
  nome_arquivo text NOT NULL,
  mime text NOT NULL CHECK (mime IN ('application/pdf','image/jpeg')),
  tamanho_bytes bigint CHECK (tamanho_bytes IS NULL OR tamanho_bytes > 0),
  largura_px integer CHECK (largura_px IS NULL OR largura_px > 0),
  altura_px integer CHECK (altura_px IS NULL OR altura_px > 0),
  paginas integer CHECK (paginas IS NULL OR paginas > 0),
  dpi integer NOT NULL DEFAULT 300 CHECK (dpi = 300),
  estado text NOT NULL DEFAULT 'ESPERADO' CHECK (estado IN ('ESPERADO','ENVIADO','VALIDADO')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (geracao_id, tipo, folha_numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.foto_express_arquivos_impressao TO authenticated;
GRANT ALL ON public.foto_express_arquivos_impressao TO service_role;
ALTER TABLE public.foto_express_arquivos_impressao ENABLE ROW LEVEL SECURITY;
CREATE POLICY foto_express_arquivos_impressao_select ON public.foto_express_arquivos_impressao FOR SELECT TO authenticated USING (public.pode_foto_express());
CREATE POLICY foto_express_arquivos_impressao_write ON public.foto_express_arquivos_impressao FOR ALL TO authenticated USING (public.pode_foto_express('foto_express.trabalhos.editar')) WITH CHECK (public.pode_foto_express('foto_express.trabalhos.editar'));
CREATE INDEX foto_express_arquivos_impressao_geracao_idx ON public.foto_express_arquivos_impressao (geracao_id, folha_numero);

CREATE OR REPLACE FUNCTION public.foto_express_snapshot_montagem(_montagem_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'versao_manifesto', 1,
    'montagem', to_jsonb(m) - 'snapshot_confirmado',
    'trabalho', jsonb_build_object('id', t.id, 'numero', t.numero),
    'folhas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', f.id, 'numero', f.numero, 'largura_mm', f.largura_mm, 'altura_mm', f.altura_mm,
        'ocorrencias', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', o.id, 'item_id', o.item_id, 'indice_copia', o.indice_copia,
            'x_mm', o.x_mm, 'y_mm', o.y_mm, 'largura_mm', o.largura_mm,
            'altura_mm', o.altura_mm, 'rotacao_folha', o.rotacao_folha
          ) ORDER BY o.y_mm, o.x_mm, o.item_id, o.indice_copia)
          FROM public.foto_express_ocorrencias o WHERE o.folha_id = f.id
        ), '[]'::jsonb)
      ) ORDER BY f.numero) FROM public.foto_express_folhas f WHERE f.montagem_id = m.id
    ), '[]'::jsonb),
    'itens', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'item', to_jsonb(i), 'arquivo', to_jsonb(a), 'formato', to_jsonb(fo),
        'configuracao', to_jsonb(c),
        'textos', COALESCE((SELECT jsonb_agg(to_jsonb(tx) ORDER BY tx.ordem, tx.id) FROM public.foto_express_textos tx WHERE tx.item_id = i.id), '[]'::jsonb)
      ) ORDER BY i.ordem, i.id)
      FROM public.foto_express_itens i
      JOIN public.foto_express_arquivos a ON a.id = i.arquivo_id AND a.trabalho_id = i.trabalho_id
      JOIN public.foto_express_formatos fo ON fo.id = i.formato_id
      JOIN public.foto_express_configuracoes c ON c.item_id = i.id
      WHERE i.trabalho_id = m.trabalho_id
    ), '[]'::jsonb)
  )
  FROM public.foto_express_montagens m
  JOIN public.foto_express_trabalhos t ON t.id = m.trabalho_id
  WHERE m.id = _montagem_id
$$;
REVOKE ALL ON FUNCTION public.foto_express_snapshot_montagem(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foto_express_snapshot_montagem(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.foto_express_iniciar_geracao(_trabalho_id uuid, _saida text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  montagem public.foto_express_montagens%ROWTYPE;
  geracao_id uuid;
  manifesto jsonb;
  folha record;
  numero_trabalho bigint;
  prefixo text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.trabalhos.editar') THEN RAISE EXCEPTION 'SEM_PERMISSAO'; END IF;
  IF _saida NOT IN ('PDF','JPG','PDF_JPG') THEN RAISE EXCEPTION 'SAIDA_INVALIDA'; END IF;
  SELECT * INTO montagem FROM public.foto_express_montagens WHERE trabalho_id = _trabalho_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MONTAGEM_NAO_ENCONTRADA'; END IF;
  IF montagem.estado <> 'ATUAL' THEN RAISE EXCEPTION 'MONTAGEM_DESATUALIZADA'; END IF;
  SELECT numero INTO numero_trabalho FROM public.foto_express_trabalhos WHERE id = _trabalho_id;
  manifesto := public.foto_express_snapshot_montagem(montagem.id);
  IF jsonb_array_length(manifesto->'folhas') = 0 OR jsonb_array_length(manifesto->'itens') = 0 THEN RAISE EXCEPTION 'MONTAGEM_INCOMPLETA'; END IF;
  UPDATE public.foto_express_montagens SET snapshot_confirmado = manifesto WHERE id = montagem.id;
  BEGIN
    INSERT INTO public.foto_express_geracoes (trabalho_id,montagem_id,montagem_versao,assinatura,snapshot,saida,estado,etapa,criado_por,iniciado_em)
    VALUES (_trabalho_id,montagem.id,montagem.versao,montagem.assinatura,manifesto,_saida,'PROCESSANDO','PREPARANDO',auth.uid(),now()) RETURNING id INTO geracao_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO geracao_id FROM public.foto_express_geracoes WHERE montagem_id=montagem.id AND montagem_versao=montagem.versao AND saida=_saida AND estado IN ('PENDENTE','PROCESSANDO') ORDER BY criado_em DESC LIMIT 1;
    RETURN geracao_id;
  END;
  prefixo := _trabalho_id::text || '/' || geracao_id::text || '/';
  IF _saida IN ('JPG','PDF_JPG') THEN
    FOR folha IN SELECT f.numero FROM public.foto_express_folhas f WHERE f.montagem_id=montagem.id ORDER BY f.numero LOOP
      INSERT INTO public.foto_express_arquivos_impressao (geracao_id,tipo,folha_numero,caminho,nome_arquivo,mime)
      VALUES (geracao_id,'JPG',folha.numero,prefixo || 'folha-' || lpad(folha.numero::text,2,'0') || '.jpg','trabalho-' || lpad(numero_trabalho::text,6,'0') || '-folha-' || lpad(folha.numero::text,2,'0') || '.jpg','image/jpeg');
    END LOOP;
  END IF;
  IF _saida IN ('PDF','PDF_JPG') THEN
    INSERT INTO public.foto_express_arquivos_impressao (geracao_id,tipo,folha_numero,caminho,nome_arquivo,mime)
    VALUES (geracao_id,'PDF',NULL,prefixo || 'impressao.pdf','trabalho-' || lpad(numero_trabalho::text,6,'0') || '-impressao.pdf','application/pdf');
  END IF;
  RETURN geracao_id;
END;
$$;
REVOKE ALL ON FUNCTION public.foto_express_iniciar_geracao(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foto_express_iniciar_geracao(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.foto_express_atualizar_geracao(_geracao_id uuid, _etapa text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.trabalhos.editar') THEN RAISE EXCEPTION 'SEM_PERMISSAO'; END IF;
  UPDATE public.foto_express_geracoes SET etapa=left(_etapa,100) WHERE id=_geracao_id AND criado_por=auth.uid() AND estado='PROCESSANDO';
  IF NOT FOUND THEN RAISE EXCEPTION 'GERACAO_INVALIDA'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.foto_express_atualizar_geracao(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foto_express_atualizar_geracao(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.foto_express_falhar_geracao(_geracao_id uuid, _erro text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.trabalhos.editar') THEN RAISE EXCEPTION 'SEM_PERMISSAO'; END IF;
  UPDATE public.foto_express_geracoes SET estado='ERRO',etapa='ERRO',erro=left(_erro,1000),concluido_em=now() WHERE id=_geracao_id AND criado_por=auth.uid() AND estado IN ('PENDENTE','PROCESSANDO');
  IF NOT FOUND THEN RAISE EXCEPTION 'GERACAO_INVALIDA'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.foto_express_falhar_geracao(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foto_express_falhar_geracao(uuid,text) TO authenticated, service_role;
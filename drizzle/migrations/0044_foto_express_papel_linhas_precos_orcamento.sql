ALTER TABLE public.foto_express_papeis
  ADD COLUMN linha_espacamento_ativa boolean NOT NULL DEFAULT false,
  ADD COLUMN linha_cor text NOT NULL DEFAULT '#000000' CHECK (linha_cor ~ '^#[0-9A-Fa-f]{6}$'),
  ADD COLUMN linha_espessura_mm numeric(8,3) NOT NULL DEFAULT 0.2 CHECK (linha_espessura_mm > 0),
  ADD COLUMN valor_folha numeric(12,2) NOT NULL DEFAULT 0 CHECK (valor_folha >= 0),
  ADD COLUMN faixas_valor jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(faixas_valor) = 'array');

ALTER TABLE public.foto_express_folhas
  ADD COLUMN linha_espacamento_ativa boolean NOT NULL DEFAULT false,
  ADD COLUMN linha_cor text NOT NULL DEFAULT '#000000' CHECK (linha_cor ~ '^#[0-9A-Fa-f]{6}$'),
  ADD COLUMN linha_espessura_mm numeric(8,3) NOT NULL DEFAULT 0.2 CHECK (linha_espessura_mm > 0),
  ADD COLUMN valor_unitario numeric(12,2) NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0);

ALTER TABLE public.foto_express_trabalhos
  ADD COLUMN orcamento_portal jsonb,
  ADD COLUMN valor_estimado numeric(12,2) CHECK (valor_estimado IS NULL OR valor_estimado >= 0);

CREATE OR REPLACE FUNCTION public.foto_express_snapshot_folha_papel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE papel_config public.foto_express_papeis%ROWTYPE;
BEGIN
  IF NEW.papel_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO papel_config FROM public.foto_express_papeis WHERE id = NEW.papel_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAPEL_NAO_ENCONTRADO'; END IF;
  NEW.linha_espacamento_ativa := papel_config.linha_espacamento_ativa;
  NEW.linha_cor := papel_config.linha_cor;
  NEW.linha_espessura_mm := papel_config.linha_espessura_mm;
  RETURN NEW;
END;
$$;

CREATE TRIGGER foto_express_folhas_snapshot_papel
BEFORE INSERT ON public.foto_express_folhas
FOR EACH ROW EXECUTE FUNCTION public.foto_express_snapshot_folha_papel();

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
    'versao_manifesto', 2,
    'montagem', to_jsonb(m) - 'snapshot_confirmado',
    'trabalho', jsonb_build_object('id', t.id, 'numero', t.numero),
    'folhas', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', f.id, 'numero', f.numero, 'largura_mm', f.largura_mm, 'altura_mm', f.altura_mm,
      'papel_id', f.papel_id, 'papel_nome', f.papel_nome,
      'linha_espacamento_ativa', f.linha_espacamento_ativa, 'linha_cor', f.linha_cor,
      'linha_espessura_mm', f.linha_espessura_mm, 'valor_unitario', f.valor_unitario,
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
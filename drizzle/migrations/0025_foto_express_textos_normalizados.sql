ALTER TABLE public.foto_express_textos
  ADD COLUMN largura_normalizada numeric(12,6) NOT NULL DEFAULT 0.600000,
  ADD COLUMN tamanho_normalizado numeric(12,6) NOT NULL DEFAULT 0.080000,
  ADD COLUMN fonte_id text NOT NULL DEFAULT 'SANS',
  ADD COLUMN italico boolean NOT NULL DEFAULT false,
  ADD COLUMN versao integer NOT NULL DEFAULT 1;

ALTER TABLE public.foto_express_textos
  ADD CONSTRAINT foto_express_textos_posicao_x_normalizada_check CHECK (posicao_x >= 0 AND posicao_x <= 1),
  ADD CONSTRAINT foto_express_textos_posicao_y_normalizada_check CHECK (posicao_y >= 0 AND posicao_y <= 1),
  ADD CONSTRAINT foto_express_textos_largura_normalizada_check CHECK (largura_normalizada > 0 AND largura_normalizada <= 1),
  ADD CONSTRAINT foto_express_textos_tamanho_normalizado_check CHECK (tamanho_normalizado > 0 AND tamanho_normalizado <= 1),
  ADD CONSTRAINT foto_express_textos_fonte_id_check CHECK (fonte_id IN ('SANS','SERIF','MONO','DECORATIVA')),
  ADD CONSTRAINT foto_express_textos_rotacao_controlada_check CHECK (rotacao IN (0, 90, 180, 270)),
  ADD CONSTRAINT foto_express_textos_cor_hex_check CHECK (cor ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT foto_express_textos_conteudo_limite_check CHECK (char_length(conteudo) <= 500),
  ADD CONSTRAINT foto_express_textos_versao_check CHECK (versao > 0);

COMMENT ON COLUMN public.foto_express_textos.largura IS 'DEPRECATED: substituida por largura_normalizada relativa a largura total do formato.';
COMMENT ON COLUMN public.foto_express_textos.altura IS 'DEPRECATED: a altura e derivada do conteudo, largura_normalizada e tamanho_normalizado.';
COMMENT ON COLUMN public.foto_express_textos.fonte IS 'DEPRECATED: substituida por fonte_id controlado pelo catalogo da aplicacao.';
COMMENT ON COLUMN public.foto_express_textos.tamanho IS 'DEPRECATED: substituida por tamanho_normalizado relativo a altura total do formato.';
COMMENT ON COLUMN public.foto_express_textos.posicao_x IS 'Centro da caixa de texto, normalizado de 0 a 1 sobre a largura total da area fisica do formato.';
COMMENT ON COLUMN public.foto_express_textos.posicao_y IS 'Centro da caixa de texto, normalizado de 0 a 1 sobre a altura total da area fisica do formato.';
COMMENT ON COLUMN public.foto_express_textos.largura_normalizada IS 'Largura da caixa de texto como proporcao da largura total da area fisica do formato.';
COMMENT ON COLUMN public.foto_express_textos.tamanho_normalizado IS 'Tamanho da fonte como proporcao da altura total da area fisica do formato.';

CREATE OR REPLACE FUNCTION public.foto_express_criar_texto(
  _trabalho_id uuid,
  _item_id uuid
) RETURNS public.foto_express_textos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  novo public.foto_express_textos%ROWTYPE;
  proxima_ordem integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.trabalhos.editar') THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;
  PERFORM 1 FROM public.foto_express_itens
   WHERE id = _item_id AND trabalho_id = _trabalho_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FOTO_NAO_ENCONTRADA'; END IF;
  SELECT COALESCE(max(ordem), -1) + 1 INTO proxima_ordem
    FROM public.foto_express_textos WHERE item_id = _item_id;
  INSERT INTO public.foto_express_textos
    (item_id, conteudo, posicao_x, posicao_y, largura_normalizada, tamanho_normalizado,
     fonte_id, cor, alinhamento, negrito, italico, rotacao, ordem)
  VALUES
    (_item_id, 'Digite seu texto', 0.5, 0.5, 0.6, 0.08,
     'SANS', '#FFFFFF', 'CENTRO', false, false, 0, proxima_ordem)
  RETURNING * INTO novo;
  RETURN novo;
END;
$$;

CREATE OR REPLACE FUNCTION public.foto_express_salvar_texto(
  _trabalho_id uuid,
  _item_id uuid,
  _texto_id uuid,
  _conteudo text,
  _posicao_x numeric,
  _posicao_y numeric,
  _largura_normalizada numeric,
  _tamanho_normalizado numeric,
  _fonte_id text,
  _cor text,
  _alinhamento text,
  _negrito boolean,
  _italico boolean,
  _rotacao numeric,
  _versao_esperada integer
) RETURNS public.foto_express_textos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  atual public.foto_express_textos%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.trabalhos.editar') THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;
  IF char_length(_conteudo) > 500 OR _posicao_x < 0 OR _posicao_x > 1
     OR _posicao_y < 0 OR _posicao_y > 1
     OR _largura_normalizada <= 0 OR _largura_normalizada > 1
     OR _tamanho_normalizado <= 0 OR _tamanho_normalizado > 1
     OR _fonte_id NOT IN ('SANS','SERIF','MONO','DECORATIVA')
     OR _cor !~ '^#[0-9A-Fa-f]{6}$'
     OR _alinhamento NOT IN ('ESQUERDA','CENTRO','DIREITA')
     OR _rotacao NOT IN (0,90,180,270) THEN
    RAISE EXCEPTION 'TEXTO_INVALIDO';
  END IF;
  SELECT t.* INTO atual
    FROM public.foto_express_textos t
    JOIN public.foto_express_itens i ON i.id = t.item_id
   WHERE t.id = _texto_id AND t.item_id = _item_id AND i.trabalho_id = _trabalho_id
   FOR UPDATE OF t;
  IF NOT FOUND THEN RAISE EXCEPTION 'TEXTO_NAO_ENCONTRADO'; END IF;
  IF atual.versao <> _versao_esperada THEN RAISE EXCEPTION 'TEXTO_DESATUALIZADO'; END IF;
  UPDATE public.foto_express_textos
     SET conteudo = _conteudo,
         posicao_x = _posicao_x,
         posicao_y = _posicao_y,
         largura_normalizada = _largura_normalizada,
         tamanho_normalizado = _tamanho_normalizado,
         fonte_id = _fonte_id,
         cor = upper(_cor),
         alinhamento = _alinhamento,
         negrito = _negrito,
         italico = _italico,
         rotacao = _rotacao,
         versao = versao + 1
   WHERE id = _texto_id
  RETURNING * INTO atual;
  RETURN atual;
END;
$$;

CREATE OR REPLACE FUNCTION public.foto_express_duplicar_texto(
  _trabalho_id uuid,
  _item_id uuid,
  _texto_id uuid
) RETURNS public.foto_express_textos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  origem public.foto_express_textos%ROWTYPE;
  novo public.foto_express_textos%ROWTYPE;
  proxima_ordem integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.trabalhos.editar') THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;
  SELECT t.* INTO origem
    FROM public.foto_express_textos t
    JOIN public.foto_express_itens i ON i.id = t.item_id
   WHERE t.id = _texto_id AND t.item_id = _item_id AND i.trabalho_id = _trabalho_id
   FOR UPDATE OF t;
  IF NOT FOUND THEN RAISE EXCEPTION 'TEXTO_NAO_ENCONTRADO'; END IF;
  SELECT COALESCE(max(ordem), -1) + 1 INTO proxima_ordem
    FROM public.foto_express_textos WHERE item_id = _item_id;
  INSERT INTO public.foto_express_textos
    (item_id, conteudo, posicao_x, posicao_y, largura_normalizada, tamanho_normalizado,
     fonte_id, cor, alinhamento, negrito, italico, rotacao, ordem)
  VALUES
    (_item_id, origem.conteudo, least(1, origem.posicao_x + 0.03), least(1, origem.posicao_y + 0.03),
     origem.largura_normalizada, origem.tamanho_normalizado, origem.fonte_id, origem.cor,
     origem.alinhamento, origem.negrito, origem.italico, origem.rotacao, proxima_ordem)
  RETURNING * INTO novo;
  RETURN novo;
END;
$$;

CREATE OR REPLACE FUNCTION public.foto_express_excluir_texto(
  _trabalho_id uuid,
  _item_id uuid,
  _texto_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.trabalhos.editar') THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;
  DELETE FROM public.foto_express_textos t
   USING public.foto_express_itens i
   WHERE t.id = _texto_id AND t.item_id = _item_id
     AND i.id = t.item_id AND i.trabalho_id = _trabalho_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'TEXTO_NAO_ENCONTRADO'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.foto_express_mover_texto(
  _trabalho_id uuid,
  _item_id uuid,
  _texto_id uuid,
  _direcao integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ordem_atual integer;
  outro_id uuid;
  outra_ordem integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.trabalhos.editar') THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;
  IF _direcao NOT IN (-1, 1) THEN RAISE EXCEPTION 'DIRECAO_INVALIDA'; END IF;
  PERFORM 1 FROM public.foto_express_itens
   WHERE id = _item_id AND trabalho_id = _trabalho_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FOTO_NAO_ENCONTRADA'; END IF;
  SELECT ordem INTO ordem_atual FROM public.foto_express_textos
   WHERE id = _texto_id AND item_id = _item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TEXTO_NAO_ENCONTRADO'; END IF;
  IF _direcao = 1 THEN
    SELECT id, ordem INTO outro_id, outra_ordem FROM public.foto_express_textos
     WHERE item_id = _item_id AND (ordem > ordem_atual OR (ordem = ordem_atual AND id > _texto_id))
     ORDER BY ordem, id LIMIT 1 FOR UPDATE;
  ELSE
    SELECT id, ordem INTO outro_id, outra_ordem FROM public.foto_express_textos
     WHERE item_id = _item_id AND (ordem < ordem_atual OR (ordem = ordem_atual AND id < _texto_id))
     ORDER BY ordem DESC, id DESC LIMIT 1 FOR UPDATE;
  END IF;
  IF outro_id IS NULL THEN RETURN; END IF;
  UPDATE public.foto_express_textos SET ordem = outra_ordem WHERE id = _texto_id;
  UPDATE public.foto_express_textos SET ordem = ordem_atual WHERE id = outro_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.foto_express_duplicar_item(_item_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  origem public.foto_express_itens%ROWTYPE;
  novo_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_foto_express('foto_express.trabalhos.editar') THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;
  SELECT * INTO origem FROM public.foto_express_itens WHERE id = _item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FOTO_NAO_ENCONTRADA'; END IF;
  INSERT INTO public.foto_express_itens
    (trabalho_id, arquivo_id, formato_id, largura_personalizada_cm, altura_personalizada_cm, quantidade, orientacao, ordem, status_edicao)
  VALUES
    (origem.trabalho_id, origem.arquivo_id, origem.formato_id, origem.largura_personalizada_cm, origem.altura_personalizada_cm, origem.quantidade, origem.orientacao, origem.ordem + 1, origem.status_edicao)
  RETURNING id INTO novo_id;
  UPDATE public.foto_express_configuracoes destino
     SET zoom = fonte.zoom, posicao_x = fonte.posicao_x, posicao_y = fonte.posicao_y,
         rotacao = fonte.rotacao, crop_x = fonte.crop_x, crop_y = fonte.crop_y,
         crop_largura = fonte.crop_largura, crop_altura = fonte.crop_altura,
         espelhar_horizontal = fonte.espelhar_horizontal, espelhar_vertical = fonte.espelhar_vertical,
         modo_ajuste = fonte.modo_ajuste
    FROM public.foto_express_configuracoes fonte
   WHERE destino.item_id = novo_id AND fonte.item_id = _item_id;
  INSERT INTO public.foto_express_textos
    (item_id, conteudo, posicao_x, posicao_y, largura_normalizada, tamanho_normalizado,
     fonte_id, cor, alinhamento, negrito, italico, rotacao, ordem)
  SELECT novo_id, conteudo, posicao_x, posicao_y, largura_normalizada, tamanho_normalizado,
         fonte_id, cor, alinhamento, negrito, italico, rotacao, ordem
    FROM public.foto_express_textos WHERE item_id = _item_id;
  RETURN novo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.foto_express_criar_texto(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.foto_express_salvar_texto(uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, text, text, text, boolean, boolean, numeric, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.foto_express_duplicar_texto(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.foto_express_excluir_texto(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.foto_express_mover_texto(uuid, uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foto_express_criar_texto(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.foto_express_salvar_texto(uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, text, text, text, boolean, boolean, numeric, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.foto_express_duplicar_texto(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.foto_express_excluir_texto(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.foto_express_mover_texto(uuid, uuid, uuid, integer) TO authenticated, service_role;
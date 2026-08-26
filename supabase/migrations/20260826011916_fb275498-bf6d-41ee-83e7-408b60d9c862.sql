ALTER TABLE public.bot_fluxo_etapas
  ADD COLUMN IF NOT EXISTS tipo_mensagem text NOT NULL DEFAULT 'texto',
  ADD COLUMN IF NOT EXISTS midia_url text,
  ADD COLUMN IF NOT EXISTS midia_nome text,
  ADD COLUMN IF NOT EXISTS modo_avanco text NOT NULL DEFAULT 'resposta',
  ADD COLUMN IF NOT EXISTS espera_segundos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mensagem_retorno_dia text NOT NULL DEFAULT '';

-- Define o modo de avanço conforme o comportamento atual de cada etapa.
UPDATE public.bot_fluxo_etapas e
SET modo_avanco = CASE
  WHEN EXISTS (SELECT 1 FROM public.bot_fluxo_opcoes o WHERE o.etapa_id = e.id AND o.ativo) THEN 'opcao'
  WHEN e.acao = 'aguardar_resposta' OR e.tipo_resposta <> 'nenhuma' THEN 'resposta'
  ELSE 'automatico'
END;

-- Leva a mensagem inicial do fluxo para a primeira etapa.
WITH primeiras AS (
  SELECT DISTINCT ON (fluxo_id) id, fluxo_id, mensagem
  FROM public.bot_fluxo_etapas
  ORDER BY fluxo_id, ordem, created_at
)
UPDATE public.bot_fluxo_etapas e
SET
  mensagem = btrim(
    CASE
      WHEN btrim(COALESCE(f.mensagem_inicial, '')) = '' THEN COALESCE(p.mensagem, '')
      WHEN btrim(COALESCE(p.mensagem, '')) = '' THEN f.mensagem_inicial
      ELSE f.mensagem_inicial || E'\n\n' || p.mensagem
    END
  ),
  mensagem_retorno_dia = btrim(
    CASE
      WHEN btrim(COALESCE(f.mensagem_retorno_dia, '')) = '' THEN ''
      WHEN btrim(COALESCE(p.mensagem, '')) = '' THEN f.mensagem_retorno_dia
      ELSE f.mensagem_retorno_dia || E'\n\n' || p.mensagem
    END
  )
FROM primeiras p
JOIN public.bot_fluxos f ON f.id = p.fluxo_id
WHERE e.id = p.id;
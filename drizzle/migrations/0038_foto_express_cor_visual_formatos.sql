ALTER TABLE public.foto_express_formatos
  ADD COLUMN cor_card text NOT NULL DEFAULT '#0EA5E9';

ALTER TABLE public.foto_express_formatos
  ADD CONSTRAINT foto_express_formatos_cor_card_valida
  CHECK (cor_card ~ '^#[0-9A-F]{6}$');

WITH formatos_ordenados AS (
  SELECT id, row_number() OVER (ORDER BY ordem, nome, id) AS posicao
  FROM public.foto_express_formatos
)
UPDATE public.foto_express_formatos AS formato
SET cor_card = CASE ((formatos_ordenados.posicao - 1) % 10)
  WHEN 0 THEN '#0EA5E9'
  WHEN 1 THEN '#10B981'
  WHEN 2 THEN '#F59E0B'
  WHEN 3 THEN '#EF4444'
  WHEN 4 THEN '#8B5CF6'
  WHEN 5 THEN '#EC4899'
  WHEN 6 THEN '#14B8A6'
  WHEN 7 THEN '#F97316'
  WHEN 8 THEN '#6366F1'
  ELSE '#84CC16'
END
FROM formatos_ordenados
WHERE formato.id = formatos_ordenados.id;

COMMENT ON COLUMN public.foto_express_formatos.cor_card IS 'Cor visual controlada do formato, usada para identificar seus cards no cadastro e na galeria.';
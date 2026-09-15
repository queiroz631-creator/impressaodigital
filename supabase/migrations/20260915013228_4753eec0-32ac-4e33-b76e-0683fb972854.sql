ALTER TABLE public.sorteio_notas_base
  ADD COLUMN IF NOT EXISTS situacao smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cancelada_em timestamptz NULL;

CREATE INDEX IF NOT EXISTS sorteio_notas_base_situacao_idx
  ON public.sorteio_notas_base (sorteio_id, situacao);
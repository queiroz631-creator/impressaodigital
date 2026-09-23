ALTER TABLE public.sorteio_notas_base
  ADD COLUMN IF NOT EXISTS cliente_origem_id text;

CREATE INDEX IF NOT EXISTS sorteio_notas_base_cliente_origem_idx
  ON public.sorteio_notas_base (sorteio_id, cliente_origem_id);
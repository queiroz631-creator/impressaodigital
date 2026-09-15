CREATE UNIQUE INDEX IF NOT EXISTS sorteio_notas_base_sorteio_numero_uidx
ON public.sorteio_notas_base (sorteio_id, numero);
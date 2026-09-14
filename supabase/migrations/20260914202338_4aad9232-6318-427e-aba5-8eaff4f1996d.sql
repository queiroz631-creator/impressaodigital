ALTER TABLE public.sorteio_participantes
  ADD COLUMN IF NOT EXISTS concorre_sorteio boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.sorteio_participantes.concorre_sorteio IS
  'Elegibilidade do participante neste sorteio. false = não entra no sorteio, mas mantém notas/cupons.';
ALTER TABLE public.sorteios
  ADD COLUMN IF NOT EXISTS valor_minimo_nota_centavos integer NOT NULL DEFAULT 0;

ALTER TABLE public.sorteios
  ADD CONSTRAINT sorteios_valor_minimo_nota_nao_negativo
  CHECK (valor_minimo_nota_centavos >= 0);

COMMENT ON COLUMN public.sorteios.valor_minimo_nota_centavos IS 'Valor minimo aceito para uma nota do sorteio, em centavos. 0 = sem minimo.';
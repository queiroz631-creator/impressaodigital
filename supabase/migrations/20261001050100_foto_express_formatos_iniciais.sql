INSERT INTO public.foto_express_formatos (codigo, nome, largura_cm, altura_cm, padrao, ordem)
VALUES
  ('3X4', '3x4 cm', 3, 4, true, 10),
  ('5X7', '5x7 cm', 5, 7, true, 20),
  ('10X15', '10x15 cm', 10, 15, true, 30),
  ('13X18', '13x18 cm', 13, 18, true, 40),
  ('15X20', '15x20 cm', 15, 20, true, 50),
  ('20X25', '20x25 cm', 20, 25, true, 60),
  ('20X30', '20x30 cm', 20, 30, true, 70),
  ('A4', 'A4', 21, 29.7, true, 80)
ON CONFLICT (codigo) DO NOTHING;

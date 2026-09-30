INSERT INTO public.sistema_chaves (nome, url_base)
VALUES ('backup', 'https://backup.queiroztecno.com.br')
ON CONFLICT (nome) DO NOTHING;
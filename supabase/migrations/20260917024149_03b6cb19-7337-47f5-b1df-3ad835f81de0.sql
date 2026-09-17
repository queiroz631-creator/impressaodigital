ALTER TABLE public.clientes DISABLE TRIGGER clientes_origem_id_permanente;

UPDATE public.clientes
   SET origem_id = NULL,
       origem_alteracao = 'LOJA'
 WHERE origem_id IS NOT NULL;

ALTER TABLE public.clientes ENABLE TRIGGER clientes_origem_id_permanente;
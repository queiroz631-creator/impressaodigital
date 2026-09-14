CREATE TABLE public.sorteio_sessoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  participante_id UUID NOT NULL REFERENCES public.sorteio_participantes(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  sorteio_id UUID NOT NULL REFERENCES public.sorteios(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  renovacao_hash TEXT UNIQUE,
  expira_em TIMESTAMPTZ NOT NULL,
  renovacao_expira_em TIMESTAMPTZ,
  revogado_em TIMESTAMPTZ,
  ip TEXT,
  user_agent TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  usado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.sorteio_sessoes TO service_role;
ALTER TABLE public.sorteio_sessoes ENABLE ROW LEVEL SECURITY;
CREATE INDEX sorteio_sessoes_renovacao_idx ON public.sorteio_sessoes (renovacao_hash) WHERE renovacao_hash IS NOT NULL;
CREATE INDEX sorteio_sessoes_expira_idx ON public.sorteio_sessoes (expira_em);

CREATE TABLE public.sorteio_tentativas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  acao TEXT NOT NULL,
  ip TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.sorteio_tentativas TO service_role;
ALTER TABLE public.sorteio_tentativas ENABLE ROW LEVEL SECURITY;
CREATE INDEX sorteio_tentativas_janela_idx ON public.sorteio_tentativas (ip, acao, criado_em);
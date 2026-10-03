ALTER TABLE public.foto_express_trabalhos
  ADD COLUMN IF NOT EXISTS origem_portal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS portal_enviado_em timestamptz;

COMMENT ON COLUMN public.foto_express_trabalhos.origem_portal IS 'Indica trabalho criado pelo portal público FOTO EXPRESS.';
COMMENT ON COLUMN public.foto_express_trabalhos.portal_enviado_em IS 'Momento do envio pelo cliente; após preenchido, o portal fica somente leitura.';

CREATE INDEX IF NOT EXISTS foto_express_trabalhos_cliente_portal_idx
  ON public.foto_express_trabalhos (cliente_id, criado_em DESC)
  WHERE origem_portal = true;

CREATE TABLE public.foto_express_portal_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  renovacao_hash text UNIQUE,
  expira_em timestamptz NOT NULL,
  renovacao_expira_em timestamptz,
  revogado_em timestamptz,
  ip text,
  user_agent text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  usado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.foto_express_portal_sessoes TO service_role;
ALTER TABLE public.foto_express_portal_sessoes ENABLE ROW LEVEL SECURITY;
CREATE INDEX foto_express_portal_sessoes_renovacao_idx
  ON public.foto_express_portal_sessoes (renovacao_hash)
  WHERE renovacao_hash IS NOT NULL;
CREATE INDEX foto_express_portal_sessoes_expira_idx
  ON public.foto_express_portal_sessoes (expira_em);

CREATE TABLE public.foto_express_portal_tentativas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip text NOT NULL,
  acao text NOT NULL CHECK (acao IN ('cpf','telefone','cadastro','upload','envio')),
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.foto_express_portal_tentativas TO service_role;
ALTER TABLE public.foto_express_portal_tentativas ENABLE ROW LEVEL SECURITY;
CREATE INDEX foto_express_portal_tentativas_consulta_idx
  ON public.foto_express_portal_tentativas (ip, acao, criado_em DESC);
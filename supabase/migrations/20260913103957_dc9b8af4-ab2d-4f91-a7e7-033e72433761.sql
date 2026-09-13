-- 1. Conexões
CREATE TABLE public.whatsapp_conexoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text NOT NULL DEFAULT '',
  cor text NOT NULL DEFAULT '#25D366',
  base_url text NOT NULL DEFAULT 'https://api.z-api.io',
  instance_id text NOT NULL DEFAULT '',
  instance_token text NOT NULL DEFAULT '',
  client_token text NOT NULL DEFAULT '',
  webhook_token text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_conexoes_webhook_token_key UNIQUE (webhook_token)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conexoes TO authenticated;
GRANT ALL ON public.whatsapp_conexoes TO service_role;
ALTER TABLE public.whatsapp_conexoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conexoes_select" ON public.whatsapp_conexoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "conexoes_admin" ON public.whatsapp_conexoes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER whatsapp_conexoes_updated_at BEFORE UPDATE ON public.whatsapp_conexoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.whatsapp_conexoes (nome, ordem) VALUES ('Principal', 0);

-- 2. Vínculo das tabelas existentes
ALTER TABLE public.whatsapp_config ADD COLUMN conexao_id uuid REFERENCES public.whatsapp_conexoes(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_conversas ADD COLUMN conexao_id uuid REFERENCES public.whatsapp_conexoes(id) ON DELETE SET NULL;
ALTER TABLE public.bot_fluxos ADD COLUMN conexao_id uuid REFERENCES public.whatsapp_conexoes(id) ON DELETE CASCADE;
ALTER TABLE public.bot_respostas ADD COLUMN conexao_id uuid REFERENCES public.whatsapp_conexoes(id) ON DELETE CASCADE;
ALTER TABLE public.bot_horarios ADD COLUMN conexao_id uuid REFERENCES public.whatsapp_conexoes(id) ON DELETE CASCADE;
ALTER TABLE public.bot_menu_opcoes ADD COLUMN conexao_id uuid REFERENCES public.whatsapp_conexoes(id) ON DELETE CASCADE;
ALTER TABLE public.bot_primeiro_contato ADD COLUMN conexao_id uuid REFERENCES public.whatsapp_conexoes(id) ON DELETE CASCADE;
ALTER TABLE public.bot_numeros ADD COLUMN conexao_id uuid REFERENCES public.whatsapp_conexoes(id) ON DELETE CASCADE;
ALTER TABLE public.bot_status_whatsapp ADD COLUMN conexao_id uuid REFERENCES public.whatsapp_conexoes(id) ON DELETE CASCADE;

UPDATE public.whatsapp_config SET conexao_id = (SELECT id FROM public.whatsapp_conexoes ORDER BY ordem LIMIT 1);
UPDATE public.whatsapp_conversas SET conexao_id = (SELECT id FROM public.whatsapp_conexoes ORDER BY ordem LIMIT 1);
UPDATE public.bot_fluxos SET conexao_id = (SELECT id FROM public.whatsapp_conexoes ORDER BY ordem LIMIT 1);
UPDATE public.bot_respostas SET conexao_id = (SELECT id FROM public.whatsapp_conexoes ORDER BY ordem LIMIT 1);
UPDATE public.bot_horarios SET conexao_id = (SELECT id FROM public.whatsapp_conexoes ORDER BY ordem LIMIT 1);
UPDATE public.bot_menu_opcoes SET conexao_id = (SELECT id FROM public.whatsapp_conexoes ORDER BY ordem LIMIT 1);
UPDATE public.bot_primeiro_contato SET conexao_id = (SELECT id FROM public.whatsapp_conexoes ORDER BY ordem LIMIT 1);
UPDATE public.bot_numeros SET conexao_id = (SELECT id FROM public.whatsapp_conexoes ORDER BY ordem LIMIT 1);
UPDATE public.bot_status_whatsapp SET conexao_id = (SELECT id FROM public.whatsapp_conexoes ORDER BY ordem LIMIT 1);

CREATE INDEX idx_whatsapp_conversas_conexao ON public.whatsapp_conversas(conexao_id);
CREATE INDEX idx_bot_fluxos_conexao ON public.bot_fluxos(conexao_id);

-- 3. Perfis de acesso
CREATE TABLE public.perfis_acesso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  permissoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfis_acesso TO authenticated;
GRANT ALL ON public.perfis_acesso TO service_role;
ALTER TABLE public.perfis_acesso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perfis_select" ON public.perfis_acesso
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "perfis_admin" ON public.perfis_acesso
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER perfis_acesso_updated_at BEFORE UPDATE ON public.perfis_acesso
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.perfis_acesso (nome, permissoes) VALUES
  ('Administrador', '["dashboard","calculadora","orcamentos","curriculos","clientes","whatsapp","mensagens_rapidas","bot","conexoes","precos","configuracoes","usuarios","melhorias","excluir_pedido","alterar_precos","gerenciar_conexoes","gerenciar_usuarios"]'::jsonb),
  ('Atendente', '["dashboard","calculadora","orcamentos","curriculos","clientes","whatsapp","mensagens_rapidas"]'::jsonb);

-- 4. Usuários
ALTER TABLE public.profiles ADD COLUMN perfil_id uuid REFERENCES public.perfis_acesso(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN conexao_id uuid REFERENCES public.whatsapp_conexoes(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN ativo boolean NOT NULL DEFAULT true;

UPDATE public.profiles p
   SET perfil_id = (SELECT id FROM public.perfis_acesso WHERE nome = 'Administrador'),
       conexao_id = (SELECT id FROM public.whatsapp_conexoes ORDER BY ordem LIMIT 1)
 WHERE public.has_role(p.id, 'admin');

UPDATE public.profiles p
   SET perfil_id = (SELECT id FROM public.perfis_acesso WHERE nome = 'Atendente'),
       conexao_id = (SELECT id FROM public.whatsapp_conexoes ORDER BY ordem LIMIT 1)
 WHERE p.perfil_id IS NULL;

CREATE POLICY "profiles_admin" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Funções auxiliares
CREATE OR REPLACE FUNCTION public.conexao_do_usuario(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT conexao_id FROM public.profiles WHERE id = _user_id $$;

CREATE OR REPLACE FUNCTION public.tem_permissao(_user_id uuid, _chave text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR EXISTS (
        SELECT 1
          FROM public.profiles p
          JOIN public.perfis_acesso a ON a.id = p.perfil_id
         WHERE p.id = _user_id
           AND p.ativo
           AND a.ativo
           AND a.permissoes ? _chave
      )
$$;

-- 6. RLS por conexão nas conversas
DROP POLICY "whatsapp_conversas_all" ON public.whatsapp_conversas;
CREATE POLICY "whatsapp_conversas_conexao" ON public.whatsapp_conversas
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR conexao_id IS NULL
    OR conexao_id = public.conexao_do_usuario(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR conexao_id IS NULL
    OR conexao_id = public.conexao_do_usuario(auth.uid())
  );

DROP POLICY "whatsapp_mensagens_all" ON public.whatsapp_mensagens;
CREATE POLICY "whatsapp_mensagens_conexao" ON public.whatsapp_mensagens
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.whatsapp_conversas c
       WHERE c.id = conversa_id
         AND (c.conexao_id IS NULL OR c.conexao_id = public.conexao_do_usuario(auth.uid()))
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.whatsapp_conversas c
       WHERE c.id = conversa_id
         AND (c.conexao_id IS NULL OR c.conexao_id = public.conexao_do_usuario(auth.uid()))
    )
  );

DROP POLICY "whatsapp_arquivos_all" ON public.whatsapp_arquivos;
CREATE POLICY "whatsapp_arquivos_conexao" ON public.whatsapp_arquivos
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.whatsapp_conversas c
       WHERE c.id = conversa_id
         AND (c.conexao_id IS NULL OR c.conexao_id = public.conexao_do_usuario(auth.uid()))
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.whatsapp_conversas c
       WHERE c.id = conversa_id
         AND (c.conexao_id IS NULL OR c.conexao_id = public.conexao_do_usuario(auth.uid()))
    )
  );
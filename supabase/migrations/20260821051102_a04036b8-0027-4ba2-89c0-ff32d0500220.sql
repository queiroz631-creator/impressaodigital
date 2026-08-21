-- ============ CLIENTES ============
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL DEFAULT '',
  telefone text,
  telefone_normalizado text UNIQUE,
  email text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY clientes_all ON public.clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER clientes_updated_at BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS origem_orcamento text NOT NULL DEFAULT 'calculadora';
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS revisao_necessaria boolean NOT NULL DEFAULT false;

-- ============ CONVERSAS ============
CREATE TABLE public.whatsapp_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  telefone text NOT NULL,
  nome_contato text,
  status text NOT NULL DEFAULT 'automatico',
  etapa text NOT NULL DEFAULT 'inicio',
  motivo_encaminhamento text,
  motivo_pendencia text,
  motivo_finalizacao text,
  atendente_id uuid,
  atendente_nome text,
  inicio_atendimento timestamptz,
  data_finalizacao timestamptz,
  pedido_id uuid REFERENCES public.pedidos(id) ON DELETE SET NULL,
  orcamento_id uuid REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  ultima_mensagem text,
  ultima_mensagem_em timestamptz,
  nao_lidas integer NOT NULL DEFAULT 0,
  total_mensagens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX whatsapp_conversas_telefone_idx ON public.whatsapp_conversas (telefone);
CREATE INDEX whatsapp_conversas_status_idx ON public.whatsapp_conversas (status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversas TO authenticated;
GRANT ALL ON public.whatsapp_conversas TO service_role;
ALTER TABLE public.whatsapp_conversas ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_conversas_all ON public.whatsapp_conversas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER whatsapp_conversas_updated_at BEFORE UPDATE ON public.whatsapp_conversas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ MENSAGENS ============
CREATE TABLE public.whatsapp_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.whatsapp_conversas(id) ON DELETE CASCADE,
  whatsapp_message_id text,
  direcao text NOT NULL DEFAULT 'entrada',
  autor text,
  tipo text NOT NULL DEFAULT 'texto',
  texto text,
  arquivo_url text,
  arquivo_nome text,
  arquivo_path text,
  mime_type text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'recebida',
  erro text,
  data_hora timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX whatsapp_mensagens_wid_idx ON public.whatsapp_mensagens (whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL;
CREATE INDEX whatsapp_mensagens_conversa_idx ON public.whatsapp_mensagens (conversa_id, data_hora);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_mensagens TO authenticated;
GRANT ALL ON public.whatsapp_mensagens TO service_role;
ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_mensagens_all ON public.whatsapp_mensagens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ ARQUIVOS ============
CREATE TABLE public.whatsapp_arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.whatsapp_conversas(id) ON DELETE CASCADE,
  mensagem_id uuid REFERENCES public.whatsapp_mensagens(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  pedido_id uuid REFERENCES public.pedidos(id) ON DELETE SET NULL,
  nome text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT '',
  mime_type text,
  storage_path text,
  url text,
  paginas integer NOT NULL DEFAULT 1,
  paginas_manuais boolean NOT NULL DEFAULT false,
  copias integer NOT NULL DEFAULT 1,
  frente_verso boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX whatsapp_arquivos_conversa_idx ON public.whatsapp_arquivos (conversa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_arquivos TO authenticated;
GRANT ALL ON public.whatsapp_arquivos TO service_role;
ALTER TABLE public.whatsapp_arquivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_arquivos_all ON public.whatsapp_arquivos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ CONFIGURACAO DO WHATSAPP ============
CREATE TABLE public.whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conexao_nome text NOT NULL DEFAULT 'Principal',
  base_url text NOT NULL DEFAULT 'https://api.z-api.io',
  bot_ativo boolean NOT NULL DEFAULT false,
  msg_inicial text NOT NULL DEFAULT 'Olá! 👋
Seja bem-vindo à nossa gráfica.

Para começar, me informe seu nome.',
  msg_boas_vindas text NOT NULL DEFAULT 'Olá, {nome}! 😊

Como posso ajudar?',
  msg_transferencia text NOT NULL DEFAULT 'Certo! Vou chamar um atendente para continuar com você. 😊',
  msg_finalizacao text NOT NULL DEFAULT 'Atendimento finalizado. Obrigado pelo contato! 😊',
  msg_orcamento_gerado text NOT NULL DEFAULT 'Seu orçamento foi gerado automaticamente pelo nosso Agente de IA. 🤖

Antes de confirmar o serviço, o orçamento será revisado pela nossa equipe para verificar se existe alguma divergência nas informações ou valores.

Confira os dados abaixo:',
  msg_revisao text NOT NULL DEFAULT 'Seu orçamento está em revisão pela nossa equipe. Em instantes retornamos. 😊',
  msg_orcamento_confirmado text NOT NULL DEFAULT 'Orçamento confirmado! ✅ Já registramos seu pedido.',
  permitir_orcamento_automatico boolean NOT NULL DEFAULT true,
  exigir_revisao_humana boolean NOT NULL DEFAULT true,
  permitir_link boolean NOT NULL DEFAULT true,
  mostrar_precos_link boolean NOT NULL DEFAULT false,
  reabrir_mesmo_dia boolean NOT NULL DEFAULT true,
  link_permitir_upload boolean NOT NULL DEFAULT true,
  link_permitir_material boolean NOT NULL DEFAULT true,
  link_permitir_acabamento boolean NOT NULL DEFAULT true,
  link_permitir_formato boolean NOT NULL DEFAULT true,
  link_permitir_tipo boolean NOT NULL DEFAULT true,
  link_permitir_copias boolean NOT NULL DEFAULT true,
  link_permitir_frente_verso boolean NOT NULL DEFAULT true,
  link_permitir_confirmacao boolean NOT NULL DEFAULT true,
  link_exigir_telefone boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_config TO authenticated;
GRANT ALL ON public.whatsapp_config TO service_role;
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_config_select ON public.whatsapp_config FOR SELECT TO authenticated USING (true);
CREATE POLICY whatsapp_config_admin ON public.whatsapp_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT INSERT, UPDATE, DELETE ON public.whatsapp_config TO authenticated;
CREATE TRIGGER whatsapp_config_updated_at BEFORE UPDATE ON public.whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.whatsapp_config (conexao_nome) VALUES ('Principal');

-- ============ AUDITORIA ============
CREATE TABLE public.whatsapp_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid REFERENCES public.whatsapp_conversas(id) ON DELETE CASCADE,
  usuario_id uuid,
  usuario_nome text,
  acao text NOT NULL,
  detalhe text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX whatsapp_auditoria_conversa_idx ON public.whatsapp_auditoria (conversa_id, created_at);
GRANT SELECT, INSERT ON public.whatsapp_auditoria TO authenticated;
GRANT ALL ON public.whatsapp_auditoria TO service_role;
ALTER TABLE public.whatsapp_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_auditoria_select ON public.whatsapp_auditoria FOR SELECT TO authenticated USING (true);
CREATE POLICY whatsapp_auditoria_insert ON public.whatsapp_auditoria FOR INSERT TO authenticated WITH CHECK (true);
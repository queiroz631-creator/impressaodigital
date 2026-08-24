CREATE TABLE public.bot_fluxos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  icone text NOT NULL DEFAULT 'bot',
  mensagem_inicial text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  inicial boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_fluxos TO authenticated;
GRANT ALL ON public.bot_fluxos TO service_role;
ALTER TABLE public.bot_fluxos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gerenciam fluxos" ON public.bot_fluxos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER bot_fluxos_updated_at BEFORE UPDATE ON public.bot_fluxos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.bot_fluxo_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fluxo_id uuid NOT NULL REFERENCES public.bot_fluxos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  mensagem text NOT NULL DEFAULT '',
  tipo_resposta text NOT NULL DEFAULT 'nenhuma',
  acao text NOT NULL DEFAULT 'enviar_mensagem',
  configuracao jsonb NOT NULL DEFAULT '{}'::jsonb,
  proxima_etapa_id uuid REFERENCES public.bot_fluxo_etapas(id) ON DELETE SET NULL,
  destino_fluxo_id uuid REFERENCES public.bot_fluxos(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_fluxo_etapas TO authenticated;
GRANT ALL ON public.bot_fluxo_etapas TO service_role;
ALTER TABLE public.bot_fluxo_etapas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gerenciam etapas" ON public.bot_fluxo_etapas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER bot_fluxo_etapas_updated_at BEFORE UPDATE ON public.bot_fluxo_etapas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX bot_fluxo_etapas_fluxo_idx ON public.bot_fluxo_etapas(fluxo_id, ordem);

CREATE TABLE public.bot_fluxo_opcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa_id uuid NOT NULL REFERENCES public.bot_fluxo_etapas(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  valor text NOT NULL DEFAULT '',
  ordem integer NOT NULL DEFAULT 0,
  acao text NOT NULL DEFAULT 'proxima_etapa',
  destino_fluxo_id uuid REFERENCES public.bot_fluxos(id) ON DELETE SET NULL,
  destino_etapa_id uuid REFERENCES public.bot_fluxo_etapas(id) ON DELETE SET NULL,
  configuracao jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_fluxo_opcoes TO authenticated;
GRANT ALL ON public.bot_fluxo_opcoes TO service_role;
ALTER TABLE public.bot_fluxo_opcoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gerenciam opcoes de fluxo" ON public.bot_fluxo_opcoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER bot_fluxo_opcoes_updated_at BEFORE UPDATE ON public.bot_fluxo_opcoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX bot_fluxo_opcoes_etapa_idx ON public.bot_fluxo_opcoes(etapa_id, ordem);

CREATE UNIQUE INDEX bot_fluxos_um_inicial ON public.bot_fluxos(inicial) WHERE inicial;

-- Fluxos padrao a partir do que o bot ja faz hoje
INSERT INTO public.bot_fluxos (nome, descricao, icone, mensagem_inicial, ordem, inicial) VALUES
  ('Atendimento Inicial', 'Fluxo executado quando o cliente inicia o atendimento.', 'bot', 'Olá, {nome}! 👋 Bem-vindo ao nosso atendimento. Como podemos ajudar?', 1, true),
  ('Fazer Orçamento', 'Fluxo para clientes que desejam solicitar um orçamento.', 'arquivo', 'Vamos preparar seu orçamento! 😊 Envie seus arquivos para começarmos.', 2, false),
  ('Consultar Pedido', 'Consulta de pedidos pelo WhatsApp.', 'pedido', 'Informe o número do pedido.', 3, false),
  ('Currículo', 'Criação e atualização de currículo.', 'pessoa', 'Você deseja criar ou atualizar seu currículo?', 4, false),
  ('Falar com Atendente', 'Encaminha o cliente para a equipe.', 'atendente', 'Vou encaminhar seu atendimento para nossa equipe. Aguarde um momento.', 5, false);

-- Etapas dos fluxos de servico
INSERT INTO public.bot_fluxo_etapas (fluxo_id, nome, ordem, mensagem, tipo_resposta, acao)
SELECT f.id, 'Iniciar orçamento', 1, 'Vamos preparar seu orçamento! 😊 Envie seus arquivos para começarmos.', 'arquivo', 'iniciar_orcamento'
FROM public.bot_fluxos f WHERE f.nome = 'Fazer Orçamento';

INSERT INTO public.bot_fluxo_etapas (fluxo_id, nome, ordem, mensagem, tipo_resposta, acao)
SELECT f.id, 'Consultar pedido', 1, 'Informe o número do pedido.', 'numero', 'consultar_pedido'
FROM public.bot_fluxos f WHERE f.nome = 'Consultar Pedido';

INSERT INTO public.bot_fluxo_etapas (fluxo_id, nome, ordem, mensagem, tipo_resposta, acao)
SELECT f.id, 'Iniciar currículo', 1, 'Você deseja criar ou atualizar seu currículo?', 'nenhuma', 'iniciar_curriculo'
FROM public.bot_fluxos f WHERE f.nome = 'Currículo';

INSERT INTO public.bot_fluxo_etapas (fluxo_id, nome, ordem, mensagem, tipo_resposta, acao)
SELECT f.id, 'Transferir para atendente', 1, 'Vou encaminhar seu atendimento para nossa equipe. Aguarde um momento.', 'nenhuma', 'transferir_atendente'
FROM public.bot_fluxos f WHERE f.nome = 'Falar com Atendente';

-- Etapa de menu do Atendimento Inicial
INSERT INTO public.bot_fluxo_etapas (fluxo_id, nome, ordem, mensagem, tipo_resposta, acao)
SELECT f.id, 'Menu de atendimento', 1, 'Como podemos ajudar?', 'escolha', 'aguardar_resposta'
FROM public.bot_fluxos f WHERE f.nome = 'Atendimento Inicial';

-- Opcoes do menu inicial a partir das opcoes ja cadastradas
INSERT INTO public.bot_fluxo_opcoes (etapa_id, titulo, valor, ordem, acao, destino_fluxo_id, ativo)
SELECT e.id,
       o.nome,
       o.nome,
       o.ordem,
       CASE WHEN o.acao = 'atendente' THEN 'transferir_atendente' ELSE 'iniciar_fluxo' END,
       CASE o.acao
         WHEN 'orcamento' THEN (SELECT id FROM public.bot_fluxos WHERE nome = 'Fazer Orçamento')
         WHEN 'consultar_pedido' THEN (SELECT id FROM public.bot_fluxos WHERE nome = 'Consultar Pedido')
         WHEN 'curriculo' THEN (SELECT id FROM public.bot_fluxos WHERE nome = 'Currículo')
         ELSE NULL
       END,
       o.ativo
FROM public.bot_menu_opcoes o
CROSS JOIN LATERAL (
  SELECT e2.id FROM public.bot_fluxo_etapas e2
  JOIN public.bot_fluxos f2 ON f2.id = e2.fluxo_id AND f2.nome = 'Atendimento Inicial'
  LIMIT 1
) e;
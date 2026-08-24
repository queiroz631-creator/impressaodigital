ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS bot_24h boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS msg_fora_horario text NOT NULL DEFAULT 'Olá! No momento estamos fora do nosso horário de atendimento.

Recebemos sua mensagem e retornaremos assim que possível.',
  ADD COLUMN IF NOT EXISTS msg_retorno_dia text NOT NULL DEFAULT 'Olá, {nome}! 👋

Posso te mandar um menu com as opções de atendimento?',
  ADD COLUMN IF NOT EXISTS msg_nao_entendi text NOT NULL DEFAULT 'Infelizmente não consegui identificar sua resposta. Gostaria de falar com um de nossos atendentes?',
  ADD COLUMN IF NOT EXISTS msg_menu text NOT NULL DEFAULT 'Escolha uma das opções abaixo:',
  ADD COLUMN IF NOT EXISTS inatividade_minutos integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS usar_ia boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enviar_msg_finalizacao boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS finalizacao_uma_vez_dia boolean NOT NULL DEFAULT true;

UPDATE public.whatsapp_config
SET msg_boas_vindas = 'Olá, {nome}! 👋

Seja bem-vindo(a)!

Posso te mandar um menu com as opções de atendimento?'
WHERE coalesce(msg_boas_vindas, '') = '';

ALTER TABLE public.whatsapp_conversas
  ADD COLUMN IF NOT EXISTS saudacao_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS finalizacao_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS inatividade_avisada boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.bot_horarios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dia_semana smallint NOT NULL UNIQUE CHECK (dia_semana BETWEEN 0 AND 6),
  fechado boolean NOT NULL DEFAULT false,
  abre time NOT NULL DEFAULT '08:00',
  fecha time NOT NULL DEFAULT '18:00',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_horarios TO authenticated;
GRANT ALL ON public.bot_horarios TO service_role;
ALTER TABLE public.bot_horarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bot_horarios_auth" ON public.bot_horarios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER bot_horarios_updated_at BEFORE UPDATE ON public.bot_horarios FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.bot_menu_opcoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  acao text NOT NULL DEFAULT 'mensagem',
  mensagem text NOT NULL DEFAULT '',
  ordem integer NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  permitir_palavra_chave boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_menu_opcoes TO authenticated;
GRANT ALL ON public.bot_menu_opcoes TO service_role;
ALTER TABLE public.bot_menu_opcoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bot_menu_opcoes_auth" ON public.bot_menu_opcoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER bot_menu_opcoes_updated_at BEFORE UPDATE ON public.bot_menu_opcoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.bot_respostas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  resposta text NOT NULL DEFAULT '',
  ordem integer NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_respostas TO authenticated;
GRANT ALL ON public.bot_respostas TO service_role;
ALTER TABLE public.bot_respostas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bot_respostas_auth" ON public.bot_respostas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER bot_respostas_updated_at BEFORE UPDATE ON public.bot_respostas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.bot_palavras_chave (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opcao_id uuid REFERENCES public.bot_menu_opcoes(id) ON DELETE CASCADE,
  resposta_id uuid REFERENCES public.bot_respostas(id) ON DELETE CASCADE,
  texto text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CHECK (opcao_id IS NOT NULL OR resposta_id IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_palavras_chave TO authenticated;
GRANT ALL ON public.bot_palavras_chave TO service_role;
ALTER TABLE public.bot_palavras_chave ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bot_palavras_chave_auth" ON public.bot_palavras_chave FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.bot_horarios (dia_semana, fechado, abre, fecha) VALUES
  (0, true, '08:00', '18:00'),
  (1, false, '08:00', '18:00'),
  (2, false, '08:00', '18:00'),
  (3, false, '08:00', '18:00'),
  (4, false, '08:00', '18:00'),
  (5, false, '08:00', '18:00'),
  (6, false, '08:00', '13:00')
ON CONFLICT (dia_semana) DO NOTHING;

INSERT INTO public.bot_menu_opcoes (nome, acao, mensagem, ordem) VALUES
  ('Fazer orçamento', 'orcamento', 'Claro! 😊

Envie os arquivos que deseja imprimir.

Você pode enviar PDF, imagens ou documentos.', 1),
  ('Consultar pedido', 'consultar_pedido', 'Vamos localizar seu pedido.', 2),
  ('Currículo', 'curriculo', 'Você deseja criar ou atualizar seu currículo?', 3),
  ('Falar com atendente', 'atendente', 'Seu atendimento foi encaminhado para nossa equipe.

Aguarde um momento.', 4);

INSERT INTO public.bot_respostas (titulo, resposta, ordem) VALUES
  ('Horário de funcionamento', 'Nosso horário de atendimento é de segunda a sexta, das 08h às 18h, e aos sábados das 08h às 13h.', 1);

INSERT INTO public.bot_palavras_chave (opcao_id, texto)
SELECT id, t.texto FROM public.bot_menu_opcoes o
CROSS JOIN LATERAL (VALUES ('orçamento'), ('orcamento'), ('imprimir'), ('impressão'), ('quanto custa')) AS t(texto)
WHERE o.acao = 'orcamento';

INSERT INTO public.bot_palavras_chave (opcao_id, texto)
SELECT id, t.texto FROM public.bot_menu_opcoes o
CROSS JOIN LATERAL (VALUES ('meu pedido'), ('consultar pedido'), ('status do pedido'), ('já está pronto')) AS t(texto)
WHERE o.acao = 'consultar_pedido';

INSERT INTO public.bot_palavras_chave (opcao_id, texto)
SELECT id, t.texto FROM public.bot_menu_opcoes o
CROSS JOIN LATERAL (VALUES ('currículo'), ('curriculo'), ('cv'), ('fazer currículo')) AS t(texto)
WHERE o.acao = 'curriculo';

INSERT INTO public.bot_palavras_chave (opcao_id, texto)
SELECT id, t.texto FROM public.bot_menu_opcoes o
CROSS JOIN LATERAL (VALUES ('atendente'), ('falar com alguém'), ('pessoa'), ('humano')) AS t(texto)
WHERE o.acao = 'atendente';

INSERT INTO public.bot_palavras_chave (resposta_id, texto)
SELECT id, t.texto FROM public.bot_respostas r
CROSS JOIN LATERAL (VALUES ('horário'), ('horario'), ('que horas abre'), ('que horas fecha'), ('vocês estão abertos'), ('funciona hoje'), ('horário de funcionamento')) AS t(texto)
WHERE r.titulo = 'Horário de funcionamento';
CREATE TABLE IF NOT EXISTS public.bot_primeiro_contato (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL DEFAULT '',
  condicao text NOT NULL DEFAULT 'qualquer',
  palavras text[] NOT NULL DEFAULT '{}',
  mensagem text NOT NULL DEFAULT '',
  acao text NOT NULL DEFAULT 'aguardar',
  destino_fluxo_id uuid REFERENCES public.bot_fluxos(id) ON DELETE SET NULL,
  destino_resposta_id uuid REFERENCES public.bot_respostas(id) ON DELETE SET NULL,
  delay_segundos integer NOT NULL DEFAULT 0,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_primeiro_contato TO authenticated;
GRANT ALL ON public.bot_primeiro_contato TO service_role;

ALTER TABLE public.bot_primeiro_contato ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bot_primeiro_contato_auth" ON public.bot_primeiro_contato
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER bot_primeiro_contato_updated_at
  BEFORE UPDATE ON public.bot_primeiro_contato
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.bot_primeiro_contato (nome, condicao, palavras, mensagem, acao, destino_fluxo_id, ordem)
SELECT 'Arquivos com pergunta de valor', 'arquivo_palavra',
  ARRAY['valor','preco','preço','quanto','custa','orcamento','orçamento','imprimir','impressao','impressão'],
  'Recebi seus arquivos! Vou preparar seu orçamento. 😉',
  'iniciar_fluxo', (SELECT id FROM public.bot_fluxos WHERE fluxo_arquivos ORDER BY ordem LIMIT 1), 1
WHERE NOT EXISTS (SELECT 1 FROM public.bot_primeiro_contato);

INSERT INTO public.bot_primeiro_contato (nome, condicao, palavras, mensagem, acao, destino_fluxo_id, ordem)
SELECT 'Somente arquivos', 'arquivo', '{}',
  'Recebi seus arquivos! Você quer um orçamento de impressão?',
  'confirmar_fluxo', (SELECT id FROM public.bot_fluxos WHERE fluxo_arquivos ORDER BY ordem LIMIT 1), 2
WHERE NOT EXISTS (SELECT 1 FROM public.bot_primeiro_contato WHERE condicao = 'arquivo');

INSERT INTO public.bot_primeiro_contato (nome, condicao, palavras, mensagem, acao, ordem)
SELECT 'Saudação simples', 'saudacao', '{}',
  'Olá! 👋 Seja bem-vindo(a). Como podemos ajudar você hoje?',
  'aguardar', 3
WHERE NOT EXISTS (SELECT 1 FROM public.bot_primeiro_contato WHERE condicao = 'saudacao');

ALTER TABLE public.bot_fluxos DROP COLUMN IF EXISTS mensagem_retorno_dia;
ALTER TABLE public.bot_fluxo_etapas DROP COLUMN IF EXISTS mensagem_retorno_dia;
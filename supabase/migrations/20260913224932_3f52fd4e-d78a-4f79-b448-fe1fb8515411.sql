-- 1. descricao nos perfis
ALTER TABLE public.perfis_acesso ADD COLUMN IF NOT EXISTS descricao text;

-- 2. padronizar chaves antigas -> chaves do catalogo de modulos
WITH mapa(antiga, nova) AS (
  VALUES
    ('calculadora','calculadora.visualizar'),
    ('orcamentos','orcamentos.visualizar'),
    ('clientes','clientes.visualizar'),
    ('curriculos','curriculos.visualizar'),
    ('precos','precos.visualizar'),
    ('whatsapp','whatsapp.visualizar'),
    ('mensagens_rapidas','mensagens_rapidas.visualizar'),
    ('bot','bot.visualizar'),
    ('conexoes','conexoes.visualizar'),
    ('catalogo','catalogo.visualizar'),
    ('sorteios','sorteios.visualizar'),
    ('promocoes','promocoes.visualizar'),
    ('usuarios','usuarios.visualizar'),
    ('configuracoes','configuracoes.visualizar'),
    ('melhorias','melhorias.visualizar'),
    ('excluir_pedido','pedido.excluir'),
    ('alterar_precos','precos.alterar'),
    ('gerenciar_conexoes','conexoes.gerenciar'),
    ('gerenciar_usuarios','usuarios.gerenciar')
), convertidas AS (
  SELECT p.id,
         COALESCE(
           jsonb_agg(DISTINCT COALESCE(m.nova, chave.valor)) FILTER (WHERE chave.valor <> 'dashboard'),
           '[]'::jsonb
         ) AS nova_lista
    FROM public.perfis_acesso p
    CROSS JOIN LATERAL jsonb_array_elements_text(p.permissoes) AS chave(valor)
    LEFT JOIN mapa m ON m.antiga = chave.valor
   WHERE jsonb_typeof(p.permissoes) = 'array'
   GROUP BY p.id
)
UPDATE public.perfis_acesso p
   SET permissoes = c.nova_lista
  FROM convertidas c
 WHERE c.id = p.id AND p.permissoes <> c.nova_lista;

-- 3. perfil Administrador com todas as permissoes
INSERT INTO public.perfis_acesso (nome, descricao, permissoes, ativo)
SELECT 'Administrador', 'Acesso total ao sistema', '[]'::jsonb, true
 WHERE NOT EXISTS (SELECT 1 FROM public.perfis_acesso WHERE nome = 'Administrador');

UPDATE public.perfis_acesso
   SET permissoes = to_jsonb(ARRAY[
        'modulo.operacao','modulo.comunicacao','modulo.marketing','modulo.administracao',
        'calculadora.visualizar','orcamentos.visualizar','clientes.visualizar','curriculos.visualizar','precos.visualizar',
        'whatsapp.visualizar','mensagens_rapidas.visualizar','bot.visualizar','conexoes.visualizar',
        'catalogo.visualizar','sorteios.visualizar','promocoes.visualizar',
        'usuarios.visualizar','configuracoes.visualizar','melhorias.visualizar',
        'pedido.excluir','precos.alterar','conexoes.gerenciar','usuarios.gerenciar']),
       descricao = COALESCE(descricao, 'Acesso total ao sistema')
 WHERE nome = 'Administrador';

-- 4. perfil Atendente (garante existencia; nao sobrescreve se ja existir)
INSERT INTO public.perfis_acesso (nome, descricao, permissoes, ativo)
SELECT 'Atendente', 'Atendimento e operacao do dia a dia',
       to_jsonb(ARRAY['modulo.operacao','modulo.comunicacao',
         'calculadora.visualizar','orcamentos.visualizar','clientes.visualizar','curriculos.visualizar',
         'whatsapp.visualizar','mensagens_rapidas.visualizar']), true
 WHERE NOT EXISTS (SELECT 1 FROM public.perfis_acesso WHERE nome = 'Atendente');

-- 5. perfil Financeiro
INSERT INTO public.perfis_acesso (nome, descricao, permissoes, ativo)
SELECT 'Financeiro', 'Orcamentos, clientes e precos',
       to_jsonb(ARRAY['modulo.operacao',
         'orcamentos.visualizar','clientes.visualizar','precos.visualizar','precos.alterar']), true
 WHERE NOT EXISTS (SELECT 1 FROM public.perfis_acesso WHERE nome = 'Financeiro');

-- 6. administradores atuais recebem o perfil Administrador e ficam ativos
UPDATE public.profiles p
   SET perfil_id = (SELECT id FROM public.perfis_acesso WHERE nome = 'Administrador' LIMIT 1),
       ativo = true
 WHERE public.has_role(p.id, 'admin')
   AND (p.perfil_id IS DISTINCT FROM (SELECT id FROM public.perfis_acesso WHERE nome = 'Administrador' LIMIT 1)
        OR p.ativo IS NOT TRUE);

-- 7. bloquear escalada de privilegio na propria linha de profiles
CREATE OR REPLACE FUNCTION public.profiles_bloquear_escalada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.perfil_id IS DISTINCT FROM OLD.perfil_id
     OR NEW.ativo IS DISTINCT FROM OLD.ativo
     OR NEW.conexao_id IS DISTINCT FROM OLD.conexao_id THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar perfil, situacao ou conexao de um usuario';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_bloquear_escalada ON public.profiles;
CREATE TRIGGER profiles_bloquear_escalada
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_bloquear_escalada();

-- 8. indices de apoio
CREATE INDEX IF NOT EXISTS profiles_perfil_id_idx ON public.profiles (perfil_id);
CREATE UNIQUE INDEX IF NOT EXISTS perfis_acesso_nome_idx ON public.perfis_acesso (lower(nome));
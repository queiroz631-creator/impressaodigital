-- Migration: 20261015020000_whatsapp_seed_ferramentas.sql
-- Popula ferramentas do sistema e vincula ao agente de atendimento
-- Etapa 6 — Agente de Atendimento WhatsApp

-- 1. Inserir ferramentas do sistema (do catálogo FERRAMENTAS_SISTEMA)
INSERT INTO public.agente_ferramentas (chave, nome, descricao, categoria, tipo, risco, sensivel, efeito_externo, idempotente, parametros_schema, resultado_schema, ativo)
VALUES
  -- Ferramentas de clientes
  ('sistema.cliente_buscar', 'Buscar cliente', 'Busca clientes por nome, CPF, telefone ou email.', 'clientes', 'consulta', 'baixo', false, false, true,
   '{"type":"object","properties":{"termo":{"type":"string","minLength":1,"maxLength":200},"limite":{"type":"integer","minimum":1,"maximum":50,"default":10}}}', '{"type":"array","items":{"type":"object"}}', true),
  
  ('sistema.cliente_detalhar', 'Detalhar cliente', 'Retorna detalhes completos de um cliente com histórico de pedidos e orçamentos.', 'clientes', 'consulta', 'baixo', false, false, true,
   '{"type":"object","properties":{"clienteId":{"type":"string","format":"uuid"}}}', '{"type":"object"}', true),
  
  -- Ferramentas de pedidos
  ('sistema.pedido_buscar', 'Buscar pedidos', 'Lista pedidos com filtros opcionais por cliente e status.', 'pedidos', 'consulta', 'baixo', false, false, true,
   '{"type":"object","properties":{"clienteId":{"type":"string","format":"uuid"},"status":{"type":"string","maxLength":40},"limite":{"type":"integer","minimum":1,"maximum":50,"default":10},"offset":{"type":"integer","minimum":0,"default":0}}}', '{"type":"array","items":{"type":"object"}}', true),
  
  ('sistema.pedido_detalhar', 'Detalhar pedido', 'Retorna detalhes completos de um pedido incluindo itens e histórico de status.', 'pedidos', 'consulta', 'baixo', false, false, true,
   '{"type":"object","properties":{"pedidoId":{"type":"string","format":"uuid"}}}', '{"type":"object"}', true),
  
  -- Ferramentas de orçamentos
  ('sistema.orcamento_buscar', 'Buscar orçamentos', 'Lista orçamentos com filtros opcionais por cliente e status.', 'orcamentos', 'consulta', 'baixo', false, false, true,
   '{"type":"object","properties":{"clienteId":{"type":"string","format":"uuid"},"status":{"type":"string","maxLength":40},"limite":{"type":"integer","minimum":1,"maximum":50,"default":10},"offset":{"type":"integer","minimum":0,"default":0}}}', '{"type":"array","items":{"type":"object"}}', true),
  
  ('sistema.orcamento_detalhar', 'Detalhar orçamento', 'Retorna detalhes completos de um orçamento incluindo itens e validade.', 'orcamentos', 'consulta', 'baixo', false, false, true,
   '{"type":"object","properties":{"orcamentoId":{"type":"string","format":"uuid"}}}', '{"type":"object"}', true),
  
  -- Ferramentas WhatsApp
  ('whatsapp.cliente_buscar', 'Buscar cliente WhatsApp', 'Busca cliente pelo telefone da conversa WhatsApp. Cria se não existir (opcional).', 'whatsapp', 'consulta', 'baixo', false, false, true,
   '{"type":"object","properties":{"telefone":{"type":"string","minLength":10,"maxLength":20},"criarSeNaoExistir":{"type":"boolean","default":false},"nome":{"type":"string","maxLength":150}}}', '{"type":"object"}', true),
  
  ('whatsapp.pedido_buscar', 'Buscar pedidos WhatsApp', 'Lista pedidos do cliente da conversa WhatsApp atual.', 'whatsapp', 'consulta', 'baixo', false, false, true,
   '{"type":"object","properties":{"telefone":{"type":"string","minLength":10,"maxLength":20},"status":{"type":"string","maxLength":40},"limite":{"type":"integer","minimum":1,"maximum":50,"default":10},"offset":{"type":"integer","minimum":0,"default":0}}}', '{"type":"array","items":{"type":"object"}}', true),
  
  ('whatsapp.orcamento_buscar', 'Buscar orçamentos WhatsApp', 'Lista orçamentos do cliente da conversa WhatsApp atual.', 'whatsapp', 'consulta', 'baixo', false, false, true,
   '{"type":"object","properties":{"telefone":{"type":"string","minLength":10,"maxLength":20},"status":{"type":"string","maxLength":40},"limite":{"type":"integer","minimum":1,"maximum":50,"default":10},"offset":{"type":"integer","minimum":0,"default":0}}}', '{"type":"array","items":{"type":"object"}}', true),
  
  ('whatsapp.encaminhar_humano', 'Encaminhar para atendente humano', 'Altera status da conversa para em_atendimento e registra motivo. Exige aprovação.', 'whatsapp', 'acao', 'alto', true, true, false,
   '{"type":"object","properties":{"conversaId":{"type":"string","format":"uuid"},"motivo":{"type":"string","maxLength":500},"atendenteId":{"type":"string","format":"uuid"}}}', '{"type":"object"}', true)
ON CONFLICT (chave) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  categoria = EXCLUDED.categoria,
  tipo = EXCLUDED.tipo,
  risco = EXCLUDED.risco,
  sensivel = EXCLUDED.sensivel,
  efeito_externo = EXCLUDED.efeito_externo,
  idempotente = EXCLUDED.idempotente,
  parametros_schema = EXCLUDED.parametros_schema,
  resultado_schema = EXCLUDED.resultado_schema,
  ativo = EXCLUDED.ativo,
  atualizado_em = now();

-- 2. Vincular ferramentas ao agente "atendimento"
-- Ferramentas do sistema (consultas gerais)
INSERT INTO public.agente_ferramenta_vinculos (agente_id, ferramenta_id, ativo)
SELECT a.id, f.id, true
FROM public.agentes a
CROSS JOIN public.agente_ferramentas f
WHERE a.chave = 'atendimento'
  AND f.chave IN (
    'sistema.cliente_buscar',
    'sistema.cliente_detalhar',
    'sistema.pedido_buscar',
    'sistema.pedido_detalhar',
    'sistema.orcamento_buscar',
    'sistema.orcamento_detalhar'
  )
ON CONFLICT (agente_id, ferramenta_id) DO UPDATE SET ativo = true;

-- 3. Vincular ferramentas WhatsApp ao agente "atendimento"
INSERT INTO public.agente_ferramenta_vinculos (agente_id, ferramenta_id, ativo)
SELECT a.id, f.id, true
FROM public.agentes a
CROSS JOIN public.agente_ferramentas f
WHERE a.chave = 'atendimento'
  AND f.chave IN (
    'whatsapp.cliente_buscar',
    'whatsapp.pedido_buscar',
    'whatsapp.orcamento_buscar',
    'whatsapp.encaminhar_humano'
  )
ON CONFLICT (agente_id, ferramenta_id) DO UPDATE SET ativo = true;

-- 4. Ativar o agente "atendimento" e definir prompt padrão
UPDATE public.agentes
SET ativo = true,
    config = jsonb_build_object(
      'descricao', 'Agente de Atendimento WhatsApp - Responde automaticamente às mensagens dos clientes com contexto do sistema',
      'boas_vindas', 'Olá! Sou o assistente virtual da Impressão Digital. Como posso ajudar você hoje?',
      'fora_horario', 'Nosso horário de atendimento é de segunda a sexta, das 08:00 às 18:00. Deixe sua mensagem que responderemos no próximo dia útil.',
      'transferencia', 'Vou transferir você para um atendente humano. Por favor, aguarde.',
      'max_contexto_mensagens', 20,
      'ferramentas_permitidas', ARRAY[
        'sistema.cliente_buscar',
        'sistema.cliente_detalhar',
        'sistema.pedido_buscar',
        'sistema.pedido_detalhar',
        'sistema.orcamento_buscar',
        'sistema.orcamento_detalhar',
        'whatsapp.cliente_buscar',
        'whatsapp.pedido_buscar',
        'whatsapp.orcamento_buscar',
        'whatsapp.encaminhar_humano'
      ]
    ),
    atualizado_em = now()
WHERE chave = 'atendimento';

-- 5. Criar versão inicial do prompt do agente
INSERT INTO public.agente_versoes (agente_id, tipo, versao, conteudo, ativo, observacao)
SELECT a.id, 'prompt', 1,
  jsonb_build_object(
    'texto', 'Você é o assistente virtual da Impressão Digital, uma gráfica especializada em impressão digital, offset, grandes formatos e materiais promocionais.

## Sua personalidade
- Profissional, cordial e prestativo
- Respostas claras e diretas
- Nunca inventa informações - se não souber, diga que vai verificar
- Sempre valida a identidade do cliente antes de revelar dados particulares

## Suas ferramentas disponíveis
- Consultar clientes, pedidos e orçamentos do sistema
- Buscar cliente pelo telefone da conversa WhatsApp
- Encaminhar para atendente humano quando necessário

## Regras de conduta
1. SEMPRE identifique o cliente pelo telefone da conversa antes de revelar qualquer dado
2. Para dados sensíveis (CPF, valores, endereços), confirme a identidade primeiro
3. Se o cliente pedir algo fora do escopo (ex: suporte técnico não relacionado), encaminhe para humano
3. Fora do horário comercial (seg-sex 8h-18h), informe o horário e ofereça deixar recado
4. Se o cliente pedir para falar com humano, use a ferramenta de encaminhamento
5. Nunca prometa prazos ou valores que não possa confirmar no sistema

## Fluxo típico
1. Cliente envia mensagem
2. Você identifica o cliente pelo telefone
3. Responde baseado no contexto e ferramentas disponíveis
4. Se precisar de ação sensível (ex: encaminhar), a ferramenta exige aprovação

Seja útil, educado e eficiente!'
  ),
  true,
  'Prompt inicial do Agente de Atendimento WhatsApp'
FROM public.agentes a
WHERE a.chave = 'atendimento'
ON CONFLICT (agente_id, tipo, versao) DO NOTHING;

-- 6. Atualizar o agente para usar esta versão como prompt atual
UPDATE public.agentes
SET system_prompt_atual_id = (
  SELECT id FROM public.agente_versoes
  WHERE agente_id = public.agentes.id AND tipo = 'prompt' AND versao = 1
  LIMIT 1
),
atualizado_em = now()
WHERE chave = 'atendimento';
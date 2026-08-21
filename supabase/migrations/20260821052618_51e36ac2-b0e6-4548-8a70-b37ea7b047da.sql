DELETE FROM public.orcamentos WHERE pedido_id IN (SELECT id FROM public.pedidos WHERE cliente_telefone = '5511988887777');
DELETE FROM public.pedidos WHERE cliente_telefone = '5511988887777';
DELETE FROM public.whatsapp_arquivos WHERE conversa_id IN (SELECT id FROM public.whatsapp_conversas WHERE telefone = '5511988887777');
DELETE FROM public.whatsapp_mensagens WHERE conversa_id IN (SELECT id FROM public.whatsapp_conversas WHERE telefone = '5511988887777');
DELETE FROM public.whatsapp_auditoria WHERE conversa_id IN (SELECT id FROM public.whatsapp_conversas WHERE telefone = '5511988887777');
DELETE FROM public.whatsapp_conversas WHERE telefone = '5511988887777';
DELETE FROM public.clientes WHERE telefone_normalizado = '5511988887777';
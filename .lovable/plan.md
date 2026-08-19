# Integração WhatsApp (API não oficial hospedada)

## Por que não Baileys direto
Baileys é uma biblioteca Node que mantém um WebSocket aberto e grava a sessão em disco. O servidor desta aplicação é serverless (sobe e morre a cada requisição), então Baileys não pode rodar aqui. A saída é usar um serviço já hospedado que fala WhatsApp por baixo (a maioria usa Baileys internamente) e conversar com ele por HTTP — sem você manter VPS.

Provedores compatíveis com o mesmo desenho: Z-API, Evolution API Cloud, UltraMsg, Wppconnect Cloud. O código será escrito com um adaptador, então trocar de provedor é mudar 1 arquivo + as credenciais.

## O que vai existir no sistema

**1. Conexão**
- Nova aba "WhatsApp" em Configurações (somente admin): status da conexão, QR Code para parear o número, botão desconectar.
- Credenciais do provedor guardadas como segredos do backend, nunca no código.

**2. Enviar orçamento / recibo**
- Botão "Enviar no WhatsApp" nas telas de Pedidos e no diálogo de orçamento.
- Usa `cliente_telefone` do pedido (já existe no banco), normalizado para o formato 55DDDNÚMERO.
- Envia mensagem de texto com o resumo + o PDF do orçamento/recibo como anexo.
- Modelos de mensagem editáveis em Configurações (com variáveis: nome do cliente, número do pedido, valor total, restante).

**3. Avisos automáticos de status**
- Ao mudar o status do pedido (pendente pagamento, pronto, finalizado etc.), oferece envio automático da mensagem correspondente ao cliente.
- Configurável por status: ligado/desligado e texto do modelo.

**4. Caixa de entrada (receber e responder)**
- Nova página "WhatsApp" no menu, com lista de conversas, histórico de mensagens e campo de resposta.
- Mensagens recebidas chegam por webhook do provedor e são gravadas no banco; a tela atualiza em tempo real.
- Cada conversa tenta vincular ao cliente/pedido pelo telefone, com atalho para abrir o pedido.

## Detalhes técnicos

**Banco (migração)**
- `whatsapp_contatos`: telefone (único), nome, ultima_mensagem_em, nao_lidas.
- `whatsapp_mensagens`: contato_id, direcao (entrada/saida), tipo (texto/imagem/documento), conteudo, media_url, status_envio, provider_message_id, pedido_id (opcional), created_at.
- `whatsapp_config`: instancia, conectado, modelos de mensagem por evento (jsonb), avisos_automaticos (jsonb).
- RLS: leitura/escrita apenas para usuários autenticados; GRANT para `authenticated` e `service_role`. Nada exposto para `anon`.
- Realtime habilitado em `whatsapp_mensagens` para a caixa de entrada atualizar sozinha.

**Servidor**
- `src/lib/whatsapp/provider.ts` — adaptador com `enviarTexto`, `enviarDocumento`, `statusConexao`, `obterQrCode`, `desconectar`. Implementação inicial para o provedor escolhido; segredos lidos dentro do handler.
- `src/lib/whatsapp.functions.ts` — server functions protegidas por `requireSupabaseAuth` para enviar mensagem, buscar QR/status e desconectar; grava cada envio em `whatsapp_mensagens`.
- `src/routes/api/public/whatsapp-webhook.ts` — recebe eventos do provedor, valida um token secreto no header/query antes de qualquer gravação, grava mensagens recebidas e atualiza status de entrega.

**Frontend**
- `src/routes/whatsapp.tsx` — caixa de entrada (lista de conversas + thread + envio).
- Aba WhatsApp em `src/routes/configuracoes.tsx` — conexão, QR, modelos, avisos por status.
- Botões de envio em `src/routes/orcamentos.tsx` e no diálogo de orçamento.
- PDF já gerado é enviado ao provedor como base64 ou via URL assinada do storage.

**Segredos necessários (pedidos na hora da implementação)**
- URL base do provedor, ID da instância, token/API key, e um token próprio para validar o webhook.

## Ordem de execução
1. Migração + RLS/GRANTs.
2. Adaptador do provedor + server functions + webhook.
3. Aba de conexão em Configurações (QR e status) — validar pareamento real.
4. Envio de orçamento/recibo com PDF.
5. Avisos automáticos por status.
6. Caixa de entrada com realtime.

## Aviso
APIs não oficiais violam os termos do WhatsApp; existe risco de bloqueio do número. Recomendo usar um chip dedicado ao sistema, não o número pessoal.

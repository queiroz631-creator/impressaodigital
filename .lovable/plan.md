# Integração WhatsApp via Z-API

Objetivo: enviar mensagens de WhatsApp (orçamento, recibo e mudança de status) direto do sistema, sem alterar nenhuma funcionalidade atual — calculadora, pedidos, impressão térmica e configurações continuam iguais. A integração entra como recurso adicional.

## Como funciona

O Z-API é uma API hospedada: você cria uma instância no painel deles, lê o QR Code com o WhatsApp da loja e recebe três credenciais (ID da instância, token da instância e token de segurança da conta). O sistema envia as mensagens chamando a API pelo backend, nunca pelo navegador, para não expor as credenciais.

```text
Tela Pedidos  ->  função no servidor  ->  Z-API  ->  WhatsApp do cliente
                        |
                  registra o envio no banco (log)
```

## O que será construído

1. **Credenciais seguras**: os três valores do Z-API ficam guardados como segredos do backend (não vão para o código nem para o banco).
2. **Aba "WhatsApp" em Configurações**: liga/desliga o envio, define o texto padrão das mensagens (com marcadores como {cliente}, {numero}, {total}, {restante}, {status}) e botão "Testar conexão" que mostra se a instância está conectada.
3. **Botão "Enviar WhatsApp" na tela de Pedidos/Orçamentos**: abre um diálogo com o telefone já preenchido pelo cadastro do pedido, o texto da mensagem pré-montado (editável) e a opção de anexar o PDF do orçamento. Envia e mostra confirmação.
4. **Envio do recibo**: no diálogo de impressão da etiqueta, uma opção extra "Enviar recibo por WhatsApp" — a impressão continua funcionando exatamente como hoje, o envio é opcional e só ocorre se marcado.
5. **Aviso de mudança de status**: ao mudar o status de um pedido (ex.: para "Pronto" ou "Finalizado"), oferecer o envio automático da mensagem correspondente, se ativado nas configurações.
6. **Histórico de envios**: cada mensagem enviada fica registrada (pedido, telefone, texto, sucesso/erro, data), visível numa lista simples dentro da aba WhatsApp.

## Detalhes técnicos

- Segredos: `ZAPI_INSTANCE_ID`, `ZAPI_INSTANCE_TOKEN`, `ZAPI_CLIENT_TOKEN` (header `Client-Token`).
- Server functions (`createServerFn`, autenticadas com `requireSupabaseAuth`) em `src/lib/whatsapp.functions.ts`:
  - `statusInstanciaZapi` → GET `/status`
  - `enviarTextoWhatsapp` → POST `/send-text`
  - `enviarDocumentoWhatsapp` → POST `/send-document/pdf` (PDF do orçamento em base64, reaproveitando `src/lib/orcamento-doc.ts`/`pdf.ts`)
  - Normalização do telefone para o formato 55DDDNÚMERO, com validação Zod e mensagens de erro amigáveis.
- Banco (migração única):
  - `configuracoes`: colunas `whatsapp_ativo boolean default false`, `whatsapp_modelo_orcamento text`, `whatsapp_modelo_recibo text`, `whatsapp_modelo_status jsonb` — apenas adições, nada removido.
  - Nova tabela `whatsapp_envios` (pedido_id, telefone, tipo, mensagem, sucesso, erro, created_at) com GRANTs e RLS para usuários autenticados.
- UI: nova aba em `src/routes/configuracoes.tsx`, novo componente `src/components/EnviarWhatsapp.tsx` usado em `src/routes/orcamentos.tsx` e, como checkbox opcional, em `src/components/ImprimirEtiqueta.tsx`.
- Nada é alterado em `src/lib/calc.ts`, `src/lib/impressora.ts` ou no fluxo da calculadora.

## O que você precisa providenciar

Conta no Z-API com uma instância criada e conectada ao WhatsApp da loja; depois de aprovar o plano, peço as três credenciais no formulário seguro.

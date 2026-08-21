# Atendimento via WhatsApp com Z-API

Objetivo: transformar o WhatsApp em mais um canal de entrada para o sistema atual. A calculadora, os preços, as faixas, os acabamentos, os pedidos e os orçamentos continuam exatamente como estão — o WhatsApp só alimenta e consome esse mesmo módulo.

Entrega em 3 fases. Cada fase termina funcional e testável.

```text
Cliente -> WhatsApp -> Z-API -> Webhook -> Atendimento -> Calculadora (módulo atual)
                                                -> Orçamento -> Pedido -> Z-API -> Cliente
```

## Fase 1 — Conexão, webhook e atendimento humano

1. **Cadastro de clientes**: nova tabela `clientes` (nome, telefone normalizado único, e-mail, observação). Pedidos e orçamentos ganham `cliente_id` opcional — os campos de nome/telefone atuais continuam existindo e funcionando, nada é removido.
2. **Configurações → WhatsApp → Z-API**: nome da conexão, Instance ID, Token, Client Token e URL base. Os tokens ficam guardados como segredos do backend (não aparecem no navegador; a tela mostra só "configurado"/"não configurado"). Botões **Testar conexão**, **Salvar** e **Atualizar status**, com indicador 🟢 conectado / 🔴 desconectado / 🟡 verificando.
3. **Webhook** `/api/public/whatsapp/webhook`: valida a chamada por um token secreto na URL, identifica telefone, tipo de mensagem e mídia, localiza ou cria o cliente e a conversa, grava a mensagem e os arquivos recebidos (PDF, imagem, Word, áudio, localização, resposta de botão) num bucket privado.
4. **Tela Atendimento WhatsApp** com as 5 abas e contagem em cada uma: Automático, Aguardando Resposta, Em Atendimento, Pendente, Finalizado. Cada item mostra nome, telefone, última mensagem, data/hora, quantidade de mensagens, pedido vinculado e etapa atual.
5. **Tela da conversa**: histórico completo, campo de mensagem, anexo, e ações **Assumir**, **Devolver para bot**, **Enviar orçamento**, **Finalizar**. Ao assumir, grava atendente e horário e o bot para de responder.
6. **Tempo real e notificação**: contador "WhatsApp (3)" no menu, atualizado por Realtime, sem recarregar a página.
7. **Auditoria**: registro de quem assumiu, alterou, aprovou, enviou e finalizou.

Nesta fase o bot ainda não responde sozinho — o atendimento é manual e completo.

## Fase 2 — Bot, IA e orçamento automático

1. **Configurações → WhatsApp → Bot**: ativar bot, mensagens (inicial, boas-vindas, transferência, finalização, orçamento gerado, revisão, confirmação), permitir orçamento automático, exigir revisão humana, permitir link, mostrar preços no link, e regra de reabertura (mesmo dia reabre / dia diferente cria novo).
2. **Máquina de etapas** por conversa: `inicio`, `aguardando_nome`, `aguardando_arquivos`, `analisando_arquivos`, `aguardando_tipo`, `aguardando_formato`, `aguardando_material`, `aguardando_copias`, `aguardando_frente_verso`, `aguardando_acabamento`, `calculando`, `aguardando_confirmacao`, `aguardando_revisao`, `aguardando_atendente`, `finalizado`. A etapa fica salva, então o atendimento continua de onde parou mesmo após reinício.
3. **Fluxo do orçamento**: primeiro contato pede o nome; depois botões **Fazer orçamento** / **Outras opções** (com resposta por texto como alternativa). Recebidos os arquivos, o sistema conta as páginas (PDF e Word automaticamente, imagem = 1 página; quando não conseguir, pergunta ao cliente), envia o resumo (arquivos / páginas / páginas adicionais) e pergunta tipo de impressão, formato, material, cópias, frente e verso e acabamentos — sempre com as listas vindas do banco, nunca fixas.
4. **Cálculo**: um adaptador converte as respostas do WhatsApp na entrada da calculadora e chama as funções atuais (`calcularLinhas`, `calcularAcabamentos`, faixas por arquivo, por página e por cópia adicional). A IA só interpreta a conversa e organiza dados; ela nunca define preço.
5. **Envio do orçamento**: aviso de que foi gerado por IA, resumo em texto com o total, e botões **Confirmar** / **Alterar** / **Falar com atendente**. A imagem do orçamento (mesmo layout de hoje) é enviada com um clique pela tela de atendimento — a geração de imagem roda no navegador, então o envio automático usa texto + link, e a imagem sai pelo atendente.
6. **Revisão humana**: quando exigida, o orçamento entra em **Atendimento Pendente** com as ações Revisar / Aprovar e enviar / Editar / Cancelar, e um alerta de divergência comparando valor calculado x valor salvo, materiais, páginas, cópias e acabamentos.
7. **Sem duplicidade**: existe no máximo um orçamento em andamento por conversa; novo clique continua o mesmo.

## Fase 3 — Orçamento por link

1. Página pública `/orcamento/$token` vinculada a cliente, conversa e orçamento em andamento.
2. Mostra empresa, saudação, arquivos já recebidos, configurações do trabalho, materiais, acabamentos, resumo e total, com botão **Confirmar orçamento**.
3. Tudo controlado pelas permissões administrativas: permitir upload, alterar material/formato/tipo/cópias/frente e verso/acabamento, mostrar preços, permitir confirmação, exigir telefone. O que estiver desligado não aparece.
4. Alterações feitas no link atualizam o mesmo orçamento e são refletidas na conversa do WhatsApp.

## Detalhes técnicos

- Segredos: `ZAPI_INSTANCE_ID`, `ZAPI_INSTANCE_TOKEN`, `ZAPI_CLIENT_TOKEN`, `ZAPI_BASE_URL`, `WHATSAPP_WEBHOOK_TOKEN` (validação do webhook). Solicitados quando a instância estiver criada; a Fase 1 já roda com a tela mostrando "não configurado".
- Webhook como server route em `src/routes/api/public/whatsapp/webhook.ts` (Zod na entrada, `supabaseAdmin` só após validar o token). Envio via server functions autenticadas em `src/lib/whatsapp.functions.ts` (`/status`, `/send-text`, `/send-button-list`, `/send-document`, `/send-image`).
- Tabelas novas: `clientes`, `whatsapp_conversas`, `whatsapp_mensagens`, `whatsapp_arquivos`, `whatsapp_config` (bot + link), `whatsapp_auditoria`. Colunas novas: `cliente_id` em `pedidos`/`orcamentos`, `origem_orcamento` e `revisao_necessaria` em `orcamentos`. Todas com GRANT + RLS para usuários autenticados; nada existente é removido.
- Bucket privado `whatsapp` para os arquivos recebidos, com URLs assinadas.
- Adaptador em `src/lib/whatsapp-orcamento.ts` reutilizando `src/lib/calc.ts`, `src/lib/contagem.ts` e `src/lib/orcamento-extras.ts`. Nenhuma alteração de regra em `calc.ts`.
- IA pela Lovable AI (sem chave externa), limitada a interpretar intenção e mapear respostas para as etapas.
- Contagem de páginas de PDF/DOCX roda no servidor com `pdf-lib`/`fflate` (bibliotecas já usadas, compatíveis com o runtime).
- Telas novas: `src/routes/whatsapp.tsx` (abas + conversa) e nova aba em `src/routes/configuracoes.tsx`.

## O que você precisa providenciar

Conta Z-API com instância criada e QR Code lido. Depois disso peço as credenciais no formulário seguro e configuramos a URL do webhook no painel da Z-API.

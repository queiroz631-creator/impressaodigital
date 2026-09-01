# Corrigir primeiro contato ao receber imagens

O texto continuará como está. A correção será limitada ao recebimento de imagens/arquivos e ao controle interno que evita respostas duplicadas, sem alteração de layout ou configurações.

## Diagnóstico confirmado

- A regra **Somente arquivos** está ativa e configurada para responder e pedir confirmação antes de iniciar o fluxo.
- Na ocorrência mais recente, a imagem foi registrada, identificada como a última mensagem e marcada como processada; a conversa também recebeu o horário de saudação, mas nenhuma mensagem de saída foi criada.
- O processamento ficou interrompido com a trava do bot ativa. Para imagens, o caminho atual soma download da mídia, espera de agrupamento e as esperas configuradas da regra antes de enviar a primeira resposta. Além disso, a mensagem é marcada como processada antes de o envio terminar, impedindo uma retomada segura quando a execução é interrompida.

## Alterações

1. **Retirar o download da imagem do caminho crítico da primeira resposta**
   - Registrar o arquivo recebido antes de chamar o bot, mantendo os dados necessários para o fluxo.
   - Fazer a cópia para o armazenamento privado sem atrasar o início da regra de primeiro contato.

2. **Confirmar o processamento somente depois da resposta**
   - Atualizar `ultimaProcessada` apenas quando o motor concluir o tratamento da mensagem.
   - Se houver interrupção ou erro antes do envio, permitir que a mensagem seja retomada em vez de ficar definitivamente descartada.

3. **Preservar o agrupamento de várias imagens**
   - Manter a trava por conversa e a seleção da mensagem mais recente para que uma ou várias imagens enviadas juntas gerem apenas uma resposta.
   - Garantir a liberação/expiração segura da trava sem alterar os demais estados do atendimento.

4. **Validar os dois cenários**
   - Uma imagem sem legenda inicia a regra **Somente arquivos**.
   - Várias imagens enviadas juntas iniciam a mesma regra uma única vez.
   - Confirmar que mensagens de texto continuam funcionando e que imagens recebidas dentro de um fluxo continuam sendo contabilizadas normalmente.

## Escopo técnico

- Ajustes somente em `src/routes/api/public/whatsapp/webhook.ts` e `src/lib/bot.server.ts`.
- Sem mudanças no banco de dados, no cadastro das regras, no layout, na calculadora, em pedidos ou em currículos.

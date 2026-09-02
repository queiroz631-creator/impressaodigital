# Mensagens enviadas fora do sistema não aparecem no WhatsApp

## O que foi verificado

No recebimento das mensagens (`src/routes/api/public/whatsapp/webhook.ts`, linha 106) existe uma regra que **descarta qualquer mensagem marcada como "enviada por mim"** (`fromMe`). Ou seja, quando o atendente responde direto pelo celular ou pelo WhatsApp Web, o sistema recebe o aviso e joga fora — a mensagem nunca é gravada na conversa. Por isso o histórico do atendimento fica incompleto.

Essa regra foi criada no passado para evitar que o bot respondesse a si mesmo. A correção mantém essa proteção, mas passa a **registrar** a mensagem.

## Correção

1. **Gravar as mensagens enviadas fora do sistema.**
   - Mensagem com `fromMe` deixa de ser descartada: é registrada na conversa como mensagem de **saída**, com autor "Atendente (WhatsApp)", tipo correto (texto, imagem, documento, áudio) e o mesmo controle de duplicidade por identificador da mensagem já usado hoje.
   - Atualiza "última mensagem" e a data da conversa, para a conversa subir na lista.
   - **Não** conta como não lida e **não** aciona o bot: nada de resposta automática nem reabertura de atendimento por causa dessas mensagens.
   - Se a conversa ainda não existir para aquele número, ela é criada normalmente (contato iniciado pela loja).
   - Continua ignorando: grupos, status/stories e as próprias respostas que o sistema já enviou (identificadas pelo identificador da mensagem já gravado no envio).

2. **Exibição no atendimento.**
   - Essas mensagens aparecem no mesmo lado das respostas do sistema (saída), com o autor indicando que vieram do celular, para o atendente diferenciar.

3. **Pré-requisito na conta do WhatsApp (Z-API).**
   - O provedor só avisa sobre mensagens enviadas pelo celular se o webhook "Ao enviar" (mensagens enviadas por mim) estiver apontando para o mesmo endereço do webhook de recebimento. Depois de aplicar a correção, confirmo se esses avisos estão chegando; se não estiverem, indico exatamente o endereço para configurar no painel do provedor.

## Validação

- Enviar uma mensagem pelo celular para um cliente e conferir que ela aparece na conversa do sistema, do lado das respostas.
- Conferir que o bot não responde nem reabre atendimento por causa dela.
- Conferir que mensagens do cliente continuam funcionando igual (bot, primeiro contato, arquivos).

## Escopo técnico

- `src/routes/api/public/whatsapp/webhook.ts`: substituir o descarte de `fromMe` por um ramo dedicado que grava a mensagem como `direcao: "saida"`, sem incrementar `nao_lidas`, sem marcar `bot_pendente` e sem reabrir atendimento finalizado.
- `src/routes/whatsapp.tsx`: apenas rótulo de autor, se necessário.
- Sem mudanças no bot, fluxos, calculadora, pedidos ou currículos.

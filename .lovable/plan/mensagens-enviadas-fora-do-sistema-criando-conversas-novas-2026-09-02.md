# Mensagens enviadas fora do sistema criando conversas novas

## O que foi verificado no banco

Os avisos de mensagens "enviadas por mim" chegam com o telefone em formato interno do WhatsApp (LID), e não com o número do cliente. Exemplos gravados hoje:

- conversa criada com telefone `104543949971694` (payload: `phone: "104543949971694@lid"`)
- conversa criada com telefone `7168334008393` (payload: `phone: "7168334008393@lid"`, chatName "#Eduardo Pessoal")

Como o sistema identifica a conversa pelo telefone, esse identificador vira um "cliente" novo e uma conversa duplicada aparece na tela.

Além disso, algumas dessas conversas fantasmas contêm **cópias de mensagens que o próprio bot enviou** (o texto do atendimento automatizado), porque o identificador do aviso é diferente do que foi gravado no envio, então a checagem de duplicidade não pega.

## Correção

1. **Guardar o identificador interno (LID) na conversa**
   - Quando o cliente escreve, o aviso traz tanto o número real quanto o LID. Passar a gravar o LID na conversa do cliente.

2. **Casar a mensagem enviada fora do sistema com a conversa certa**
   - Ao receber um aviso "enviado por mim" cujo telefone é um LID, localizar a conversa pelo LID guardado e registrar a mensagem nela.
   - Se não existir conversa com aquele LID, **ignorar** o aviso em vez de criar conversa/cliente novo (evita as entradas fantasmas). Quando o telefone vier no formato normal, o comportamento atual continua.

3. **Não duplicar as respostas do próprio bot**
   - Além da checagem por identificador, ignorar aviso "enviado por mim" quando já existe, na mesma conversa, uma mensagem de saída com o mesmo texto nos últimos minutos.

4. **Limpeza**
   - Remover as conversas/clientes fantasmas já criados com telefone em formato LID (sem mensagens de cliente reais).

## Validação

- Enviar mensagem pelo celular para um cliente que já tem conversa: aparece dentro da conversa existente, do lado de saída, sem criar contato novo.
- Bot responder um cliente: nenhuma cópia duplicada aparece.
- Cliente enviar mensagem: fluxo normal continua igual.

## Escopo técnico

- Migração: coluna `chat_lid` em `whatsapp_conversas` (com índice) + remoção das linhas fantasmas em `whatsapp_conversas`/`clientes`.
- `src/routes/api/public/whatsapp/webhook.ts`: gravar `chat_lid` nas mensagens de entrada; resolver conversa por `chat_lid` quando `fromMe` vier com LID; ignorar sem conversa correspondente; dedupe extra por texto recente.
- Sem mudanças no bot, fluxos, calculadora ou currículos.

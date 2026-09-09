# Corrigir ausência enviada após o “SIM”

## O que foi confirmado

- A conversa real permaneceu na etapa **triagem**, com a resposta automática de Currículo registrada em `contexto.triagem`.
- O bot perguntou “Você quer falar sobre Curriculo?”, o cliente respondeu **Sim** e, oito segundos depois, recebeu a mensagem de fora do horário.
- A proteção atual verifica apenas `contexto.pendenteTipo`, mas a confirmação usada por essa resposta automática é controlada por `contexto.triagem` (ou `contexto.regra`). Por isso ela não é reconhecida como pergunta pendente.

## Correção

- Considerar como resposta pendente todas as confirmações da triagem: resposta automática, regra de primeiro contato e o estado antigo de menu.
- Enquanto uma dessas confirmações estiver aguardando **SIM/NÃO**, não enviar a mensagem de ausência.
- Deixar o “SIM” seguir para a resposta e ação já configuradas, inclusive fora do horário.
- Manter inalterado o envio da ausência para novos contatos fora do horário e para conversas sem pergunta pendente.

## Detalhes técnicos

- Alterar somente a condição de ausência em `src/lib/bot.server.ts`, usando `conversa.etapa === "triagem"` junto de `ctx.triagem`, `ctx.regra` e `ctx.pendenteTipo` para reconhecer todos os formatos de confirmação pendente.
- Validar o cenário completo: palavra-chave “Currículo” → pergunta de confirmação → “SIM” → mensagem/ação configurada, sem ausência intermediária.
- Sem migração, sem alteração de telas e sem mudança nas demais regras do bot.

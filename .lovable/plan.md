# Primeiro contato em sequência: arquivo após a saudação dispara nova regra

Hoje as regras de primeiro contato só são avaliadas quando a conversa está parada no início.
Se a primeira regra inicia um fluxo (ou fica aguardando SIM/NÃO) e o cliente manda um arquivo
logo em seguida, esse arquivo cai dentro do fluxo e nenhuma outra regra dispara.

## Objetivo

Logo após o bot reconhecer um primeiro contato, se o cliente enviar um arquivo (ou texto com
palavras-chave), o bot volta a avaliar as regras de primeiro contato — permitindo ativar uma
resposta automática ou reconhecer um novo primeiro contato — em vez de tratar a mensagem como
resposta do fluxo/ da confirmação pendente.

## Como vai funcionar

- Janela de sequência: depois que uma regra de primeiro contato é acionada, as próximas
  mensagens do cliente continuam passando pelas regras enquanto nenhum fluxo tiver sido
  efetivamente escolhido/iniciado pelo cliente e nenhuma confirmação SIM/NÃO respondida.
- Nessa janela, cada mensagem é avaliada por `escolherRegra` normalmente:
  - Arquivo sem texto → regra "Somente arquivos" (ex.: enviar resposta automática ou iniciar
    o fluxo de orçamento).
  - Arquivo com palavra-chave → regra "Arquivos + palavras-chave".
  - Texto com palavra-chave → regra "Texto com palavras-chave".
- Cada regra envia sua mensagem no máximo 1 vez por atendimento (controle já existente
  `regraEnviada`), estendido para guardar todas as regras já disparadas — assim regras
  diferentes respondem, mas a mesma regra não repete.
- Quando uma regra da janela tem ação "iniciar fluxo" ou o cliente responde SIM a uma
  confirmação, a janela fecha e o atendimento segue o fluxo normalmente.
- Se nenhuma regra combinar na janela, a mensagem segue o caminho atual (confirmação
  pendente / etapa do fluxo).

## O que muda na prática

Exemplo típico: cliente diz "oi" → regra de saudação responde e aguarda → cliente manda o PDF →
regra "Somente arquivos" dispara a resposta automática ou inicia o fluxo de orçamento, mesmo
se a saudação estava configurada para perguntar SIM/NÃO ou apontar para um fluxo.

## Detalhes técnicos

- `src/lib/bot-motor.ts`: sem mudanças em `escolherRegra` (já é pura e reutilizável).
- `src/lib/bot.server.ts`:
  - `ContextoBot.regraEnviada` passa a ser lista de ids (`regrasEnviadas`), com migração do
    valor antigo no contexto salvo.
  - Novo estado de janela no contexto (ex.: `janelaPrimeiroContato: true`) gravado por
    `executarAcaoRegra`/`resolverTriagem` ao acionar uma regra.
  - Em `rodarFluxo`: quando a janela está aberta e chega mensagem do cliente, rodar
    `escolherRegra` antes de `resolverTriagem`/etapa do fluxo; se uma regra diferente combinar,
    executar `triagem` com ela; se nada combinar, seguir o fluxo normal. A janela fecha ao
    iniciar fluxo, transferir, finalizar ou ao cliente responder SIM/NÃO à confirmação.
  - Reaproveitar a lógica existente de interrupção por palavra-chave do fluxo de fallback como
    referência de onde encaixar a verificação.
- Simulador da aba do Bot: passa a refletir a janela (sem mudanças visuais).
- Sem alterações de banco, telas de configuração ou demais áreas (orçamento, currículo etc.).

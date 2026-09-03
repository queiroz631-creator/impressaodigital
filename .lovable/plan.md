# Bot envia 2 mensagens ao receber arquivo

## O que os dados mostram

Analisei um caso de hoje (16:20 às 16:22):

- O cliente enviou **um único PDF** às 16:20:23.
- O bot respondeu a mensagem da regra **Somente arquivos** às 16:20:32.
- A **mesma mensagem foi enviada de novo** às 16:22:08, sem nenhuma nova mensagem do cliente no meio.
- Não há registro de que a ação da regra (finalizar sem mensagem) tenha sido executada na primeira vez.

Causa: a regra tem 60 segundos de espera antes da ação. Hoje o sistema só marca a mensagem do cliente como "já respondida" **depois** de cumprir toda a espera e executar a ação. Quando a rotina é interrompida durante esses 60 segundos (limite de tempo da execução em segundo plano), a mensagem continua marcada como não respondida e a trava da conversa expira em 60s — a fila então pega a mesma mensagem de novo e reenvia a resposta. Por isso acontece "às vezes": só quando a espera da regra é longa o bastante.

A janela anti-repetição existente também não cobre esse caso: ela usa apenas a espera da mensagem (1s) + 45s de margem, ou seja ~46s, menor que os 60s de espera da ação.

## Correção

1. **Marcar como respondida assim que a resposta sai**
   - Logo após enviar a mensagem ao cliente (antes da espera da ação), o sistema já confirma a mensagem de entrada como processada e registra no atendimento que aquela regra falou.
   - A confirmação final no fim do processamento continua existindo, para agrupar arquivos que cheguem durante a espera.
   - Assim, mesmo que a execução seja interrompida no meio da espera, nenhuma segunda mensagem é enviada.

2. **Janela anti-repetição proporcional à regra**
   - A janela passa a considerar espera da mensagem + espera da ação + margem, em vez de só a espera da mensagem.

3. **Registro de interrupção**
   - Se o processamento não chegar ao fim, fica um registro no histórico da conversa, para ficar visível quando a ação (finalizar/transferir/iniciar fluxo) não foi concluída.

## Validação

- 1 arquivo com regra de 60s: uma única mensagem.
- Vários arquivos juntos: uma única mensagem, todos contabilizados.
- Texto e saudação: comportamento inalterado.
- Conferir no histórico que não há mais duas saídas idênticas com ~60–95s de diferença.

## Escopo técnico

- `src/lib/bot.server.ts`:
  - em `triagem()`, após `responder()` bem-sucedido, gravar contexto com `ultimaRegra`/`ultimaRegraEm`/`regrasEnviadas` e chamar a confirmação da entrada (`confirmarLoteProcessado`) antes de `executarAcaoRegra()`;
  - ampliar `janelaLote` para incluir `regra.delay_segundos`;
  - registrar em `whatsapp_auditoria` quando o processamento terminar por exceção.
- Sem alterações de banco, layout, calculadora, pedidos ou currículos.

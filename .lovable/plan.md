# Tempo de espera nas respostas automáticas

Adicionar, em cada resposta automática, um campo de tempo (em segundos) aplicado depois que o cliente responde SIM ou NÃO, antes do bot executar a ação configurada.

## Como vai funcionar

- Novo campo "Aguardar antes da ação (segundos)" no formulário de resposta automática, logo abaixo dos blocos de ação SIM/NÃO.
- Valor padrão 0 (sem espera). Aceita números inteiros de 0 a 60.
- Um único tempo por resposta, valendo tanto para o SIM quanto para o NÃO.
- Após a confirmação do cliente, o bot envia o texto da resposta (quando for SIM), aguarda o tempo configurado e só então executa a ação (abrir fluxo, outra resposta, atendente etc.).
- O simulador respeita o mesmo intervalo.

## Detalhes técnicos

- Banco: nova coluna `delay_acao_segundos` (integer, NOT NULL, default 0) em `bot_respostas`.
- `src/lib/bot-motor.ts`: incluir o campo no tipo `BotResposta`.
- `src/lib/bot.server.ts`: em `resolverTriagem`, aguardar o intervalo entre o envio da resposta e a chamada de `executarAcaoResposta`.
- `src/components/bot/RespostasPainel.tsx`: campo numérico no formulário, incluído na carga e no salvamento.

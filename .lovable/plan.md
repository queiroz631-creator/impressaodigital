# Melhoria 23 — Nova opção na regra do primeiro contato

## O que muda

Em Configurar Bot > Primeiro contato, no campo **"Enviar a mensagem"**, entra uma nova opção:

**"Somente a partir do 2º contato do dia"**

- Com ela marcada, a regra fica em silêncio no primeiro atendimento do dia daquele cliente.
- A partir do segundo atendimento do mesmo dia, a mensagem da regra passa a ser enviada normalmente.
- No dia seguinte a contagem zera: o primeiro contato volta a ficar em silêncio.
- A ação da regra (iniciar fluxo, transferir, finalizar etc.) continua sendo executada como hoje — a opção controla apenas o envio da mensagem, igual às opções já existentes.

Na lista de regras aparece um selo indicando essa condição, como já acontece com "Somente no 1º contato do dia" e "Uma vez por atendimento".

As opções atuais ("Sempre que a regra combinar", "Uma vez por atendimento", "Somente no 1º contato do dia") continuam iguais. Nada mais muda.

## Detalhes técnicos

- `src/lib/bot-fluxos.ts`: novo item em `ENVIOS_PRIMEIRO_CONTATO` com valor `apos_primeira_do_dia`.
- `src/lib/bot.server.ts` (função `triagem`): o cálculo de `podeEnviar` passa a considerar o novo modo — quando `apos_primeira_do_dia`, só envia se `primeiraDoDia` for falso (a confirmação SIM/NÃO segue a mesma exceção já existente). O restante da lógica (janela anti-repetição, delays, `regrasEnviadas`, execução da ação) permanece intacto.
- `src/components/bot/PrimeiroContatoPainel.tsx`: selo na lista para o novo modo; o `Select` já é montado a partir de `ENVIOS_PRIMEIRO_CONTATO`.
- Sem migração de banco: `bot_primeiro_contato.enviar_mensagem` já é texto livre.
- Ao final, marcar a melhoria 23 como executada, mantendo `status = 'pendente'`.

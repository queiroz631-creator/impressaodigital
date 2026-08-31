# Corrigir a resposta do primeiro contato

## O que foi verificado

- As três regras de primeiro contato estão cadastradas e ativas (arquivos + palavras, só arquivos, saudação simples).
- Nas conversas reais de hoje, o cliente mandou "Oi" às 02:04, 02:06, 02:07, 02:10 e 02:12 e o bot não respondeu nada na hora; só saiu o menu do fluxo inicial pelo fallback de 1 minuto.
- Causa: a mensagem da regra só é enviada quando é o **primeiro contato do dia** (`saudacao_em`). Como a conversa já tinha atendimento hoje, todas as mensagens seguintes caíram na regra "Saudação simples" com ação "aguardar" e ficaram em silêncio.

## O que muda

1. **Cada regra escolhe quando enviar a mensagem.** Novo campo na regra: *Enviar a mensagem* → **Sempre** ou **Somente no 1º contato do dia** (padrão: sempre, para as regras já existentes).
2. **Regra com "Sempre"** responde toda vez que combinar no início da conversa; regra com "1º contato do dia" mantém o comportamento atual.
3. **Regra com ação "apenas aguardar" e mensagem vazia** continua em silêncio — nada muda aí.
4. **Sem mexer no fallback por tempo**, nas respostas automáticas, nos fluxos, no cálculo de orçamento, currículo, pedidos ou Z-API.

## Tela

- Na aba **Primeiro contato**, no diálogo de edição da regra, um seletor "Enviar a mensagem": Sempre · Somente no 1º contato do dia.
- No card da regra, um selo discreto quando estiver como "1º contato do dia".
- Nenhuma outra mudança de layout.

## Detalhes técnicos

- Migração: `ALTER TABLE public.bot_primeiro_contato ADD COLUMN enviar_mensagem text NOT NULL DEFAULT 'sempre'` (valores `sempre` | `primeira_do_dia`), com CHECK.
- `src/lib/bot-motor.ts`: campo `enviar_mensagem` em `RegraPrimeiroContato`.
- `src/lib/bot.server.ts` (`triagem`): a condição `primeiraDoDia || confirmar` passa a ser
  `regra.enviar_mensagem === 'sempre' || primeiraDoDia || confirmar`.
- `src/lib/bot-fluxos.ts`: constante com as duas opções e rótulos.
- `src/components/bot/PrimeiroContatoPainel.tsx`: campo no formulário, no `insert`/`update` e selo no card.
- `src/lib/bot.functions.ts` (simulador): mesma regra de envio.
